import {
  ANSWER_CHECK_SYSTEM_PROMPT,
  GAME_DESIGN_SYSTEM_PROMPT,
} from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import { renderGame } from "./render";
import {
  GAME_SPEC_SCHEMA,
  MIN_ROUNDS,
  parseGameSpec,
  type ChoiceRound,
  type GameSpec,
} from "./spec";

const MAX_ATTEMPTS = 3;
const RETRY_CUTOFF_MS = 3 * 60 * 1000;

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Asks the model to answer without seeing the key. A round it disagrees with
// counts as disputed, including when the check returns nothing usable.
async function findDisputedRounds(
  provider: LlmProvider,
  spec: GameSpec,
  signal?: AbortSignal,
) {
  const choiceRounds = spec.rounds.filter(
    (round): round is ChoiceRound => round.kind === "choice",
  );

  const { text } = await provider.generate({
    system: ANSWER_CHECK_SYSTEM_PROMPT,
    signal,
    prompt: choiceRounds
      .map(
        (round, index) =>
          `${index + 1}. ${round.prompt}\n${round.choices
            .map((choice, choiceIndex) => `${choiceIndex}: ${choice}`)
            .join("\n")}`,
      )
      .join("\n\n"),
    schema: {
      type: "object",
      properties: {
        answers: {
          type: "array",
          items: { type: "integer", minimum: 0, maximum: 3 },
          minItems: choiceRounds.length,
          maxItems: choiceRounds.length,
        },
      },
      required: ["answers"],
    },
  });

  const answers = (parseJson(text) as { answers?: unknown })?.answers;
  return choiceRounds.filter(
    (round, index) =>
      !Array.isArray(answers) || answers[index] !== round.answerIndex,
  );
}

export async function buildGame(
  provider: LlmProvider,
  prompt: string,
  signal?: AbortSignal,
) {
  let request = prompt;
  let totalDisputed = 0;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1 && Date.now() - startedAt > RETRY_CUTOFF_MS) {
      break;
    }

    const { model, text } = await provider.generate({
      system: GAME_DESIGN_SYSTEM_PROMPT,
      prompt: request,
      schema: GAME_SPEC_SCHEMA,
      signal,
    });

    const parsed = parseGameSpec(parseJson(text));
    if ("errors" in parsed) {
      request = `${prompt}

Your last design had these problems:
- ${parsed.errors.join("\n- ")}

Write the complete design again and fix them.`;
      continue;
    }

    const disputed = await findDisputedRounds(provider, parsed.spec, signal);
    totalDisputed += disputed.length;
    const rounds = parsed.spec.rounds.filter(
      (round) => !disputed.includes(round as ChoiceRound),
    );

    if (rounds.length >= MIN_ROUNDS) {
      const spec = { ...parsed.spec, rounds };
      return {
        provider: provider.id,
        model,
        text: await renderGame(spec),
        spec,
        attempts: attempt,
        disputedRounds: totalDisputed,
      };
    }

    request = `${prompt}

These questions from your last design had the wrong answer marked as correct:
- ${disputed.map((round) => round.prompt).join("\n- ")}

Write the complete design again. Work out each answer carefully in its explanation first, then check that answerIndex points to that answer.`;
  }

  throw new ProviderRequestError(
    "Envision couldn't confirm the answers for this game, so it wasn't built. Try a simpler topic or a different AI provider.",
  );
}
