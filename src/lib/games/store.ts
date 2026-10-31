import { mkdir, readdir, readFile, rename, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import { renderGame } from "./render";
import { MAX_ROUNDS, type ChoiceRound, type GameSpec } from "./spec";

export const MAX_NAME_LENGTH = 80;

type GameVersion = {
  spec: GameSpec;
  summary: string;
  createdAt: string;
};

type StoredGame = {
  id: string;
  createdAt: string;
  updatedAt: string;
  versions: GameVersion[];
  reviewRounds?: ChoiceRound[];
  published: { spec: GameSpec; publishedAt: string; version: number } | null;
};

const GAMES_DIR = path.join(process.cwd(), ".envision", "games");
const ID_PATTERN = /^[0-9a-f]{8}(-[0-9a-f]{4}){3}-[0-9a-f]{12}$/;

// IDs arrive in URLs, so only an exact UUID may become part of a file path.
function gamePath(id: string) {
  return ID_PATTERN.test(id) ? path.join(GAMES_DIR, `${id}.json`) : null;
}

async function writeGame(game: StoredGame) {
  const target = gamePath(game.id)!;
  const temporary = `${target}.${crypto.randomUUID()}.tmp`;
  await mkdir(GAMES_DIR, { recursive: true });
  await writeFile(temporary, JSON.stringify(game));
  await rename(temporary, target);
}

async function readGame(id: string): Promise<StoredGame | null> {
  const file = gamePath(id);
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

function latest(game: StoredGame) {
  return game.versions[game.versions.length - 1];
}

function summarize(game: StoredGame) {
  const current = latest(game);
  return {
    id: game.id,
    name: current.spec.title,
    subjectLine: current.spec.learningGoal,
    theme: current.spec.theme,
    mechanic: current.spec.mechanic,
    versionCount: game.versions.length,
    updatedAt: game.updatedAt,
    publishedAt: game.published?.publishedAt ?? null,
    hasUnpublishedChanges:
      game.published !== null &&
      JSON.stringify(game.published.spec) !== JSON.stringify(current.spec),
  };
}

export type GameSummary = ReturnType<typeof summarize>;

async function describe(game: StoredGame) {
  const current = latest(game);
  return {
    ...summarize(game),
    summary: current.summary,
    spec: current.spec,
    reviewRounds: game.reviewRounds ?? [],
    html: await renderGame(current.spec),
  };
}

export async function listGames() {
  const files = await readdir(GAMES_DIR).catch(() => []);
  const games = await Promise.all(
    files
      .filter((file) => file.endsWith(".json"))
      .map((file) => readGame(file.replace(/\.json$/, ""))),
  );
  return games
    .filter((game) => game !== null)
    .map(summarize)
    .sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
}

export async function getGameDetails(id: string) {
  const game = await readGame(id);
  return game ? describe(game) : null;
}

export async function getLatestSpec(id: string) {
  const game = await readGame(id);
  return game ? latest(game).spec : null;
}

export async function createGame(
  spec: GameSpec,
  reviewRounds: ChoiceRound[] = [],
) {
  const now = new Date().toISOString();
  const game: StoredGame = {
    id: crypto.randomUUID(),
    createdAt: now,
    updatedAt: now,
    versions: [{ spec, summary: "New game", createdAt: now }],
    reviewRounds,
    published: null,
  };
  await writeGame(game);
  return describe(game);
}

export async function addVersion(
  id: string,
  spec: GameSpec,
  summary: string,
  reviewRounds: ChoiceRound[] = [],
) {
  const game = await readGame(id);
  if (!game) {
    return null;
  }
  const now = new Date().toISOString();
  game.versions.push({ spec, summary, createdAt: now });
  game.reviewRounds = [...(game.reviewRounds ?? []), ...reviewRounds];
  game.updatedAt = now;
  await writeGame(game);
  return describe(game);
}

// The teacher's answer settles a doubtful question, so it joins as a new version.
export async function resolveReview(
  id: string,
  index: number,
  answerIndex: number | null,
) {
  const game = await readGame(id);
  const round = game?.reviewRounds?.[index];
  if (!game || !round) {
    return null;
  }

  if (answerIndex !== null) {
    const current = latest(game);
    if (current.spec.rounds.length >= MAX_ROUNDS) {
      return { error: `A game can have up to ${MAX_ROUNDS} rounds. Remove one first.` };
    }
    if (!Number.isInteger(answerIndex) || !round.choices[answerIndex]) {
      return { error: "Choose one of the answers." };
    }
    game.versions.push({
      spec: {
        ...current.spec,
        rounds: [...current.spec.rounds, { ...round, answerIndex }],
      },
      summary: "Added a question you reviewed.",
      createdAt: new Date().toISOString(),
    });
  }

  game.reviewRounds = game.reviewRounds?.filter((_, item) => item !== index);
  game.updatedAt = new Date().toISOString();
  await writeGame(game);
  return describe(game);
}

export async function undoVersion(id: string) {
  const game = await readGame(id);
  if (!game) {
    return null;
  }
  if (game.versions.length > 1) {
    game.versions.pop();
    game.updatedAt = new Date().toISOString();
    await writeGame(game);
  }
  return describe(game);
}

export async function renameGame(id: string, name: string) {
  const game = await readGame(id);
  if (!game) {
    return null;
  }
  game.versions = game.versions.map((version) => ({
    ...version,
    spec: { ...version.spec, title: name },
  }));
  game.updatedAt = new Date().toISOString();
  await writeGame(game);
  return describe(game);
}

export async function setPublished(id: string, published: boolean) {
  const game = await readGame(id);
  if (!game) {
    return null;
  }
  game.published = published
    ? {
        spec: latest(game).spec,
        publishedAt: new Date().toISOString(),
        version: game.versions.length,
      }
    : null;
  await writeGame(game);
  return describe(game);
}

export async function deleteGame(id: string) {
  const file = gamePath(id);
  if (!file) {
    return false;
  }
  await rm(file, { force: true });
  return true;
}

export async function getPublishedHtml(id: string) {
  const game = await readGame(id);
  return game?.published ? renderGame(game.published.spec) : null;
}
