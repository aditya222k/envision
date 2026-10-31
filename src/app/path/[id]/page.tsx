import type { Metadata } from "next";
import { Suspense } from "react";
import { StudentPath } from "@/components/StudentPath";

export const metadata: Metadata = {
  title: "Your course | Envision",
};

export default function Page() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <div className="board">
        <Suspense fallback={<p className="bg-paper p-6 text-ink">Loading...</p>}>
          <StudentPath />
        </Suspense>
      </div>
    </main>
  );
}
