import type { Metadata } from "next";
import Link from "next/link";
import { GameCatalog } from "@/components/GameCatalog";

export const metadata: Metadata = {
  title: "Your games | Envision",
};

export default function GamesPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/" className="font-bold text-paper underline">
        Back to Envision
      </Link>
      <div className="board">
        <div className="flex flex-col gap-2 bg-paper p-6 sm:p-10">
          <h1 className="font-display text-4xl leading-none text-ink sm:text-6xl">
            Your games
          </h1>
          <p className="text-lg leading-7 text-ink">
            Open a game to change it, or publish it for your students.
          </p>
        </div>
        <GameCatalog />
      </div>
    </main>
  );
}
