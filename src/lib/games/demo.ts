import { readFile } from "node:fs/promises";
import path from "node:path";
import { GenerationStoppedError } from "@/lib/llm/types";
import type { ProgressReporter } from "./pipeline";
import { renderGame } from "./render";
import { SAMPLE_GAMES } from "./samples";
import { MECHANICS, THEMES, type GameSpec, type Theme } from "./spec";
import { createGame, getGameDetails, listGames } from "./store";

// Adds up to about ten seconds, ticking smoothly like a real build.
const BUILD_STAGES = [
  { label: "Starting the AI model", from: 0, to: 5, wait: 1200 },
  { label: "Designing your game", from: 5, to: 75, wait: 6000 },
  { label: "Checking the answers", from: 75, to: 90, wait: 1800 },
  { label: "Finishing your game", from: 90, to: 97, wait: 1000 },
];
const TICK_MS = 250;

const PREBUILT_DIR = path.join(process.cwd(), "src/lib/games/prebuilt");

const PREBUILT_GAMES = [
  {
    id: "gravity",
    file: "gravity-playground.html",
    name: "Gravity Playground",
    summary: "New game",
    keywords: /gravit|planet|orbit|rocket|space|physics|science|mass|weight|moon|newton/i,
  },
  {
    id: "great-depression",
    file: "hard-times-1932.html",
    name: "Hard Times: 1932",
    summary: "New game",
    keywords: /depression|1929|1930s|1932|new deal|roosevelt|stock market|history/i,
  },
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
  steps: typeof CHANGE_STEPS,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  for (const { label, percent, wait: milliseconds } of steps) {
    onProgress({ label, percent });
    await wait(milliseconds, signal);
  }
}

async function playStages(signal: AbortSignal, onProgress: ProgressReporter) {
  for (const { label, from, to, wait: milliseconds } of BUILD_STAGES) {
    const ticks = Math.max(Math.round(milliseconds / TICK_MS), 1);
    for (let tick = 0; tick < ticks; tick++) {
      onProgress({ label, percent: from + ((to - from) * tick) / ticks });
      await wait(TICK_MS, signal);
    }
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

// Picks a game from words in the prompt, so any prompt gets one.
export async function runPrebuiltBuild(
  prompt: string,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  await playStages(signal, onProgress);

  const game =
    PREBUILT_GAMES.find((item) => item.keywords.test(prompt)) ??
    PREBUILT_GAMES[1];
  onProgress({ label: "Finishing your game", percent: 100 });

  return {
    id: `prebuilt-${game.id}`,
    name: game.name,
    versionCount: 1,
    summary: game.summary,
    html: await readFile(path.join(PREBUILT_DIR, game.file), "utf8"),
    prebuilt: true,
  };
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
