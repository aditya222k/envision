import {
  CUSTOM_3D_SYSTEM_PROMPT,
  CUSTOM_BUILD_SYSTEM_PROMPT,
  CUSTOM_FIX_SYSTEM_PROMPT,
  CUSTOM_PLAN_SYSTEM_PROMPT,
  CUSTOM_REVIEW_SYSTEM_PROMPT,
} from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import { parseJson, type EventReporter, type ProgressReporter } from "./pipeline";
import { playtest } from "./playtest";
import { lockDown, render3dGame } from "./render";
import {
  correctThreeNames,
  explainMissingMethods,
  threeReference,
} from "./threeReference";
import type { GameSpec } from "./spec";

type CustomKind = "3d" | undefined;

const MAX_ATTEMPTS = 2;
const MAX_REPAIRS = 4;
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

const REPAIR_SCHEMA = {
  type: "object",
  properties: {
    edits: {
      type: "array",
      minItems: 1,
      maxItems: 6,
      items: {
        type: "object",
        properties: {
          find: { type: "string", minLength: 1 },
          replace: { type: "string" },
        },
        required: ["find", "replace"],
      },
    },
  },
  required: ["edits"],
};

function extractHtml(text: string) {
  const start = text.search(/<!doctype html|<html/i);
  const end = text.toLowerCase().lastIndexOf("</html>");
  return start >= 0 && end > start ? text.slice(start, end + 7) : null;
}

function extractScript(text: string) {
  const code = text
    .trim()
    .replace(/^```[a-z]*\s*/i, "")
    .replace(/```\s*$/, "")
    .trim();
  return code.includes("Envision3D.start") ? code : null;
}

async function writeGame(
  provider: LlmProvider,
  request: string,
  label: string,
  kind: CustomKind,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
) {
  const { model, text } = await provider.generate({
    system:
      kind === "3d"
        ? `${CUSTOM_3D_SYSTEM_PROMPT}\n\n${threeReference()}`
        : CUSTOM_BUILD_SYSTEM_PROMPT,
    prompt: request,
    maxTokens: MAX_CODE_TOKENS,
    signal,
    onCharacters: (count) =>
      onProgress({
        label,
        percent: 15 + Math.min(count / EXPECTED_CHARACTERS, 1) * 55,
      }),
  });
  return { model, html: kind === "3d" ? extractScript(text) : extractHtml(text) };
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
    signal,
  });
  const problems = (parseJson(text) as { problems?: unknown })?.problems;
  return Array.isArray(problems)
    ? problems.filter((item): item is string => typeof item === "string")
    : [];
}

function correctCode(html: string, kind: CustomKind) {
  if (kind !== "3d") {
    return html;
  }
  const { corrected, corrections } = correctThreeNames(html);
  if (corrections.length > 0) {
    console.warn("Corrected Three.js names:", corrections);
  }
  return corrected;
}

async function testGame(html: string, title: string, kind: CustomKind) {
  const { problems } = await playtest(
    kind === "3d"
      ? await render3dGame({ title, intro: "", script: html })
      : lockDown(html),
    { is3d: kind === "3d" },
  );
  return problems;
}

// Fixes only what's broken, because a full rewrite is slow and can bring back
// the same mistake. Each repair is tested straight away.
async function repairGame(
  provider: LlmProvider,
  html: string,
  problems: string[],
  kind: CustomKind,
  signal: AbortSignal | undefined,
) {
  const context =
    kind === "3d" ? [...explainMissingMethods(problems)].join("\n") : "";
  const { text } = await provider.generate({
    system: CUSTOM_FIX_SYSTEM_PROMPT,
    prompt: `Code:\n${html}\n\nProblems to fix:\n- ${problems.join("\n- ")}${
      context ? `\n\nReal names:\n${context}` : ""
    }`,
    schema: REPAIR_SCHEMA,
    signal,
  });
  const edits = (parseJson(text) as { edits?: { find: string; replace: string }[] })
    ?.edits;

  let repaired = html;
  const missed: string[] = [];
  (Array.isArray(edits) ? edits : []).forEach(({ find, replace }) => {
    if (find && repaired.includes(find)) {
      repaired = repaired.split(find).join(replace);
    } else {
      missed.push(find);
    }
  });
  return { repaired, missed };
}

async function improveUntilPlayable(
  provider: LlmProvider,
  firstRequest: string,
  planText: string,
  title: string,
  kind: CustomKind,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
) {
  let request = firstRequest;
  let written: { model: string; html: string } | null = null;

  for (let attempt = 1; attempt <= MAX_ATTEMPTS && !written; attempt++) {
    const { model, html } = await writeGame(
      provider,
      request,
      "Writing your game",
      kind,
      signal,
      onProgress,
    );
    if (html) {
      written = { model, html };
    }
    request = `${firstRequest}\n\nYour last reply was not complete. ${
      kind === "3d"
        ? "It must be JavaScript that calls Envision3D.start."
        : "It must start with <!doctype html> and end with </html>."
    } Keep the code shorter.`;
  }
  if (!written) {
    throw new ProviderRequestError(
      "Envision couldn't finish writing that game. Try a simpler idea, or choose another type of game.",
    );
  }

  const { model } = written;
  let html = correctCode(written.html, kind);
  let isReviewed = false;
  let notes: string[] = [];
  let lastPlayable: string | null = null;
  let lastProblem = "";

  for (let round = 0; round <= MAX_REPAIRS; round++) {
    onProgress({ label: "Playtesting your game", percent: 74 + round });
    let problems = await testGame(html, title, kind);

    if (problems.length === 0) {
      lastPlayable = html;
      if (isReviewed) {
        return { model, html, notes: [] as string[] };
      }
      onProgress({ label: "Reviewing the game against its rules", percent: 82 });
      problems = await reviewGame(provider, planText, html, signal);
      isReviewed = true;
      notes = problems;
      if (problems.length === 0) {
        return { model, html, notes };
      }
    }

    console.warn(`Game check, round ${round + 1}:`, problems);
    lastProblem = problems[0];
    if (round === MAX_REPAIRS) {
      break;
    }

    onProgress({ label: `Fixing problems (round ${round + 1})`, percent: 86 });
    const { repaired, missed } = await repairGame(
      provider,
      html,
      problems,
      kind,
      signal,
    );
    if (missed.length > 0) {
      console.warn("Repair text not found in the code:", missed);
    }
    html = correctCode(repaired, kind);
  }

  if (lastPlayable) {
    return { model, html: lastPlayable, notes };
  }
  throw new ProviderRequestError(
    `Envision couldn't get that game working. The last problem was: ${lastProblem} Try again, or choose another type of game.`,
  );
}

export async function buildCustomGame(
  provider: LlmProvider,
  prompt: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
  onEvent: EventReporter,
  kind?: CustomKind,
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
    plan.title,
    kind,
    signal,
    onProgress,
  );

  onProgress({ label: "Finishing your game", percent: 97 });
  return { model, html, plan, notes, kind };
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
    spec.title,
    spec.custom!.kind,
    signal,
    onProgress,
  );
}

export function customSpec(
  plan: CustomPlan,
  html: string,
  notes: string[],
  kind?: CustomKind,
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
    custom: { html, plan, notes, kind },
  };
}
