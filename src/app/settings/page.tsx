import type { Metadata } from "next";
import { ProviderSettings } from "@/components/ProviderSettings";

export const metadata: Metadata = {
  title: "AI settings | Envision",
};

export default function SettingsPage() {
  return (
    <main className="mx-auto flex w-full max-w-4xl flex-1 flex-col gap-10 px-4 py-5 sm:px-8 sm:py-8">
      <div className="flex flex-col gap-3">
        <h1 className="chalk-title text-5xl sm:text-6xl">AI settings</h1>
        <p className="max-w-[52ch] text-lg leading-7 text-chalk-dim">
          Add the details for each AI provider you want to build games with.
        </p>
      </div>
      <div className="sheet sheet-rows mb-8 overflow-hidden">
        <ProviderSettings />
      </div>
    </main>
  );
}
