import {
  CUSTOM_BUILD_SYSTEM_PROMPT,
  CUSTOM_PLAN_SYSTEM_PROMPT,
  CUSTOM_REVIEW_SYSTEM_PROMPT,
} from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import { parseJson, type EventReporter, type ProgressReporter } from "./pipeline";
import { playtest } from "./playtest";
import { lockDown } from "./render";
import type { GameSpec } from "./spec";

const MAX_ATTEMPTS = 2;
const MAX_CODE_TOKENS = 9000;
const EXPECTED_CHARACTERS = 14000;

export type CustomPlan = {
  title: string;
  learningGoal: string;
  concept: string;
  truths: string[];
  interactions: string[];
  winCondition: string;
};

const PLAN_SCHEMA = {
  type: "object",
  properties: {
    title: { type: "string", minLength: 1, maxLength: 80 },
    learningGoal: { type: "string", minLength: 1, maxLength: 240 },
    concept: { type: "string", minLength: 1, maxLength: 400 },
    truths: {
      type: "array",
      minItems: 2,
      maxItems: 8,
      items: { type: "string", minLength: 1, maxLength: 200 },
    },
    interactions: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 160 },
    },
    winCondition: { type: "string", minLength: 1, maxLength: 200 },
  },
  required: [
    "title",
    "learningGoal",
    "concept",
    "truths",
    "interactions",
    "winCondition",
  ],
};

const REVIEW_SCHEMA = {
  type: "object",
  properties: {
    problems: {
      type: "array",
      maxItems: 6,
      items: { type: "string", minLength: 1, maxLength: 240 },
    },
  },
  required: ["problems"],
};

function extractHtml(text: string) {
  const start = text.search(/<!doctype html|<html/i);
  const end = text.toLowerCase().lastIndexOf("</html>");
  return start >= 0 && end > start ? text.slice(start, end + 7) : null;
}

async function writeGame(
  provider: LlmProvider,
  request: string,
  label: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
) {
  const { model, text } = await provider.generate({
    system: CUSTOM_BUILD_SYSTEM_PROMPT,
    prompt: request,
    maxTokens: MAX_CODE_TOKENS,
    signal,
    onCharacters: (count) =>
      onProgress({
        label,
        percent: 15 + Math.min(count / EXPECTED_CHARACTERS, 1) * 55,
      }),
  });
  return { model, html: extractHtml(text) };
}

async function reviewGame(
  provider: LlmProvider,
  planText: string,
  html: string,
  signal?: AbortSignal,
) {
  const { text } = await provider.generate({
    system: CUSTOM_REVIEW_SYSTEM_PROMPT,
    prompt: `Plan:\n${planText}\n\nGame code:\n${html}`,
    schema: REVIEW_SCHEMA,
    think: true,
    signal,
  });
  const problems = (parseJson(text) as { problems?: unknown })?.problems;
  return Array.isArray(problems)
    ? problems.filter((item): item is string => typeof item === "string")
    : [];
}

async function improveUntilPlayable(
  provider: LlmProvider,
  firstRequest: string,
  planText: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
) {
  let request = firstRequest;
  let best: { model: string; html: string } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    const { model, html } = await writeGame(
      provider,
      request,
      attempt === 1 ? "Writing your game" : "Fixing what the tests found",
      signal,
      onProgress,
    );
    if (!html) {
      request = `${firstRequest}\n\nYour last reply was not a complete HTML document. It must start with <!doctype html> and end with </html>. Keep the code shorter.`;
      continue;
    }

    onProgress({ label: "Playtesting your game", percent: 74 });
    const test = await playtest(lockDown(html));
    if (test.problems.length === 0) {
      best = { model, html };
    }

    onProgress({ label: "Reviewing the game against its rules", percent: 82 });
    const review =
      test.problems.length === 0
        ? await reviewGame(provider, planText, html, signal)
        : [];
    const problems = [...test.problems, ...review];
    if (problems.length === 0) {
      return { model, html, notes: [] as string[] };
    }

    console.warn(`Custom game attempt ${attempt}:`, problems);
    request = `${firstRequest}\n\nHere is your last version:\n${html}\n\nFix every problem below and reply with the complete game:\n- ${problems.join("\n- ")}`;
    if (attempt === MAX_ATTEMPTS && best) {
      return { ...best, notes: review };
    }
  }

  throw new ProviderRequestError(
    "Envision couldn't get that game working. Try a simpler idea, or choose another type of game.",
  );
}

export async function buildCustomGame(
  provider: LlmProvider,
  prompt: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
  onEvent: EventReporter,
) {
  onProgress({ label: "Thinking through the lesson", percent: 8 });
  const { text } = await provider.generate({
    system: CUSTOM_PLAN_SYSTEM_PROMPT,
    prompt,
    schema: PLAN_SCHEMA,
    think: true,
    signal,
  });
  const plan = parseJson(text) as CustomPlan | null;
  if (!plan?.title || !Array.isArray(plan.truths)) {
    throw new ProviderRequestError(
      "Envision couldn't plan that game. Add more detail and try again.",
    );
  }

  onEvent({
    type: "draft",
    draft: { title: plan.title, intro: plan.concept, questions: plan.truths },
  });

  const planText = JSON.stringify(plan);
  const { model, html, notes } = await improveUntilPlayable(
    provider,
    `Teacher's idea:\n${prompt}\n\nYour plan:\n${planText}`,
    planText,
    signal,
    onProgress,
  );

  onProgress({ label: "Finishing your game", percent: 97 });
  return { model, html, plan, notes };
}

export async function reviseCustomGame(
  provider: LlmProvider,
  spec: GameSpec,
  instruction: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
) {
  const planText = JSON.stringify(spec.custom!.plan);
  return improveUntilPlayable(
    provider,
    `Plan:\n${planText}\n\nCurrent game:\n${spec.custom!.html}\n\nTeacher's change: ${instruction}\n\nReply with the complete game, keeping everything else the same.`,
    planText,
    signal,
    onProgress,
  );
}

export function customSpec(
  plan: CustomPlan,
  html: string,
  notes: string[],
): GameSpec {
  return {
    title: plan.title,
    learningGoal: plan.learningGoal,
    mechanic: "journey",
    theme: "lab",
    player: { name: "You", emoji: "🧑‍🎓" },
    challenger: { name: "The challenge", emoji: "🎯" },
    story: { intro: plan.concept, win: plan.winCondition, lose: "" },
    rounds: [],
    custom: { html, plan, notes },
  };
}
