import { THEMES, type Character, type Theme } from "./spec";

export type Topic = {
  id: string;
  title: string;
  goal: string;
  storyBeat: string;
  gameId: string | null;
  builtBeat: string | null;
};

export type Chapter = {
  id: string;
  title: string;
  story: string;
  theme: Theme;
  topics: Topic[];
};

export type Storyline = {
  id: string;
  subject: string;
  title: string;
  premise: string;
  ending: string;
  hero: Character;
  chapters: Chapter[];
  published: boolean;
  updatedAt: string;
};

const shortText = { type: "string", minLength: 1, maxLength: 80 };
const longText = { type: "string", minLength: 1, maxLength: 300 };

export const STORYLINE_SCHEMA = {
  type: "object",
  properties: {
    title: shortText,
    premise: longText,
    hero: {
      type: "object",
      properties: {
        name: shortText,
        emoji: { type: "string", minLength: 1, maxLength: 8 },
      },
      required: ["name", "emoji"],
    },
    chapters: {
      type: "array",
      minItems: 2,
      maxItems: 4,
      items: {
        type: "object",
        properties: {
          title: shortText,
          story: longText,
          theme: { type: "string", enum: THEMES },
          topics: {
            type: "array",
            minItems: 2,
            maxItems: 3,
            items: {
              type: "object",
              properties: {
                title: shortText,
                goal: longText,
                storyBeat: longText,
              },
              required: ["title", "goal", "storyBeat"],
            },
          },
        },
        required: ["title", "story", "theme", "topics"],
      },
    },
    ending: longText,
  },
  required: ["title", "premise", "hero", "chapters", "ending"],
};

function isFilled(value: unknown): value is string {
  return typeof value === "string" && value.trim().length > 0;
}

function parseTopic(value: unknown): Topic | null {
  const topic = value as Partial<Topic>;
  if (
    !isFilled(topic?.title) ||
    !isFilled(topic.goal) ||
    !isFilled(topic.storyBeat)
  ) {
    return null;
  }
  return {
    id: topic.id ?? crypto.randomUUID(),
    title: topic.title.trim(),
    goal: topic.goal.trim(),
    storyBeat: topic.storyBeat.trim(),
    gameId: topic.gameId ?? null,
    builtBeat: topic.builtBeat ?? null,
  };
}

function parseChapter(value: unknown): Chapter | null {
  const chapter = value as Partial<Chapter>;
  const topics = Array.isArray(chapter?.topics)
    ? chapter.topics.map(parseTopic)
    : [];
  if (
    !isFilled(chapter?.title) ||
    !isFilled(chapter.story) ||
    !THEMES.includes(chapter.theme as Theme) ||
    topics.length === 0 ||
    topics.includes(null)
  ) {
    return null;
  }
  return {
    id: chapter.id ?? crypto.randomUUID(),
    title: chapter.title.trim(),
    story: chapter.story.trim(),
    theme: chapter.theme as Theme,
    topics: topics as Topic[],
  };
}

// Used for both model output and teacher edits, so both follow the same rules.
export function parseOutline(value: unknown) {
  const draft = value as Partial<Storyline>;
  const chapters = Array.isArray(draft?.chapters)
    ? draft.chapters.map(parseChapter)
    : [];
  if (
    !isFilled(draft?.title) ||
    !isFilled(draft.premise) ||
    !isFilled(draft.ending) ||
    !isFilled(draft.hero?.name) ||
    !isFilled(draft.hero?.emoji) ||
    chapters.length === 0 ||
    chapters.includes(null)
  ) {
    return null;
  }
  return {
    title: draft.title.trim(),
    premise: draft.premise.trim(),
    ending: draft.ending.trim(),
    hero: { name: draft.hero.name.trim(), emoji: draft.hero.emoji.trim() },
    chapters: chapters as Chapter[],
  };
}

export function allTopics(storyline: Storyline) {
  return storyline.chapters.flatMap((chapter) =>
    chapter.topics.map((topic) => ({ chapter, topic })),
  );
}

// Gives each game the story so far, so the topics read as one adventure.
export function topicPrompt(storyline: Storyline, topicId: string) {
  const topics = allTopics(storyline);
  const index = topics.findIndex(({ topic }) => topic.id === topicId);
  if (index < 0) {
    return null;
  }

  const { chapter, topic } = topics[index];
  const storySoFar = topics
    .slice(0, index)
    .map(({ topic: earlier }) => `- ${earlier.storyBeat}`)
    .join("\n");

  return {
    chapter,
    topic,
    prompt: `Make a game for this part of a longer ${storyline.subject} adventure.

Overall story: ${storyline.premise}
Hero: ${storyline.hero.name}
Chapter: ${chapter.title}. ${chapter.story}
${storySoFar ? `Story so far:\n${storySoFar}\n` : ""}
This level: ${topic.title}
What students should learn: ${topic.goal}
What happens in this level: ${topic.storyBeat}

Keep every round on this level's topic. Write the game's story as the next part of this chapter's story, and don't finish the overall story.`,
  };
}
