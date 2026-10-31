import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StorylineList } from "@/components/StorylineList";

export const metadata: Metadata = {
  title: "Storylines | Envision",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/" className="font-bold text-paper underline">
        Back to Envision
      </Link>
      <div className="board">
        <div className="flex flex-col gap-2 bg-paper p-6 sm:p-10">
          <h1 className="font-display text-4xl leading-none text-ink sm:text-6xl">
            Storylines
          </h1>
          <p className="text-lg leading-7 text-ink">
            Turn a subject into chapters and levels, with one story that runs
            through every game.
          </p>
        </div>
        <Suspense fallback={<p className="bg-paper p-6 text-ink">Loading...</p>}>
          <StorylineList />
        </Suspense>
      </div>
    </main>
  );
}
