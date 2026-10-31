import type { LabConfig } from "./lab";

export const MECHANICS = ["journey", "beat-the-clock", "boss-battle"] as const;
export const THEMES = [
  "jungle",
  "space",
  "ocean",
  "city",
  "castle",
  "lab",
] as const;
export const ROUND_KINDS = ["choice", "match"] as const;

export const MIN_PLAYABLE_ROUNDS = 3;
export const MIN_ROUNDS = 5;
export const TARGET_ROUNDS = 6;
export const MAX_ROUNDS = 8;

export type Mechanic = (typeof MECHANICS)[number];
export type Theme = (typeof THEMES)[number];

export type ChoiceRound = {
  kind: "choice";
  prompt: string;
  choices: string[];
  answerIndex: number;
  explanation: string;
};

export type MatchRound = {
  kind: "match";
  prompt: string;
  pairs: { left: string; right: string }[];
  explanation: string;
};

export type Round = ChoiceRound | MatchRound;

export type Character = {
  name: string;
  emoji: string;
};

export type GameSpec = {
  title: string;
  learningGoal: string;
  mechanic: Mechanic;
  theme: Theme;
  player: Character;
  challenger: Character;
  story: {
    intro: string;
    win: string;
    lose: string;
  };
  rounds: Round[];
  lab?: LabConfig;
};

const shortText = { type: "string", minLength: 1, maxLength: 80 };
const longText = { type: "string", minLength: 1, maxLength: 240 };
const character = {
  type: "object",
  properties: {
    name: shortText,
    emoji: { type: "string", minLength: 1, maxLength: 8 },
  },
  required: ["name", "emoji"],
};

const ROUND_SCHEMA = {
  type: "object",
  properties: {
    kind: { type: "string", enum: ROUND_KINDS },
    prompt: longText,
    explanation: longText,
    choices: {
      type: "array",
      items: shortText,
      maxItems: 4,
    },
    answerIndex: { type: "integer", minimum: 0, maximum: 3 },
    pairs: {
      type: "array",
      maxItems: 5,
      items: {
        type: "object",
        properties: { left: shortText, right: shortText },
        required: ["left", "right"],
      },
    },
  },
  required: ["kind", "prompt", "explanation", "choices", "answerIndex", "pairs"],
};

export const GAME_SPEC_SCHEMA = {
  type: "object",
  properties: {
    title: shortText,
    learningGoal: longText,
    mechanic: { type: "string", enum: MECHANICS },
    theme: { type: "string", enum: THEMES },
    player: character,
    challenger: character,
    story: {
      type: "object",
      properties: { intro: longText, win: longText, lose: longText },
      required: ["intro", "win", "lose"],
    },
    rounds: {
      type: "array",
      minItems: TARGET_ROUNDS,
      maxItems: MAX_ROUNDS,
      items: ROUND_SCHEMA,
    },
  },
  required: [
    "title",
    "learningGoal",
    "mechanic",
    "theme",
    "player",
    "challenger",
    "story",
    "rounds",
  ],
};

export const EDITABLE_FIELDS = [
  "title",
  "mechanic",
  "theme",
  "player.name",
  "player.emoji",
  "challenger.name",
  "challenger.emoji",
  "story.intro",
  "story.win",
  "story.lose",
] as const;

export type EditableField = (typeof EDITABLE_FIELDS)[number];

export const CHANGE_ACTIONS = [
  "set_field",
  "replace_round",
  "add_round",
  "remove_round",
] as const;

export const GAME_CHANGES_SCHEMA = {
  type: "object",
  properties: {
    changes: {
      type: "array",
      minItems: 1,
      maxItems: MAX_ROUNDS,
      items: {
        type: "object",
        properties: {
          action: { type: "string", enum: CHANGE_ACTIONS },
          field: { type: "string", enum: EDITABLE_FIELDS },
          value: { type: "string", maxLength: 240 },
          roundNumber: { type: "integer", minimum: 1, maximum: MAX_ROUNDS },
          round: ROUND_SCHEMA,
        },
        required: ["action"],
      },
    },
  },
  required: ["changes"],
};

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function hasDuplicates(values: string[]) {
  const normalized = values.map((value) => value.trim().toLowerCase());
  return new Set(normalized).size !== normalized.length;
}

const SUBSCRIPTS = "₀₁₂₃₄₅₆₇₈₉";

// Models write LaTeX even when told not to, and the game shows plain text.
export function cleanMathText(text: string) {
  return text
    .replace(/[\t\f\r](?=[a-z])/g, (character) =>
      character === "\t" ? "\\t" : character === "\f" ? "\\f" : "\\r",
    )
    .replace(/\$([^$]*[\\_^{][^$]*)\$/g, "$1")
    .replace(/\\(?:rightarrow|to)\b/g, "→")
    .replace(/\\times\b/g, "×")
    .replace(/\\frac\{([^{}]*)\}\{([^{}]*)\}/g, "$1/$2")
    .replace(/\\(?:text|mathrm)\{([^{}]*)\}/g, "$1")
    .replace(/\\sqrt\{([^{}]*)\}/g, "√($1)")
    .replace(/\^\{([^{}]*)\}/g, "^$1")
    .replace(/_\{?(\d+)\}?/g, (_, digits: string) =>
      [...digits].map((digit) => SUBSCRIPTS[Number(digit)]).join(""),
    )
    .replace(/\s+/g, " ")
    .trim();
}

function cleanRoundText(value: unknown) {
  const round = value as Partial<Omit<ChoiceRound, "kind">> &
    Partial<Omit<MatchRound, "kind">> & { kind?: string };
  if (!isFilled(round?.prompt) || !isFilled(round.explanation)) {
    return null;
  }
  return {
    ...round,
    prompt: cleanMathText(round.prompt).replace(/^round \d+\s*[:.-]\s*/i, ""),
    explanation: cleanMathText(round.explanation),
    choices: Array.isArray(round.choices)
      ? round.choices.map((choice) =>
          typeof choice === "string"
            ? cleanMathText(choice).replace(/^[a-d][).:]\s+/i, "")
            : choice,
        )
      : round.choices,
    pairs: Array.isArray(round.pairs)
      ? round.pairs.map((pair) =>
          isFilled(pair?.left) && isFilled(pair?.right)
            ? {
                left: cleanMathText(pair.left),
                right: cleanMathText(pair.right),
              }
            : pair,
        )
      : round.pairs,
  };
}

export function parseRound(value: unknown): Round | null {
  const round = cleanRoundText(value);
  if (!round) {
    return null;
  }

  if (round.kind === "match") {
    const pairs = round.pairs;
    if (
      !Array.isArray(pairs) ||
      pairs.length < 3 ||
      pairs.length > 5 ||
      !pairs.every((pair) => isFilled(pair?.left) && isFilled(pair?.right)) ||
      hasDuplicates(pairs.map((pair) => pair.left)) ||
      hasDuplicates(pairs.map((pair) => pair.right))
    ) {
      return null;
    }
    return {
      kind: "match",
      prompt: round.prompt,
      pairs,
      explanation: round.explanation,
    };
  }

  const { choices, answerIndex } = round;
  if (
    round.kind !== "choice" ||
    !Array.isArray(choices) ||
    choices.length < 2 ||
    choices.length > 4 ||
    !choices.every(isFilled) ||
    hasDuplicates(choices) ||
    !Number.isInteger(answerIndex) ||
    answerIndex! < 0 ||
    answerIndex! >= choices.length
  ) {
    return null;
  }
  return {
    kind: "choice",
    prompt: round.prompt,
    choices,
    answerIndex: answerIndex!,
    explanation: round.explanation,
  };
}

// Models sometimes repeat the emoji in the name field.
function withReadableName(character: Character, fallback: string) {
  return /\p{L}/u.test(character.name)
    ? character
    : { ...character, name: fallback };
}

// Drops broken rounds so one bad question doesn't fail a usable game.
export function parseGameSpec(
  value: unknown,
): { spec: GameSpec } | { errors: string[] } {
  const draft = value as Partial<GameSpec>;
  const errors: string[] = [];

  if (!isFilled(draft?.title)) errors.push("title is missing");
  if (!isFilled(draft?.learningGoal)) errors.push("learningGoal is missing");
  if (!MECHANICS.includes(draft?.mechanic as Mechanic)) {
    errors.push(`mechanic must be one of: ${MECHANICS.join(", ")}`);
  }
  if (!THEMES.includes(draft?.theme as Theme)) {
    errors.push(`theme must be one of: ${THEMES.join(", ")}`);
  }
  for (const key of ["player", "challenger"] as const) {
    if (!isFilled(draft?.[key]?.name) || !isFilled(draft?.[key]?.emoji)) {
      errors.push(`${key} needs a name and an emoji`);
    }
  }
  for (const key of ["intro", "win", "lose"] as const) {
    if (!isFilled(draft?.story?.[key])) {
      errors.push(`story.${key} is missing`);
    }
  }

  const rawRounds: unknown[] = Array.isArray(draft?.rounds) ? draft.rounds : [];
  const rounds = rawRounds
    .map(parseRound)
    .filter((round) => round !== null)
    .slice(0, MAX_ROUNDS);
  if (rounds.length < MIN_PLAYABLE_ROUNDS) {
    errors.push(
      `only ${rounds.length} of ${rawRounds.length} rounds are usable; at least ${MIN_PLAYABLE_ROUNDS} are needed. A choice round needs 2 to 4 different choices and a valid answerIndex. A match round needs 3 to 5 different pairs.`,
    );
  }

  if (errors.length > 0) {
    return { errors };
  }
  const spec = draft as GameSpec;
  return {
    spec: {
      ...spec,
      player: withReadableName(spec.player, "Player"),
      challenger: withReadableName(spec.challenger, "Challenger"),
      rounds,
    },
  };
}
