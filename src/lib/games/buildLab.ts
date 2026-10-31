import { LAB_BUILD_SYSTEM_PROMPT, LAB_CHANGE_SYSTEM_PROMPT } from "@/lib/llm/prompt";
import { ProviderRequestError, type LlmProvider } from "@/lib/llm/types";
import { readDraft } from "./draft";
import { LAB_SCHEMAS, parseLabSpec, type LabKit } from "./lab";
import { parseJson, type EventReporter, type ProgressReporter } from "./pipeline";
import type { GameSpec } from "./spec";

const MAX_ATTEMPTS = 2;
const EXPECTED_CHARACTERS = 1200;

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

  for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
    onProgress({ label: "Starting the AI model", percent: 5 });

    const { model, text } = await provider.generate({
      system,
      prompt,
      schema: LAB_SCHEMAS[kit],
      signal,
      onCharacters: (count, partial) => {
        onProgress({
          label,
          percent: 5 + Math.min(count / EXPECTED_CHARACTERS, 1) * 88,
        });
        const draft = JSON.stringify({ ...readDraft(partial), questions: [] });
        if (draft !== lastDraft) {
          lastDraft = draft;
          onEvent({ type: "draft", draft: JSON.parse(draft) });
        }
      },
    });

    const spec = parseLabSpec(kit, parseJson(text));
    if (spec) {
      onProgress({ label: "Finishing your lab", percent: 97 });
      return { model, spec };
    }
    console.warn("Lab design rejected:", text.slice(0, 600));
  }

  throw new ProviderRequestError(
    "Envision couldn't design that lab. Add more detail, or choose a different type of game.",
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
    LAB_CHANGE_SYSTEM_PROMPT,
    `Current lab:
${JSON.stringify({ title: spec.title, learningGoal: spec.learningGoal, intro: spec.story.intro, theme: spec.theme, ...spec.lab })}

Teacher's change: ${instruction}`,
    "Making your change",
    signal,
    onProgress,
    onEvent,
  );
}
