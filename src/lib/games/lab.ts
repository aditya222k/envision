import { THEMES, type Character, type GameSpec, type Theme } from "./spec";

export const LAB_KITS = ["bodies", "systems", "decide", "arrange"] as const;
export type LabKit = (typeof LAB_KITS)[number];

export const BODY_MISSIONS = [
  "orbit",
  "two_orbits",
  "resize_keep_orbit",
  "collide",
  "escape",
] as const;

export type BodyType = {
  name: string;
  mass: number;
  color: string;
  charge: number;
};

export type BodiesLab = {
  kit: "bodies";
  force: "gravity" | "electric";
  bodyTypes: BodyType[];
  missions: { goal: (typeof BODY_MISSIONS)[number]; text: string }[];
  tips: string[];
};

export type SystemsLab = {
  kit: "systems";
  variables: { id: string; label: string; start: number; max: number }[];
  controls: {
    id: string;
    label: string;
    value: number;
    min: number;
    max: number;
  }[];
  rules: { variable: string; change: string }[];
  missions: {
    variable: string;
    atLeast: number;
    atMost: number;
    holdSeconds: number;
    text: string;
  }[];
  tips: string[];
};

export type DecideLab = {
  kit: "decide";
  meters: { id: string; label: string; start: number }[];
  scenes: {
    id: string;
    text: string;
    choices: {
      text: string;
      consequence: string;
      next: string;
      meterId: string;
      meterChange: number;
    }[];
  }[];
  endings: { meter: string; atLeast: number; text: string }[];
  defaultEnding: string;
};

export type ArrangeActivity = {
  kind: "order" | "sort";
  instruction: string;
  items: { text: string; group: string }[];
  groups: string[];
  explanation: string;
};

export type ArrangeLab = {
  kit: "arrange";
  activities: ArrangeActivity[];
};

export type LabConfig = BodiesLab | SystemsLab | DecideLab | ArrangeLab;

const name = { type: "string", minLength: 1, maxLength: 40 };
const sentence = { type: "string", minLength: 1, maxLength: 280 };
const shared = {
  title: { type: "string", minLength: 1, maxLength: 80 },
  learningGoal: sentence,
  intro: sentence,
  theme: { type: "string", enum: THEMES },
  tips: { type: "array", items: sentence, minItems: 2, maxItems: 4 },
};

const character = {
  type: "object",
  properties: { name, emoji: { type: "string", minLength: 1, maxLength: 8 } },
  required: ["name", "emoji"],
};

const storyGame = {
  title: shared.title,
  learningGoal: shared.learningGoal,
  intro: shared.intro,
  theme: shared.theme,
  player: character,
  challenger: character,
};

export const LAB_SCHEMAS: Record<LabKit, object> = {
  decide: {
    type: "object",
    properties: {
      ...storyGame,
      meters: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^[a-z][a-z_]{0,15}$" },
            label: name,
            start: { type: "integer", minimum: 0, maximum: 100 },
          },
          required: ["id", "label", "start"],
        },
      },
      scenes: {
        type: "array",
        minItems: 3,
        maxItems: 6,
        items: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^[a-z0-9_]{1,16}$" },
            text: sentence,
            choices: {
              type: "array",
              minItems: 2,
              maxItems: 3,
              items: {
                type: "object",
                properties: {
                  text: { type: "string", minLength: 1, maxLength: 200 },
                  consequence: sentence,
                  next: { type: "string" },
                  meterId: { type: "string" },
                  meterChange: { type: "integer", minimum: -40, maximum: 40 },
                },
                required: ["text", "consequence", "next", "meterId", "meterChange"],
              },
            },
          },
          required: ["id", "text", "choices"],
        },
      },
      endings: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            meter: { type: "string" },
            atLeast: { type: "integer", minimum: 0, maximum: 100 },
            text: sentence,
          },
          required: ["meter", "atLeast", "text"],
        },
      },
      defaultEnding: sentence,
    },
    required: [
      "title",
      "learningGoal",
      "intro",
      "theme",
      "player",
      "challenger",
      "meters",
      "scenes",
      "endings",
      "defaultEnding",
    ],
  },
  arrange: {
    type: "object",
    properties: {
      ...storyGame,
      activities: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            kind: { type: "string", enum: ["order", "sort"] },
            instruction: sentence,
            explanation: sentence,
            items: {
              type: "array",
              minItems: 4,
              maxItems: 8,
              items: {
                type: "object",
                properties: {
                  text: { type: "string", minLength: 1, maxLength: 60 },
                  group: { type: "string", maxLength: 40 },
                },
                required: ["text", "group"],
              },
            },
            groups: { type: "array", maxItems: 3, items: name },
          },
          required: ["kind", "instruction", "explanation", "items", "groups"],
        },
      },
    },
    required: [
      "title",
      "learningGoal",
      "intro",
      "theme",
      "player",
      "challenger",
      "activities",
    ],
  },
  bodies: {
    type: "object",
    properties: {
      ...shared,
      force: { type: "string", enum: ["gravity", "electric"] },
      bodyTypes: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            name,
            mass: { type: "number", minimum: 1, maximum: 1000 },
            color: { type: "string", pattern: "^#[0-9a-fA-F]{6}$" },
            charge: { type: "integer", minimum: -1, maximum: 1 },
          },
          required: ["name", "mass", "color", "charge"],
        },
      },
      missions: {
        type: "array",
        minItems: 3,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            goal: { type: "string", enum: BODY_MISSIONS },
            text: sentence,
          },
          required: ["goal", "text"],
        },
      },
    },
    required: [
      "title",
      "learningGoal",
      "intro",
      "theme",
      "force",
      "bodyTypes",
      "missions",
      "tips",
    ],
  },
  systems: {
    type: "object",
    properties: {
      ...shared,
      variables: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^[a-z][a-z_]{0,15}$" },
            label: name,
            start: { type: "number", minimum: 0 },
            max: { type: "number", minimum: 1 },
          },
          required: ["id", "label", "start", "max"],
        },
      },
      controls: {
        type: "array",
        minItems: 1,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            id: { type: "string", pattern: "^[a-z][a-z_]{0,15}$" },
            label: name,
            value: { type: "number" },
            min: { type: "number" },
            max: { type: "number" },
          },
          required: ["id", "label", "value", "min", "max"],
        },
      },
      rules: {
        type: "array",
        minItems: 1,
        maxItems: 3,
        items: {
          type: "object",
          properties: {
            variable: { type: "string" },
            change: { type: "string", maxLength: 120 },
          },
          required: ["variable", "change"],
        },
      },
      missions: {
        type: "array",
        minItems: 2,
        maxItems: 4,
        items: {
          type: "object",
          properties: {
            variable: { type: "string" },
            atLeast: { type: "number" },
            atMost: { type: "number" },
            holdSeconds: { type: "number", minimum: 1, maximum: 30 },
            text: sentence,
          },
          required: ["variable", "atLeast", "atMost", "holdSeconds", "text"],
        },
      },
    },
    required: [
      "title",
      "learningGoal",
      "intro",
      "theme",
      "variables",
      "controls",
      "rules",
      "missions",
      "tips",
    ],
  },
};

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function isExpression(text: string, ids: Set<string>) {
  if (!/^[\sa-z_0-9.+\-*/()]+$/.test(text)) {
    return false;
  }
  let depth = 0;
  for (const character of text) {
    depth += character === "(" ? 1 : character === ")" ? -1 : 0;
    if (depth < 0) {
      return false;
    }
  }
  return (
    depth === 0 &&
    (text.match(/[a-z_]+/g) ?? []).every((word) => ids.has(word))
  );
}

function parseDecide(draft: Record<string, never>): DecideLab | null {
  const lab = draft as unknown as DecideLab;
  if (
    !Array.isArray(lab.meters) ||
    !Array.isArray(lab.scenes) ||
    !Array.isArray(lab.endings) ||
    !isFilled(lab.defaultEnding) ||
    lab.meters.length === 0 ||
    lab.scenes.length === 0
  ) {
    return null;
  }
  const meterIds = new Set(lab.meters.map((meter) => meter.id));
  const sceneIds = new Set(lab.scenes.map((scene) => scene.id));
  const isValid =
    lab.scenes.every(
      (scene) =>
        isFilled(scene.text) &&
        scene.choices?.length >= 2 &&
        scene.choices.every(
          (choice) =>
            isFilled(choice.text) &&
            isFilled(choice.consequence) &&
            meterIds.has(choice.meterId) &&
            (choice.next === "end" || sceneIds.has(choice.next)),
        ),
    ) && lab.endings.every((ending) => meterIds.has(ending.meter));
  if (!isValid) {
    return null;
  }

  // Every path has to reach an ending, or a student could loop forever.
  const canFinish = new Set<string>();
  for (let pass = 0; pass < lab.scenes.length; pass++) {
    for (const scene of lab.scenes) {
      if (
        scene.choices.some(
          (choice) => choice.next === "end" || canFinish.has(choice.next),
        )
      ) {
        canFinish.add(scene.id);
      }
    }
  }
  if (!canFinish.has(lab.scenes[0].id)) {
    return null;
  }

  return {
    kit: "decide",
    meters: lab.meters,
    scenes: lab.scenes,
    endings: [...lab.endings].sort((a, b) => b.atLeast - a.atLeast),
    defaultEnding: lab.defaultEnding,
  };
}

function parseArrange(draft: Record<string, never>): ArrangeLab | null {
  const lab = draft as unknown as ArrangeLab;
  if (!Array.isArray(lab.activities)) {
    return null;
  }
  const activities = lab.activities.filter((activity) => {
    const texts = activity.items?.map((item) => item.text) ?? [];
    const groups = activity.groups ?? [];
    return (
      isFilled(activity.instruction) &&
      isFilled(activity.explanation) &&
      texts.length >= 3 &&
      new Set(texts).size === texts.length &&
      (activity.kind === "order" ||
        (activity.kind === "sort" &&
          groups.length >= 2 &&
          activity.items.every((item) => groups.includes(item.group))))
    );
  });
  return activities.length > 0 ? { kit: "arrange", activities } : null;
}

function parseConfig(kit: LabKit, draft: Record<string, never>) {
  const tips = Array.isArray(draft.tips) ? (draft.tips as string[]) : [];

  if (kit === "decide") {
    return parseDecide(draft);
  }
  if (kit === "arrange") {
    return parseArrange(draft);
  }

  if (kit === "bodies") {
    const lab = draft as unknown as BodiesLab;
    if (
      !["gravity", "electric"].includes(lab.force) ||
      !Array.isArray(lab.bodyTypes) ||
      lab.bodyTypes.length < 2 ||
      !lab.bodyTypes.every((type) => isFilled(type.name) && type.mass > 0) ||
      !Array.isArray(lab.missions) ||
      lab.missions.length === 0 ||
      !lab.missions.every(
        (mission) =>
          BODY_MISSIONS.includes(mission.goal) && isFilled(mission.text),
      )
    ) {
      return null;
    }
    return {
      kit,
      force: lab.force,
      bodyTypes: lab.bodyTypes,
      missions: lab.missions,
      tips,
    } satisfies BodiesLab;
  }

  const lab = draft as unknown as SystemsLab;
  if (
    !Array.isArray(lab.variables) ||
    !Array.isArray(lab.controls) ||
    !Array.isArray(lab.rules) ||
    !Array.isArray(lab.missions)
  ) {
    return null;
  }
  const variableIds = new Set(lab.variables.map((item) => item.id));
  const ids = new Set([
    ...variableIds,
    ...lab.controls.map((item) => item.id),
  ]);
  if (
    lab.variables.length === 0 ||
    lab.rules.length === 0 ||
    lab.missions.length === 0 ||
    !lab.rules.every(
      (rule) =>
        variableIds.has(rule.variable) && isExpression(rule.change, ids),
    ) ||
    !lab.missions.every(
      (mission) => variableIds.has(mission.variable) && isFilled(mission.text),
    )
  ) {
    return null;
  }
  return {
    kit,
    variables: lab.variables,
    controls: lab.controls,
    rules: lab.rules,
    missions: lab.missions,
    tips,
  } satisfies SystemsLab;
}

// Turns model output into a game. Labs share the game record, so the catalog,
// versions and publishing all work the same way.
export function parseLabSpec(kit: LabKit, value: unknown): GameSpec | null {
  const draft = value as Record<string, never>;
  if (
    !isFilled(draft?.title) ||
    !isFilled(draft.learningGoal) ||
    !isFilled(draft.intro) ||
    !THEMES.includes(draft.theme as Theme)
  ) {
    return null;
  }
  const lab = parseConfig(kit, draft);
  if (!lab) {
    return null;
  }

  return {
    title: (draft.title as string).trim(),
    learningGoal: (draft.learningGoal as string).trim(),
    mechanic: "journey",
    theme: draft.theme as Theme,
    player: isFilled((draft.player as Character | undefined)?.name)
      ? (draft.player as Character)
      : { name: "You", emoji: "🧑‍🔬" },
    challenger: isFilled((draft.challenger as Character | undefined)?.name)
      ? (draft.challenger as Character)
      : { name: "The lab", emoji: "🧪" },
    story: {
      intro: (draft.intro as string).trim(),
      win: "You finished every mission.",
      lose: "",
    },
    rounds: [],
    lab,
  };
}
