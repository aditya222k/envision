import { LAB_BUILD_SYSTEM_PROMPT, LAB_CHANGE_SYSTEM_PROMPT } from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import { readDraft } from "./draft";
import {
  describeLabProblems,
  LAB_SCHEMAS,
  parseLabSpec,
  type LabKit,
} from "./lab";
import {
  checkDecide,
  checkSystems,
  findDoubtfulActivities,
} from "./labChecks";
import { parseJson, type EventReporter, type ProgressReporter } from "./pipeline";
import type { GameSpec } from "./spec";

const MAX_ATTEMPTS = 3;
const EXPECTED_CHARACTERS = 1800;

async function findProblems(
  provider: LlmProvider,
  spec: GameSpec,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
) {
  const lab = spec.lab!;
  if (lab.kit === "systems") {
    onProgress({ label: "Testing the simulation", percent: 92 });
    return checkSystems(lab);
  }
  if (lab.kit === "decide") {
    return checkDecide(lab);
  }
  if (lab.kit === "arrange") {
    onProgress({ label: "Checking the answers", percent: 92 });
    const doubtful = await findDoubtfulActivities(provider, lab, signal);
    return doubtful.map(
      (activity) =>
        `The answer to "${activity.instruction}" could not be confirmed. Check its order or groups, or replace it.`,
    );
  }
  return [];
}

async function generateLab(
  provider: LlmProvider,
  kit: LabKit,
  system: string,
  prompt: string,
  label: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
  onEvent: EventReporter,
) {
  let lastDraft = "";
  let feedback = "";

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress({
      label: attempt === 1 ? "Starting the AI model" : `Fixing problems (try ${attempt} of ${MAX_ATTEMPTS})`,
      percent: 5,
    });

    const { model, text } = await provider.generate({
      system,
      prompt: prompt + feedback,
      schema: LAB_SCHEMAS[kit],
      signal,
      onCharacters: (count, partial) => {
        onProgress({
          label,
          percent: 5 + Math.min(count / EXPECTED_CHARACTERS, 1) * 85,
        });
        const draft = JSON.stringify({ ...readDraft(partial), questions: [] });
        if (draft !== lastDraft) {
          lastDraft = draft;
          onEvent({ type: "draft", draft: JSON.parse(draft) });
        }
      },
    });

    const value = parseJson(text);
    const spec = parseLabSpec(kit, value);
    const problems = spec
      ? await findProblems(provider, spec, signal, onProgress)
      : describeLabProblems(kit, value);

    if (spec && problems.length === 0) {
      onProgress({ label: "Finishing your lab", percent: 97 });
      return { model, spec };
    }

    console.warn(`Lab attempt ${attempt} rejected:`, problems);
    feedback = `\n\nYour last design had these problems. Fix every one and reply with the complete design:\n- ${problems.join("\n- ")}`;
  }

  throw new ProviderRequestError(
    "Envision couldn't make that game work properly. Add more detail, or choose a different type of game.",
  );
}

export function buildLab(
  provider: LlmProvider,
  kit: LabKit,
  prompt: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
  onEvent: EventReporter,
) {
  return generateLab(
    provider,
    kit,
    LAB_BUILD_SYSTEM_PROMPT[kit],
    prompt,
    "Designing your lab",
    signal,
    onProgress,
    onEvent,
  );
}

export function reviseLab(
  provider: LlmProvider,
  spec: GameSpec,
  instruction: string,
  signal: AbortSignal | undefined,
  onProgress: ProgressReporter,
  onEvent: EventReporter,
) {
  const kit = spec.lab!.kit;
  return generateLab(
    provider,
    kit,
    `${LAB_BUILD_SYSTEM_PROMPT[kit]}\n\n${LAB_CHANGE_SYSTEM_PROMPT}`,
    `Current lab:
${JSON.stringify({ title: spec.title, learningGoal: spec.learningGoal, intro: spec.story.intro, theme: spec.theme, player: spec.player, challenger: spec.challenger, ...spec.lab })}

Teacher's change: ${instruction}`,
    "Making your change",
    signal,
    onProgress,
    onEvent,
  );
}
