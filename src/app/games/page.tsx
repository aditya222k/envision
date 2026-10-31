import type { Metadata } from "next";
import { GameCatalog } from "@/components/GameCatalog";

export const metadata: Metadata = {
  title: "Your games | Envision",
};

export default function GamesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-3">
        <h1 className="chalk-title text-5xl sm:text-6xl">Your games</h1>
        <p className="max-w-[52ch] text-lg leading-7 text-chalk-dim">
          Open a game to change it, or publish it for your students.
        </p>
      </div>
      <div className="board mb-8">
        <GameCatalog />
      </div>
    </main>
  );
}
