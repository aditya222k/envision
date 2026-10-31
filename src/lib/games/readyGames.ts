import { readFile } from "node:fs/promises";
import path from "node:path";

// Finished games included with Envision as examples. They are complete HTML
// files, not designs Envision's AI generated, and the pages say so.
export const READY_GAMES = [
  {
    id: "gravity",
    title: "Gravity Playground",
    file: "gravity-playground.html",
    description:
      "Four gravity activities for grade 8: jump on ten worlds, build orbits, balance balls in the Gravity Lab, and launch a rocket.",
  },
  {
    id: "great-depression",
    title: "Hard Times: 1932",
    file: "hard-times-1932.html",
    description:
      "Keep a Detroit family together through the Great Depression, week by week, and see how the New Deal changed their lives.",
  },
] as const;

export type ReadyGameId = (typeof READY_GAMES)[number]["id"];

const READY_DIR = path.join(process.cwd(), "src/lib/games/prebuilt");

export function readyGame(id: string) {
  return READY_GAMES.find((game) => game.id === id) ?? null;
}

export async function readyGameHtml(id: string) {
  const game = readyGame(id);
  return game ? readFile(path.join(READY_DIR, game.file), "utf8") : null;
}
