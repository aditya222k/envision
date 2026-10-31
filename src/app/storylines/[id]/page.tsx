import type { Metadata } from "next";
import Link from "next/link";
import { Suspense } from "react";
import { StorylineEditor } from "@/components/StorylineEditor";

export const metadata: Metadata = {
  title: "Storyline | Envision",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/storylines" className="font-bold text-paper underline">
        All storylines
      </Link>
      <div className="board">
        <Suspense fallback={<p className="bg-paper p-6 text-ink">Loading...</p>}>
          <StorylineEditor />
        </Suspense>
      </div>
    </main>
  );
}
