"use client";

import Link from "next/link";
import { EXAMPLE_GAMES, type Subject } from "@/lib/games/examples";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type ProviderId,
} from "@/lib/llm/types";


const SUBJECT_COLORS: Record<Subject, string> = {
  Science: "bg-science text-paper",
  Math: "bg-math text-paper",
  History: "bg-history text-paper",
  English: "bg-pencil text-ink",
};

export function GameBoard() {
  const [provider, setProvider] = useState<ProviderId>("ollama");
  const [prompt, setPrompt] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [result, setResult] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const runRef = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );

  useEffect(() => {
    if (result) {
      resultRef.current?.scrollIntoView({ block: "start" });
    }
  }, [result]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setResult(null);
    setError(null);
    setNeedsSetup(false);
    setNotice(null);

    const label = PROVIDER_LABELS[provider];
    const run = { id: crypto.randomUUID(), controller: new AbortController() };
    runRef.current = run;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, provider, runId: run.id }),
        signal: run.controller.signal,
      });
      const data = await response.json().catch(() => null);

      if (data?.stopped) {
        return;
      }
      if (response.ok && typeof data?.text === "string") {
        setResult(data.text);
      } else if (response.status === 503) {
        setError(`${label} isn't set up yet.`);
        setNeedsSetup(true);
      } else if (response.status === 501) {
        setError(`${label} can't build games yet. Choose another AI provider.`);
      } else {
        setError(data?.error ?? "The game wasn't built. Try again.");
      }
    } catch {
      if (!run.controller.signal.aborted) {
        setError("Envision couldn't reach the server. Try again.");
      }
    } finally {
      setIsLoading(false);
      runRef.current = null;
    }
  }

  async function handleStop() {
    const run = runRef.current;
    if (!run) {
      return;
    }

    setIsStopping(true);
    run.controller.abort();

    try {
      const response = await fetch("/api/generate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, provider }),
      });
      const data = await response.json().catch(() => null);
      setNotice(
        data?.unloaded
          ? "Stopped. The game wasn't built, and the AI model was closed."
          : "Stopped. The game wasn't built, but the AI model is still open. It will close on its own.",
      );
    } catch {
      setError(
        "The build stopped on this page, but Envision couldn't reach the server to close the AI model.",
      );
    } finally {
      setIsStopping(false);
    }
  }

  return (
    <div className="board grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_1fr_1fr_auto]">
      {result && (
        <section
          ref={resultRef}
          className="col-span-2 flex flex-col gap-3 bg-paper p-4 sm:p-6 lg:col-span-4 lg:row-start-5"
        >
          <h2 className="text-2xl font-bold text-ink">Your game</h2>
          <iframe
            title="Your game"
            srcDoc={result}
            sandbox="allow-scripts"
            className="h-[70vh] w-full border-2 border-ink bg-white"
          />
        </section>
      )}
      <section className="col-span-2 flex flex-col gap-5 bg-paper p-6 sm:p-10 lg:col-start-2 lg:row-span-2 lg:row-start-2">
        <div className="flex flex-col gap-2">
          <h1 className="font-display text-5xl leading-none text-ink sm:text-7xl">
            Envision
          </h1>
          <p className="text-lg leading-7 text-ink">
            Describe a game for your class, and Envision builds it. Pick a
            square to start from an example.
          </p>
        </div>

        <form onSubmit={handleSubmit} className="flex flex-col gap-4">
          <label className="field-label">
            Your game
            <textarea
              ref={promptRef}
              value={prompt}
              onChange={(event) => {
                setPrompt(event.target.value);
                setSelectedTitle(null);
              }}
              rows={5}
              required
              placeholder="What should students learn, and how should they play?"
              className="field p-3"
            />
          </label>

          <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
            <label className="field-label sm:flex-1">
              AI provider
              <select
                value={provider}
                onChange={(event) =>
                  setProvider(event.target.value as ProviderId)
                }
                className="field h-12 px-3"
              >
                {PROVIDER_IDS.map((id) => (
                  <option key={id} value={id}>
                    {PROVIDER_LABELS[id]}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="submit"
              disabled={isLoading || !prompt.trim()}
              className="action h-12 px-6 sm:flex-1"
            >
              {isLoading ? "Building your game..." : "Build my game"}
            </button>
          </div>

          {(isLoading || isStopping) && (
            <button
              type="button"
              onClick={handleStop}
              disabled={isStopping}
              className="action action-stop h-12 px-6"
            >
              {isStopping ? "Stopping..." : "Stop building"}
            </button>
          )}

          {notice && (
            <p role="status" className="font-bold text-ink">
              {notice}
            </p>
          )}
          {error && (
            <p role="alert" className="font-bold text-history">
              {error}{" "}
              {needsSetup && (
                <Link href="/settings" className="underline">
                  Add it in AI settings.
                </Link>
              )}
            </p>
          )}
          {isLoading && (
            <p role="status" className="text-ink">
              Your game may take a few minutes to build.
            </p>
          )}
        </form>
      </section>

      {EXAMPLE_GAMES.map((game) => (
        <button
          key={game.title}
          type="button"
          aria-pressed={selectedTitle === game.title}
          onClick={() => {
            setPrompt(game.prompt);
            setSelectedTitle(game.title);
            promptRef.current?.focus();
          }}
          className="square text-left text-ink"
        >
          <span
            className={`px-3 py-1.5 text-sm font-bold ${SUBJECT_COLORS[game.subject]}`}
          >
            {game.subject}
          </span>
          <span className="flex flex-1 flex-col justify-between gap-3 p-3">
            <span className="text-lg leading-6 font-bold">{game.title}</span>
            <span className="text-sm">{game.grade}</span>
          </span>
        </button>
      ))}

      <Link href="/settings" className="square bg-ink text-paper">
        <span className="flex flex-1 flex-col justify-between gap-3 p-3">
          <span className="text-lg leading-6 font-bold">AI settings</span>
          <span className="text-sm">Add your API keys</span>
        </span>
      </Link>
    </div>
  );
}
