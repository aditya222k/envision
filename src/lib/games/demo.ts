import { readFile } from "node:fs/promises";
import path from "node:path";
import { GenerationStoppedError, ProviderRequestError } from "@/lib/llm/types";
import type { EventReporter, ProgressReporter } from "./pipeline";
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

// Adds up to about ten seconds, ticking smoothly like a real build.
const PREBUILT_STAGES = [
  { label: "Starting the AI model", from: 0, to: 5, wait: 1200 },
  { label: "Designing your game", from: 5, to: 75, wait: 6000 },
  { label: "Checking the answers", from: 75, to: 90, wait: 1800 },
  { label: "Finishing your game", from: 90, to: 97, wait: 1000 },
];
const PREBUILT_CHANGE_STAGES = [
  { label: "Making your change", from: 0, to: 70, wait: 3200 },
  { label: "Checking the answers", from: 70, to: 90, wait: 1200 },
  { label: "Finishing your game", from: 90, to: 97, wait: 600 },
];
const TICK_MS = 250;

const PREBUILT_DIR = path.join(process.cwd(), "src/lib/games/prebuilt");

const PREBUILT_GAMES = [
  {
    id: "gravity",
    versions: [
      { file: "gravity-playground-v1.html", summary: "New game" },
      {
        file: "gravity-playground.html",
        summary: "Gravity Lab now gives each ball a pattern, labels every pull arrow and outlines the selected ball.",
      },
    ],
    name: "Gravity Playground",
    keywords: /gravit|planet|orbit|rocket|space|physics|science|mass|weight|moon|newton/i,
  },
  {
    id: "great-depression",
    versions: [{ file: "hard-times-1932.html", summary: "New game" }],
    name: "Hard Times: 1932",
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
  onEvent: EventReporter = () => {},
) {
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

  const details = await getGameDetails(best.game.id);
  const spec = details?.spec;

  for (const [index, step] of BUILD_STEPS.entries()) {
    onProgress({ label: step.label, percent: step.percent });
    if (spec) {
      onEvent({
        type: "draft",
        draft: {
          title: spec.title,
          mechanic: spec.mechanic,
          theme: spec.theme,
          player: spec.player,
          challenger: spec.challenger,
          intro: index > 0 ? spec.story.intro : undefined,
          questions: spec.rounds
            .slice(0, Math.round((index / 3) * spec.rounds.length))
            .map((round) => round.prompt),
        },
      });
      if (step.label === "Checking the answers") {
        onEvent({
          type: "check",
          questions: spec.rounds.map((round) => ({
            prompt: round.prompt,
            status: round.kind === "match" ? "not-checked" : "confirmed",
          })),
        });
      }
    }
    await wait(step.wait, signal);
  }

  return details;
}

async function playStages(
  stages: typeof PREBUILT_STAGES,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  for (const { label, from, to, wait: milliseconds } of stages) {
    const ticks = Math.max(Math.round(milliseconds / TICK_MS), 1);
    for (let tick = 0; tick < ticks; tick++) {
      onProgress({ label, percent: from + ((to - from) * tick) / ticks });
      await wait(TICK_MS, signal);
    }
  }
  onProgress({ label: "Finishing your game", percent: 100 });
}

async function prebuiltVersion(game: (typeof PREBUILT_GAMES)[number], version: number) {
  const { file, summary } = game.versions[version - 1];
  return {
    id: `prebuilt-${game.id}`,
    name: game.name,
    versionCount: version,
    summary,
    html: await readFile(path.join(PREBUILT_DIR, file), "utf8"),
    prebuilt: true,
  };
}

// Picks a game from words in the prompt, so any prompt gets one.
export async function runPrebuiltBuild(
  prompt: string,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  await playStages(PREBUILT_STAGES, signal, onProgress);
  const game =
    PREBUILT_GAMES.find((item) => item.keywords.test(prompt)) ??
    PREBUILT_GAMES[1];
  return prebuiltVersion(game, 1);
}

// A change moves a ready-made game to its next saved version, if it has one.
export async function runPrebuiltChange(
  id: string,
  versionCount: number,
  signal: AbortSignal,
  onProgress: ProgressReporter,
) {
  const game = PREBUILT_GAMES.find((item) => `prebuilt-${item.id}` === id);
  if (!game || versionCount >= game.versions.length) {
    throw new ProviderRequestError("This ready-made game can't be changed yet.");
  }
  await playStages(PREBUILT_CHANGE_STAGES, signal, onProgress);
  return prebuiltVersion(game, versionCount + 1);
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
