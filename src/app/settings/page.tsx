import type { Metadata } from "next";
import Link from "next/link";
import { ProviderSettings } from "@/components/ProviderSettings";

export const metadata: Metadata = {
  title: "AI settings | Envision",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-6 px-4 py-6 sm:px-8 sm:py-10">
      <Link href="/" className="font-bold text-paper underline">
        Back to Envision
      </Link>
      <div className="board">
        <div className="flex flex-col gap-2 bg-paper p-6 sm:p-10">
          <h1 className="font-display text-4xl leading-none text-ink sm:text-6xl">
            AI settings
          </h1>
          <p className="text-lg leading-7 text-ink">
            Add the details for each AI provider you want to build games with.
          </p>
        </div>
        <ProviderSettings />
      </div>
    </main>
  );
}
