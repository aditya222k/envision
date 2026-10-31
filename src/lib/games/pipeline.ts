import {
  ANSWER_CHECK_SYSTEM_PROMPT,
  GAME_DESIGN_SYSTEM_PROMPT,
} from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import {
  GAME_SPEC_SCHEMA,
  MIN_ROUNDS,
  parseGameSpec,
  type ChoiceRound,
  type Round,
} from "./spec";

const MAX_ATTEMPTS = 3;
const RETRY_CUTOFF_MS = 3 * 60 * 1000;
const EXPECTED_DESIGN_CHARACTERS = 3500;

export type BuildProgress = {
  label: string;
  percent: number;
};

export type ProgressReporter = (progress: BuildProgress) => void;

export function parseJson(text: string): unknown {
  try {
    return JSON.parse(text);
  } catch {
    return null;
  }
}

// Asks the model to answer without seeing the key. A round it disagrees with
// counts as disputed, including when the check returns nothing usable.
export async function findDisputedRounds(
  provider: LlmProvider,
  rounds: Round[],
  signal?: AbortSignal,
) {
  const choiceRounds = rounds.filter(
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

// The first attempt fills most of the bar. A retry moves it on more slowly, so
// it never jumps backward.
function attemptRange(attempt: number) {
  return attempt === 1
    ? { start: 5, end: 75 }
    : { start: 75 + (attempt - 2) * 6, end: 81 + (attempt - 2) * 6 };
}

export async function buildGame(
  provider: LlmProvider,
  prompt: string,
  signal?: AbortSignal,
  onProgress: ProgressReporter = () => {},
) {
  let request = prompt;
  let totalDisputed = 0;
  const startedAt = Date.now();

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    if (attempt > 1 && Date.now() - startedAt > RETRY_CUTOFF_MS) {
      break;
    }

    const { start, end } = attemptRange(attempt);
    const label =
      attempt === 1
        ? "Designing your game"
        : `Fixing problems (try ${attempt} of ${MAX_ATTEMPTS})`;
    onProgress({
      label: attempt === 1 ? "Starting the AI model" : label,
      percent: start,
    });

    const { model, text } = await provider.generate({
      system: GAME_DESIGN_SYSTEM_PROMPT,
      prompt: request,
      schema: GAME_SPEC_SCHEMA,
      signal,
      onCharacters: (count) =>
        onProgress({
          label,
          percent:
            start +
            Math.min(count / EXPECTED_DESIGN_CHARACTERS, 1) * (end - start),
        }),
    });

    const parsed = parseGameSpec(parseJson(text));
    if ("errors" in parsed) {
      request = `${prompt}

Your last design had these problems:
- ${parsed.errors.join("\n- ")}

Write the complete design again and fix them.`;
      continue;
    }

    onProgress({ label: "Checking the answers", percent: 90 });
    const disputed = await findDisputedRounds(
      provider,
      parsed.spec.rounds,
      signal,
    );
    totalDisputed += disputed.length;
    const rounds = parsed.spec.rounds.filter(
      (round) => !disputed.includes(round as ChoiceRound),
    );

    if (rounds.length >= MIN_ROUNDS) {
      onProgress({ label: "Finishing your game", percent: 97 });
      return {
        model,
        spec: { ...parsed.spec, rounds },
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
