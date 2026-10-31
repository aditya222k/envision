import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { allTopics, parseOutline, type Storyline } from "./storyline";
import { getLatestSpec, setPublished } from "./store";

const STORYLINES_DIR = path.join(process.cwd(), ".envision", "storylines");
const ID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

// IDs arrive in URLs, so only an exact UUID may become part of a file path.
function storylinePath(id: string) {
  return ID_PATTERN.test(id) ? path.join(STORYLINES_DIR, `${id}.json`) : null;
}

async function writeStoryline(storyline: Storyline) {
  const target = storylinePath(storyline.id)!;
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await mkdir(STORYLINES_DIR, { recursive: true });
  await writeFile(temporary, JSON.stringify(storyline));
  await rename(temporary, target);
}

export async function getStoryline(id: string): Promise<Storyline | null> {
  const file = storylinePath(id);
  if (!file) {
    return null;
  }
  try {
    return JSON.parse(await readFile(file, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return null;
    }
    throw error;
  }
}

export async function listStorylines() {
  const files = await readdir(STORYLINES_DIR).catch(() => []);
  const storylines = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => getStoryline(file.replace(/\.json$/, ""))),
  );
  return storylines
    .filter((storyline) => storyline !== null)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function createStoryline(subject: string, outline: unknown) {
  const parsed = parseOutline(outline);
  if (!parsed) {
    return null;
  }
  const storyline: Storyline = {
    ...parsed,
    id: crypto.randomUUID(),
    subject,
    published: false,
    updatedAt: new Date().toISOString(),
  };
  await writeStoryline(storyline);
  return storyline;
}

export async function updateOutline(id: string, outline: unknown) {
  const storyline = await getStoryline(id);
  const parsed = parseOutline(outline);
  if (!storyline || !parsed) {
    return null;
  }

  // Only a game that really exists can be attached to a topic.
  for (const { topic } of allTopics({ ...storyline, ...parsed })) {
    if (topic.gameId && !(await getLatestSpec(topic.gameId))) {
      topic.gameId = null;
    }
  }

  const next = { ...storyline, ...parsed, updatedAt: new Date().toISOString() };
  await writeStoryline(next);
  return next;
}

export async function linkTopicGame(
  id: string,
  topicId: string,
  gameId: string,
) {
  const storyline = await getStoryline(id);
  const match = storyline
    ? allTopics(storyline).find(({ topic }) => topic.id === topicId)
    : null;
  if (!storyline || !match) {
    return null;
  }
  match.topic.gameId = gameId;
  match.topic.builtBeat = match.topic.storyBeat;
  storyline.updatedAt = new Date().toISOString();
  await writeStoryline(storyline);
  return storyline;
}

// Publishing a storyline publishes each game's latest version too.
export async function publishStoryline(id: string, published: boolean) {
  const storyline = await getStoryline(id);
  if (!storyline) {
    return null;
  }

  if (published) {
    const topics = allTopics(storyline);
    const missing = topics.filter(({ topic }) => !topic.gameId);
    if (missing.length > 0) {
      return {
        error: `Add a game to every level first: ${missing
          .map(({ topic }) => topic.title)
          .join(", ")}.`,
      };
    }
    // One at a time, because several topics can share a game.
    for (const gameId of new Set(topics.map(({ topic }) => topic.gameId!))) {
      if (!(await setPublished(gameId, true))) {
        return { error: "One of these games was deleted. Choose another." };
      }
    }
  }

  storyline.published = published;
  storyline.updatedAt = new Date().toISOString();
  await writeStoryline(storyline);
  return storyline;
}

export async function deleteStoryline(id: string) {
  const file = storylinePath(id);
  if (!file) {
    return false;
  }
  await rm(file, { force: true });
  return true;
}
