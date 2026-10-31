import { GAME_REVISION_SYSTEM_PROMPT } from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import {
  findDisputedRounds,
  parseJson,
  type ProgressReporter,
} from "./pipeline";
import {
  EDITABLE_FIELDS,
  GAME_CHANGES_SCHEMA,
  MAX_ROUNDS,
  MIN_ROUNDS,
  parseGameSpec,
  parseRound,
  type ChoiceRound,
  type EditableField,
  type GameSpec,
  type Round,
} from "./spec";

const MAX_ATTEMPTS = 2;
const EXPECTED_CHANGE_CHARACTERS = 900;
const UNCONFIRMED_MESSAGE =
  "Envision couldn't confirm the answers to the new questions, so your game is unchanged. Long calculations are hardest for this AI model, so try asking for a different kind of question.";

type Change = {
  action?: string;
  field?: string;
  value?: string;
  roundNumber?: number;
  round?: unknown;
};

const FIELD_LABELS: Record<EditableField, string> = {
  title: "title",
  mechanic: "game type",
  theme: "world",
  "player.name": "player name",
  "player.emoji": "player character",
  "challenger.name": "challenger name",
  "challenger.emoji": "challenger character",
  "story.intro": "story opening",
  "story.win": "winning message",
  "story.lose": "losing message",
};

function setField(spec: GameSpec, field: EditableField, value: string) {
  const [group, key] = field.split(".");
  if (key) {
    return {
      ...spec,
      [group]: { ...(spec[group as keyof GameSpec] as object), [key]: value },
    };
  }
  return { ...spec, [field]: value };
}

// Applies edits to a copy, so anything the teacher didn't mention stays exact.
export function applyChanges(spec: GameSpec, changes: Change[]) {
  const errors: string[] = [];
  const summary: string[] = [];
  let next = spec;
  const slots: { round: Round; changed: boolean }[] = spec.rounds.map(
    (round) => ({ round, changed: false }),
  );
  const added: Round[] = [];
  const removed = new Set<number>();

  for (const change of changes) {
    const index = (change.roundNumber ?? 0) - 1;
    const hasRound = index >= 0 && index < spec.rounds.length;

    if (change.action === "set_field") {
      if (
        !EDITABLE_FIELDS.includes(change.field as EditableField) ||
        !change.value?.trim()
      ) {
        errors.push("set_field needs a field and a value");
        continue;
      }
      const field = change.field as EditableField;
      next = setField(next, field, change.value.trim());
      summary.push(`Changed the ${FIELD_LABELS[field]}`);
    } else if (change.action === "replace_round") {
      const round = parseRound(change.round);
      if (!hasRound || !round) {
        errors.push(`replace_round needs a valid roundNumber and a complete round`);
        continue;
      }
      slots[index] = { round, changed: true };
      summary.push(`Rewrote round ${change.roundNumber}`);
    } else if (change.action === "add_round") {
      const round = parseRound(change.round);
      if (!round) {
        errors.push("add_round needs a complete round");
        continue;
      }
      added.push(round);
      summary.push("Added a round");
    } else if (change.action === "remove_round") {
      if (!hasRound) {
        errors.push(`remove_round needs a roundNumber from 1 to ${spec.rounds.length}`);
        continue;
      }
      removed.add(index);
      summary.push(`Removed round ${change.roundNumber}`);
    } else {
      errors.push("each change needs a known action");
    }
  }

  const finalSlots = [
    ...slots.filter((_, index) => !removed.has(index)),
    ...added.map((round) => ({ round, changed: true })),
  ];
  if (finalSlots.length < MIN_ROUNDS || finalSlots.length > MAX_ROUNDS) {
    errors.push(
      `a game needs ${MIN_ROUNDS} to ${MAX_ROUNDS} rounds, and this change would leave ${finalSlots.length}`,
    );
  }
  if (summary.length === 0) {
    errors.push("nothing in the game changed");
  }
  if (errors.length > 0) {
    return { errors };
  }

  const candidate = { ...next, rounds: finalSlots.map((slot) => slot.round) };
  const parsed = parseGameSpec(candidate);
  if ("errors" in parsed) {
    return { errors: parsed.errors };
  }
  if (JSON.stringify(parsed.spec) === JSON.stringify(spec)) {
    return { errors: ["nothing in the game changed"] };
  }

  return {
    spec: parsed.spec,
    summary,
    changedRounds: finalSlots
      .map((slot, index) => (slot.changed ? parsed.spec.rounds[index] : null))
      .filter((round) => round?.kind === "choice") as ChoiceRound[],
  };
}

function describeGame(spec: GameSpec) {
  return JSON.stringify({
    ...spec,
    rounds: spec.rounds.map((round, index) => ({
      roundNumber: index + 1,
      ...round,
    })),
  });
}

export async function reviseGame(
  provider: LlmProvider,
  spec: GameSpec,
  instruction: string,
  signal?: AbortSignal,
  onProgress: ProgressReporter = () => {},
) {
  const request = `Current game:
${describeGame(spec)}

Teacher's change: ${instruction}`;
  let feedback = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const label = attempt === 1 ? "Making your change" : "Fixing problems";
    const start = attempt === 1 ? 5 : 70;
    const end = attempt === 1 ? 70 : 85;
    onProgress({
      label: attempt === 1 ? "Starting the AI model" : label,
      percent: start,
    });

    const { model, text } = await provider.generate({
      system: GAME_REVISION_SYSTEM_PROMPT,
      prompt: request + feedback,
      schema: GAME_CHANGES_SCHEMA,
      signal,
      onCharacters: (count) =>
        onProgress({
          label,
          percent:
            start +
            Math.min(count / EXPECTED_CHANGE_CHARACTERS, 1) * (end - start),
        }),
    });

    const proposed = (parseJson(text) as { changes?: Change[] })?.changes;
    const changes = Array.isArray(proposed) ? proposed : [];
    const applied = applyChanges(spec, changes);
    if ("errors" in applied) {
      console.warn("Game change rejected:", applied.errors, text.slice(0, 600));
      feedback = `\n\nYour last changes couldn't be applied:\n- ${applied.errors?.join("\n- ")}`;
      continue;
    }

    onProgress({ label: "Checking the answers", percent: 90 });
    const disputed = applied.changedRounds.length
      ? await findDisputedRounds(provider, applied.changedRounds, signal)
      : [];
    if (disputed.length > 0) {
      console.warn("Game change failed the answer check:", disputed);
      if (attempt < MAX_ATTEMPTS) {
        feedback = `\n\nThese new questions had the wrong answer marked as correct. Write simpler ones that need no long calculation:\n- ${disputed
          .map((round) => round.prompt)
          .join("\n- ")}`;
        continue;
      }

      // Keeps the rest of the change, but a doubtful question never goes in.
      const doubtful = new Set(disputed.map((round) => round.prompt));
      const partial = applyChanges(
        spec,
        changes.filter((change) => {
          const round = parseRound(change.round);
          return !round || !doubtful.has(round.prompt);
        }),
      );
      if ("errors" in partial) {
        throw new ProviderRequestError(UNCONFIRMED_MESSAGE);
      }

      onProgress({ label: "Finishing your game", percent: 97 });
      const skipped = disputed.length === 1 ? "1 new question" : `${disputed.length} new questions`;
      return {
        model,
        spec: partial.spec,
        changes: [
          ...(partial.summary ?? []),
          `Skipped ${skipped} because Envision couldn't confirm the answer`,
        ],
      };
    }

    onProgress({ label: "Finishing your game", percent: 97 });
    return { model, spec: applied.spec, changes: applied.summary };
  }

  throw new ProviderRequestError(
    "Envision couldn't make that change, so your game is unchanged. Try describing it another way.",
  );
}
