import { LAB_CHECK_SYSTEM_PROMPT } from "@/lib/llm/prompt";
import type { LlmProvider } from "@/lib/llm/types";
import type { ArrangeActivity, ArrangeLab, DecideLab } from "./lab";
import { parseJson } from "./pipeline";

export function checkDecide(lab: DecideLab) {
  const problems: string[] = [];
  const used = new Set(
    lab.scenes.flatMap((scene) => scene.choices.map((choice) => choice.meterId)),
  );
  lab.meters
    .filter((meter) => !used.has(meter.id))
    .forEach((meter) =>
      problems.push(`No choice changes the ${meter.id} meter. Use it or remove it.`),
    );

  const scenePositions = new Map(lab.scenes.map((scene, index) => [scene.id, index]));
  lab.scenes.forEach((scene, index) => {
    scene.choices.forEach((choice) => {
      const target = scenePositions.get(choice.next);
      if (target !== undefined && target <= index) {
        problems.push(`A choice in ${scene.id} leads back to ${choice.next}. Choices may only move forward.`);
      }
    });
    if (scene.choices.every((choice) => choice.next === scene.choices[0].next) && index === 0) {
      problems.push("The first scene's choices all lead to the same place. Make at least one branch differently.");
    }
  });

  return problems;
}

function shuffled<Item>(items: Item[]) {
  return items
    .map((item) => ({ item, sort: Math.random() }))
    .sort((a, b) => a.sort - b.sort)
    .map(({ item }) => item);
}

async function isActivityRight(
  provider: LlmProvider,
  activity: ArrangeActivity,
  signal?: AbortSignal,
) {
  const items = shuffled(activity.items);
  const isOrder = activity.kind === "order";

  const { text } = await provider.generate({
    system: LAB_CHECK_SYSTEM_PROMPT,
    signal,
    prompt: isOrder
      ? `${activity.instruction}\n\nItems:\n${items
          .map((item) => `- ${item.text}`)
          .join("\n")}`
      : `${activity.instruction}\n\nGroups: ${activity.groups.join(", ")}\n\nItems:\n${items
          .map((item) => `- ${item.text}`)
          .join("\n")}`,
    schema: isOrder
      ? {
          type: "object",
          properties: {
            order: {
              type: "array",
              items: { type: "string", enum: items.map((item) => item.text) },
              minItems: items.length,
              maxItems: items.length,
            },
          },
          required: ["order"],
        }
      : {
          type: "object",
          properties: {
            placements: {
              type: "array",
              minItems: items.length,
              maxItems: items.length,
              items: {
                type: "object",
                properties: {
                  item: { type: "string", enum: items.map((item) => item.text) },
                  group: { type: "string", enum: activity.groups },
                },
                required: ["item", "group"],
              },
            },
          },
          required: ["placements"],
        },
  });

  const answer = parseJson(text) as {
    order?: string[];
    placements?: { item: string; group: string }[];
  } | null;

  if (isOrder) {
    return (
      answer?.order?.join("|") ===
      activity.items.map((item) => item.text).join("|")
    );
  }
  return activity.items.every(
    (item) =>
      answer?.placements?.find((placed) => placed.item === item.text)?.group ===
      item.group,
  );
}

// Solves each activity without the answer, so wrong orders never reach students.
export async function findDoubtfulActivities(
  provider: LlmProvider,
  lab: ArrangeLab,
  signal?: AbortSignal,
) {
  const results = [];
  for (const activity of lab.activities) {
    results.push({
      activity,
      isRight: await isActivityRight(provider, activity, signal),
    });
  }
  return results
    .filter((result) => !result.isRight)
    .map((result) => result.activity);
}
