"use client";

import Link from "next/link";
import { BuildProgress } from "@/components/BuildProgress";
import { GameDrawer } from "@/components/GameDrawer";
import { EXAMPLE_GAMES, type Subject } from "@/lib/games/examples";
import { setIncognito, useIncognito } from "@/lib/incognito";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type ProviderId,
} from "@/lib/llm/types";


type GenerateEvent =
  | { type: "progress"; label: string; percent: number }
  | { type: "result"; game: CurrentGame; spec?: unknown }
  | { type: "error"; status: number; error: string }
  | { type: "stopped" };

const SUBJECT_COLORS: Record<Subject, string> = {
  Science: "bg-science text-paper",
  Math: "bg-math text-paper",
  History: "bg-history text-paper",
  English: "bg-pencil text-ink",
};

type CurrentGame = {
  id: string;
  name: string;
  versionCount: number;
  summary: string;
  html: string;
  spec?: unknown;
};

type RunAction = "build" | "change";

type RunProgress = {
  label: string;
  percent: number;
  startedAt: number;
};

export function GameBoard() {
  const [provider, setProvider] = useState<ProviderId>("ollama");
  const [prompt, setPrompt] = useState("");
  const [changeRequest, setChangeRequest] = useState("");
  const [selectedTitle, setSelectedTitle] = useState<string | null>(null);
  const [game, setGame] = useState<CurrentGame | null>(null);
  const [activeAction, setActiveAction] = useState<RunAction>("build");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoHistory, setDemoHistory] = useState<CurrentGame[]>([]);
  const isIncognito = useIncognito();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const runRef = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );

  // Reopens a saved game after a refresh or from the catalog.
  useEffect(() => {
    const id = new URLSearchParams(window.location.search).get("game");
    if (!id) {
      return;
    }
    fetch(`/api/games/${encodeURIComponent(id)}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error();
        }
        return response.json();
      })
      .then((data) => setGame(data.game))
      .catch(() =>
        setError("Envision couldn't open that game. It may have been deleted."),
      );
  }, []);

  useEffect(() => {
    if (game) {
      resultRef.current?.scrollIntoView({ block: "start" });
    }
  }, [game]);

  function showGame(next: CurrentGame) {
    setGame(next);
    window.history.replaceState(null, "", `/?game=${next.id}`);
  }

  function handleEvent(action: RunAction, event: GenerateEvent, label: string) {
    if (event.type === "progress") {
      setProgress((current) =>
        current
          ? {
              ...current,
              label: event.label,
              percent: Math.max(current.percent, event.percent),
            }
          : current,
      );
    } else if (event.type === "result") {
      if (isIncognito && action === "change" && game) {
        setDemoHistory((current) => [...current, game]);
      } else {
        setDemoHistory([]);
      }
      showGame({ ...event.game, spec: event.spec ?? event.game.spec });
      if (action === "change") {
        setChangeRequest("");
      }
    } else if (event.type === "error") {
      setError(
        event.status === 501
          ? `${label} can't build games yet. Choose another AI provider.`
          : event.error,
      );
    }
  }

  // The current game stays on screen until a new version is ready.
  async function startRun(action: RunAction, body: object) {
    setActiveAction(action);
    setIsLoading(true);
    setProgress({
      label: "Getting started",
      percent: 0,
      startedAt: Date.now(),
    });
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
        body: JSON.stringify({
          ...body,
          provider,
          runId: run.id,
          demo: isIncognito,
        }),
        signal: run.controller.signal,
      });

      if (response.status === 503) {
        setError(`${label} isn't set up yet.`);
        setNeedsSetup(true);
        return;
      }
      if (!response.ok || !response.body) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "That didn't work. Try again.");
        return;
      }

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) {
          break;
        }
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        lines
          .filter(Boolean)
          .forEach((line) => handleEvent(action, JSON.parse(line), label));
      }
    } catch {
      if (!run.controller.signal.aborted) {
        setError("Envision couldn't reach the server. Try again.");
      }
    } finally {
      setIsLoading(false);
      setProgress(null);
      runRef.current = null;
    }
  }

  async function handleOpenGame(id: string) {
    setError(null);
    setNotice(null);
    setActiveAction("build");
    try {
      const response = await fetch(`/api/games/${id}`, { cache: "no-store" });
      if (!response.ok) {
        throw new Error();
      }
      setDemoHistory([]);
      showGame((await response.json()).game);
    } catch {
      setError("Envision couldn't open that game. It may have been deleted.");
    }
  }

  function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRun("build", { prompt });
  }

  function handleChange(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    startRun("change", {
      prompt: changeRequest,
      gameId: game?.id,
      spec: game?.spec,
      versionCount: game?.versionCount,
    });
  }

  async function handleUndo() {
    if (!game) {
      return;
    }
    setError(null);
    setNotice(null);

    const previous = demoHistory.at(-1);
    if (isIncognito && previous) {
      setDemoHistory((current) => current.slice(0, -1));
      showGame(previous);
      return;
    }

    try {
      const response = await fetch(`/api/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ undo: true }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        showGame(data.game);
      } else {
        setError(data?.error ?? "The change wasn't undone. Try again.");
      }
    } catch {
      setError("Envision couldn't reach the server. Try again.");
    }
  }

  async function handleStop() {
    const run = runRef.current;
    if (!run) {
      return;
    }

    const outcome =
      activeAction === "change"
        ? "Stopped. Your game wasn't changed"
        : "Stopped. No new game was built";

    setIsStopping(true);
    run.controller.abort();

    if (isIncognito) {
      setNotice(`${outcome}.`);
      setIsStopping(false);
      return;
    }

    try {
      const response = await fetch("/api/generate/stop", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ runId: run.id, provider }),
      });
      const data = await response.json().catch(() => null);
      setNotice(
        data?.unloaded
          ? `${outcome}, and the AI model was closed.`
          : `${outcome}, but the AI model is still open. It will close on its own.`,
      );
    } catch {
      setError(
        "This stopped on the page, but Envision couldn't reach the server to close the AI model.",
      );
    } finally {
      setIsStopping(false);
    }
  }

  const runStatus = (
    <>
      {progress && (
        <BuildProgress
          label={progress.label}
          percent={progress.percent}
          startedAt={progress.startedAt}
        />
      )}
      {(isLoading || isStopping) && (
        <button
          type="button"
          onClick={handleStop}
          disabled={isStopping}
          className="action action-stop h-12 px-6"
        >
          {isStopping
            ? "Stopping..."
            : activeAction === "change"
              ? "Stop changing"
              : "Stop building"}
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
    </>
  );

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-wrap items-center gap-5">
        <GameDrawer
          currentGameId={game?.id ?? null}
          isIncognito={isIncognito}
          disabled={isLoading}
          onOpenGame={handleOpenGame}
        />
        <button
          type="button"
          role="switch"
          aria-checked={isIncognito}
          disabled={isLoading}
          onClick={() => setIncognito(!isIncognito)}
          className="incognito"
        >
          <span aria-hidden="true" className="incognito-track">
            <span />
          </span>
          Incognito
        </button>
      </div>
    <div className="board grid grid-cols-2 lg:grid-cols-4 lg:grid-rows-[auto_1fr_1fr_auto]">
      {game && (
        <section
          ref={resultRef}
          className="col-span-2 flex flex-col gap-4 bg-paper p-4 sm:p-6 lg:col-span-4 lg:row-start-5"
        >
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-ink">
              {game.name}, version {game.versionCount}
            </h2>
            <p className="text-ink">{game.summary}</p>
          </div>
          <iframe
            title="Your game"
            srcDoc={game.html}
            sandbox="allow-scripts"
            className="h-[85vh] w-full border-2 border-ink bg-white lg:h-[640px]"
          />

          <form onSubmit={handleChange} className="flex flex-col gap-4">
            <label className="field-label">
              Change something
              <textarea
                value={changeRequest}
                onChange={(event) => setChangeRequest(event.target.value)}
                rows={3}
                required
                placeholder="Set it in space, rewrite question 3, or add a harder round"
                className="field p-3"
              />
            </label>
            <div className="flex flex-col gap-4 sm:flex-row">
              <button
                type="submit"
                disabled={isLoading || !changeRequest.trim()}
                className="action h-12 px-6 sm:flex-1"
              >
                {isLoading && activeAction === "change"
                  ? "Changing your game..."
                  : "Change my game"}
              </button>
              {(isIncognito ? demoHistory.length > 0 : game.versionCount > 1) && (
                <button
                  type="button"
                  onClick={handleUndo}
                  disabled={isLoading}
                  className="action action-quiet h-12 px-6"
                >
                  Undo last change
                </button>
              )}
              <Link href="/games" className="action action-quiet link-action h-12 px-6">
                Publish or manage
              </Link>
            </div>
            {activeAction === "change" && runStatus}
          </form>
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
              {isLoading && activeAction === "build"
                ? "Building your game..."
                : "Build my game"}
            </button>
          </div>

          {activeAction === "build" && runStatus}
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
    </div>
  );
}
