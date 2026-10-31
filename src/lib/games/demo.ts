import { GenerationStoppedError } from "@/lib/llm/types";
import type { ProgressReporter } from "./pipeline";
import { renderGame } from "./render";
import { SAMPLE_GAMES } from "./samples";
import { MECHANICS, THEMES, type GameSpec, type Theme } from "./spec";
import { createGame, getGameDetails, listGames } from "./store";

const BUILD_STEPS = [
  { label: "Starting the AI model", percent: 5, wait: 900 },
  { label: "Designing your game", percent: 25, wait: 1400 },
  { label: "Designing your game", percent: 50, wait: 1400 },
  { label: "Designing your game", percent: 75, wait: 1400 },
  { label: "Checking the answers", percent: 90, wait: 1200 },
  { label: "Finishing your game", percent: 97, wait: 700 },
];

const CHANGE_STEPS = [
  { label: "Making your change", percent: 30, wait: 900 },
  { label: "Making your change", percent: 70, wait: 900 },
  { label: "Finishing your game", percent: 97, wait: 500 },
];

function wait(milliseconds: number, signal: AbortSignal) {
  return new Promise<void>((resolve, reject) => {
    const timer = setTimeout(resolve, milliseconds);
    signal.addEventListener(
      "abort",
      () => {
        clearTimeout(timer);
        reject(new GenerationStoppedError());
      },
      { once: true },
    );
  });
}

async function playSteps(
  steps: typeof BUILD_STEPS,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  for (const { label, percent, wait: milliseconds } of steps) {
    onProgress({ label, percent });
    await wait(milliseconds, signal);
  }
}

export async function ensureSampleGames() {
  const games = await listGames();
  if (games.length > 0) {
    return games;
  }
  await Promise.all(SAMPLE_GAMES.map((spec) => createGame(spec)));
  return listGames();
}

function words(text: string) {
  return new Set(text.toLowerCase().match(/[a-z]{4,}/g) ?? []);
}

// Picks the saved game closest to the prompt, using shared words.
export async function runDemoBuild(
  prompt: string,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  await playSteps(BUILD_STEPS, signal, onProgress);

  const games = await ensureSampleGames();
  const promptWords = words(prompt);
  const scored = games.map((game) => ({
    game,
    score: [...words(`${game.name} ${game.subjectLine}`)].filter((word) =>
      promptWords.has(word),
    ).length,
  }));
  const best = scored.reduce((top, item) =>
    item.score > top.score ? item : top,
  );

  return getGameDetails(best.game.id);
}

// Changes only what's shown on the page. Saved games are never touched.
export async function runDemoChange(
  game: { id: string },
  spec: GameSpec,
  versionCount: number,
  prompt: string,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  await playSteps(CHANGE_STEPS, signal, onProgress);

  const request = prompt.toLowerCase();
  const theme =
    THEMES.find((item) => request.includes(item)) ?? nextTheme(spec.theme);
  const mechanic =
    MECHANICS.find((item) => request.includes(item.replace(/-/g, " "))) ??
    spec.mechanic;
  const next = { ...spec, theme, mechanic };

  const details = await getGameDetails(game.id);
  return {
    ...details,
    id: game.id,
    name: spec.title,
    versionCount: versionCount + 1,
    summary: "Changed the world.",
    html: await renderGame(next),
    spec: next,
  };
}

function nextTheme(theme: Theme) {
  return THEMES[(THEMES.indexOf(theme) + 1) % THEMES.length];
}
