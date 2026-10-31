import { LAB_CHECK_SYSTEM_PROMPT } from "@/lib/llm/prompt";
import type { LlmProvider } from "@/lib/llm/types";
import type { ArrangeActivity, ArrangeLab, DecideLab, SystemsLab } from "./lab";
import { parseJson } from "./pipeline";

const SIMULATED_SECONDS = 30;
const STEP_SECONDS = 0.05;
const TOO_FAST_SECONDS = 4;
const SMALLEST_CHANGE = 0.02;

type Values = Record<string, number>;

// Matches the game's own formula reader, so the check tests what students get.
function compile(text: string) {
  const tokens = text.match(/[a-z_]+|\d+\.?\d*|[+\-*/()]/g) ?? [];
  let position = 0;

  function primary(values: Values): number {
    const token = tokens[position++];
    if (token === "(") {
      const inner = expression(values);
      position++;
      return inner;
    }
    if (token === "-") {
      return -primary(values);
    }
    return /^\d/.test(token ?? "") ? Number(token) : (values[token] ?? 0);
  }

  function term(values: Values) {
    let result = primary(values);
    while (tokens[position] === "*" || tokens[position] === "/") {
      const operator = tokens[position++];
      const next = primary(values);
      result = operator === "*" ? result * next : next ? result / next : 0;
    }
    return result;
  }

  function expression(values: Values): number {
    let result = term(values);
    while (tokens[position] === "+" || tokens[position] === "-") {
      const operator = tokens[position++];
      const next = term(values);
      result = operator === "+" ? result + next : result - next;
    }
    return result;
  }

  return (values: Values) => {
    position = 0;
    const result = expression(values);
    return Number.isFinite(result) ? result : 0;
  };
}

function simulate(lab: SystemsLab, overrides: Values = {}) {
  const values: Values = {};
  const firstLimit: Record<string, number | null> = {};
  const lowest: Values = {};
  const highest: Values = {};
  lab.controls.forEach((control) => {
    values[control.id] = overrides[control.id] ?? control.value;
  });
  lab.variables.forEach((variable) => {
    values[variable.id] = variable.start;
    firstLimit[variable.id] = null;
    lowest[variable.id] = variable.start;
    highest[variable.id] = variable.start;
  });

  const rules = lab.rules.map((rule) => ({
    variable: lab.variables.find((item) => item.id === rule.variable)!,
    change: compile(rule.change),
  }));

  for (let time = 0; time < SIMULATED_SECONDS; time += STEP_SECONDS) {
    const changes = rules.map((rule) => rule.change(values));
    rules.forEach(({ variable }, index) => {
      const next = values[variable.id] + changes[index] * STEP_SECONDS;
      values[variable.id] = Math.min(Math.max(next, 0), variable.max);
      lowest[variable.id] = Math.min(lowest[variable.id], values[variable.id]);
      highest[variable.id] = Math.max(highest[variable.id], values[variable.id]);
      if (
        firstLimit[variable.id] === null &&
        (values[variable.id] <= 0 || values[variable.id] >= variable.max)
      ) {
        firstLimit[variable.id] = time;
      }
    });
  }

  return { values, firstLimit, lowest, highest };
}

// Runs the model's formulas, because a formula can be valid and still be useless.
export function checkSystems(lab: SystemsLab) {
  const problems: string[] = [];
  const normal = simulate(lab);

  lab.variables.forEach((variable) => {
    const limit = normal.firstLimit[variable.id];
    const range = normal.highest[variable.id] - normal.lowest[variable.id];
    if (limit !== null && limit < TOO_FAST_SECONDS && variable.start > 0) {
      problems.push(
        `${variable.id} reaches its limit after only ${limit.toFixed(1)} seconds. Use smaller numbers in the rules, so it changes over about 30 seconds.`,
      );
    }
    if (range < variable.max * SMALLEST_CHANGE) {
      problems.push(
        `${variable.id} barely changes. Use larger numbers in its rule, or give it a rule.`,
      );
    }
  });

  lab.controls.forEach((control) => {
    const moved = control.value === control.max ? control.min : control.max;
    const changed = simulate(lab, { [control.id]: moved });
    const hasEffect = lab.variables.some(
      (variable) =>
        Math.abs(changed.values[variable.id] - normal.values[variable.id]) >
        variable.max * 0.01,
    );
    if (!hasEffect) {
      problems.push(
        `The ${control.id} slider has no effect. Use it in a rule so that moving it changes the graph.`,
      );
    }
    if (control.value < control.min || control.value > control.max) {
      problems.push(`${control.id} must start between its min and max.`);
    }
  });

  return problems;
}

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
