import type { Metadata } from "next";
import { Suspense } from "react";
import { StorylineEditor } from "@/components/StorylineEditor";

export const metadata: Metadata = {
  title: "Storyline | Envision",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-8 px-4 py-8 sm:px-8 sm:py-10">
      <div className="board">
        <Suspense fallback={<p className="bg-paper p-6 text-ink">Loading...</p>}>
          <StorylineEditor />
        </Suspense>
      </div>
    </main>
  );
}
