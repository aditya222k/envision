import type { Metadata } from "next";
import { Suspense } from "react";
import { StorylineList } from "@/components/StorylineList";

export const metadata: Metadata = {
  title: "Storylines | Envision",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
      <div className="flex flex-col gap-3">
        <h1 className="chalk-title text-5xl sm:text-6xl">Storylines</h1>
        <p className="max-w-[52ch] text-lg leading-7 text-chalk-dim">
          Turn a subject into chapters and levels, with one story that runs
          through every game.
        </p>
      </div>
      <div className="board mb-8">
        <Suspense fallback={<p className="bg-paper p-6 text-ink">Loading...</p>}>
          <StorylineList />
        </Suspense>
      </div>
    </main>
  );
}
