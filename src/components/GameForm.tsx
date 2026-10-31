"use client";

import { useState, type FormEvent } from "react";
import { PROVIDER_IDS, type ProviderId } from "@/lib/llm/types";

const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama (local)",
};

export function GameForm() {
  const [provider, setProvider] = useState<ProviderId>("claude");
  const [prompt, setPrompt] = useState("");
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok && typeof data?.text === "string") {
        setResult(data.text);
      } else {
        setError(data?.error ?? "Something went wrong. Please try again.");
      }
    } catch {
      setError("Could not reach the server. Please try again.");
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-4">
      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        AI provider
        <select
          value={provider}
          onChange={(event) => setProvider(event.target.value as ProviderId)}
          className="h-11 rounded-lg border border-black/[.08] bg-white px-3 text-base font-normal text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
        >
          {PROVIDER_IDS.map((id) => (
            <option key={id} value={id}>
              {PROVIDER_LABELS[id]}
            </option>
          ))}
        </select>
      </label>

      <label className="flex flex-col gap-2 text-sm font-medium text-zinc-700 dark:text-zinc-300">
        Describe your game
        <textarea
          value={prompt}
          onChange={(event) => setPrompt(event.target.value)}
          rows={5}
          required
          placeholder="A grade 8 quiz game about the water cycle, with three levels"
          className="rounded-lg border border-black/[.08] bg-white p-3 text-base font-normal text-black dark:border-white/[.145] dark:bg-zinc-900 dark:text-zinc-50"
        />
      </label>

      <button
        type="submit"
        disabled={isLoading || !prompt.trim()}
        className="h-12 rounded-full bg-foreground px-5 font-medium text-background transition-colors hover:bg-[#383838] disabled:opacity-50 dark:hover:bg-[#ccc]"
      >
        {isLoading ? "Generating..." : "Generate game"}
      </button>

      {error && (
        <p role="alert" className="text-sm text-red-600 dark:text-red-400">
          {error}
        </p>
      )}
      {result && (
        <pre className="overflow-x-auto rounded-lg bg-black/[.04] p-4 text-sm text-black dark:bg-white/[.08] dark:text-zinc-50">
          {result}
        </pre>
      )}
    </form>
  );
}
