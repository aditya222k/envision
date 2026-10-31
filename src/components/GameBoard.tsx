"use client";

import Link from "next/link";
import { BuildProgress } from "@/components/BuildProgress";
import {
  Companion,
  EXPERIENCE_LABELS,
  type CompanionAnswer,
  type Experience,
} from "@/components/Companion";
import { GameDrawer } from "@/components/GameDrawer";
import { LiveReveal, type CheckedQuestion } from "@/components/LiveReveal";
import { ReviewPanel } from "@/components/ReviewPanel";
import type { GameDraft } from "@/lib/games/draft";
import { IdeaCards } from "@/components/IdeaCards";
import type { Subject } from "@/lib/games/examples";
import type { ChoiceRound } from "@/lib/games/spec";
import { useIncognito } from "@/lib/incognito";
import { useEffect, useRef, useState, type FormEvent } from "react";
import {
  PROVIDER_IDS,
  PROVIDER_LABELS,
  type ProviderId,
} from "@/lib/llm/types";


type Source = { title: string; url: string };

type GenerateEvent =
  | { type: "progress"; label: string; percent: number }
  | { type: "draft"; draft: GameDraft }
  | { type: "check"; questions: CheckedQuestion[] }
  | { type: "sources"; sources: Source[] }
  | { type: "result"; game: CurrentGame; spec?: unknown }
  | { type: "error"; status: number; error: string }
  | { type: "stopped" };

type CurrentGame = {
  id: string;
  name: string;
  versionCount: number;
  summary: string;
  html: string;
  spec?: { sources?: Source[] };
  reviewRounds?: ChoiceRound[];
  prebuilt?: boolean;
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
  const [game, setGame] = useState<CurrentGame | null>(null);
  const [activeAction, setActiveAction] = useState<RunAction>("build");
  const [isLoading, setIsLoading] = useState(false);
  const [progress, setProgress] = useState<RunProgress | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [needsSetup, setNeedsSetup] = useState(false);
  const [isStopping, setIsStopping] = useState(false);
  const [notice, setNotice] = useState<string | null>(null);
  const [demoHistory, setDemoHistory] = useState<CurrentGame[]>([]);
  const [draft, setDraft] = useState<GameDraft | null>(null);
  const [checks, setChecks] = useState<CheckedQuestion[] | null>(null);
  const [sources, setSources] = useState<Source[]>([]);
  const [companion, setCompanion] = useState<CompanionAnswer | null>(null);
  const [gameStyle, setGameStyle] = useState<Experience | "auto">("auto");
  const [isAsking, setIsAsking] = useState(false);
  const isIncognito = useIncognito();
  const promptRef = useRef<HTMLTextAreaElement>(null);
  const resultRef = useRef<HTMLElement>(null);
  const gameFrameRef = useRef<HTMLIFrameElement>(null);
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
    window.history.replaceState(
      null,
      "",
      next.prebuilt ? "/" : `/?game=${next.id}`,
    );
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
    } else if (event.type === "draft") {
      setDraft(event.draft);
      setChecks(null);
    } else if (event.type === "sources") {
      setSources(event.sources);
    } else if (event.type === "check") {
      setChecks(event.questions);
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
    setDraft(null);
    setChecks(null);

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
      setDraft(null);
      setChecks(null);
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

  // The companion suggests a type of game and asks anything it needs first.
  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!prompt.trim()) {
      promptRef.current?.focus();
      return;
    }
    if (isIncognito) {
      startRun("build", { prompt });
      return;
    }
    setActiveAction("build");
    setError(null);
    setNotice(null);
    setIsAsking(true);
    try {
      const response = await fetch("/api/companion", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          provider,
          demo: isIncognito,
          style: gameStyle === "auto" ? undefined : gameStyle,
        }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok && data) {
        setCompanion(data);
      } else if (response.status === 503) {
        setError(`${PROVIDER_LABELS[provider]} isn't set up yet.`);
        setNeedsSetup(true);
      } else {
        startRun("build", { prompt, experience: "quest" });
      }
    } catch {
      setError("Envision couldn't reach the server. Try again.");
    } finally {
      setIsAsking(false);
    }
  }

  function handleCompanionBuild(experience: Experience, choices: string) {
    setCompanion(null);
    startRun("build", {
      prompt: choices ? `${prompt}\n\nTeacher's choices:\n${choices}` : prompt,
      experience,
    });
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

  async function handleReview(index: number, answerIndex: number | null) {
    if (!game) {
      return;
    }
    setError(null);
    try {
      const response = await fetch(`/api/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ reviewIndex: index, answerIndex }),
      });
      const data = await response.json().catch(() => null);
      if (response.ok) {
        showGame(data.game);
      } else {
        setActiveAction("change");
        setError(data?.error ?? "That didn't save. Try again.");
      }
    } catch {
      setError("Envision couldn't reach the server. Try again.");
    }
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
          showElapsed={false}
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

  // An idea or "make your own" fills in the prompt and moves the teacher there.
  function startFrom(text: string) {
    setPrompt(text);
    promptRef.current?.focus();
  }

  const chevron = (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="#4B4868" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d="m6 9 6 6 6-6" />
    </svg>
  );

  return (
    <div className="flex flex-col">
      <section className="px-4 pt-6 sm:px-10 sm:pt-10">
        <div className="hero max-sm:gap-8 max-sm:p-6">
          <div aria-hidden="true" className="hero-shapes">
            <span className="hero-sun" />
            <span className="hero-ring" />
            <span className="hero-tile" />
          </div>

          <div className="relative z-[1] flex min-w-0 flex-[1_1_520px] flex-col gap-[22px]">
            <h1 className="hero-title">
              <span>What should your class</span>
              <span className="hero-accent">play today?</span>
            </h1>
            <svg width="220" height="16" viewBox="0 0 220 16" aria-hidden="true" className="-mt-3.5 block max-w-full">
              <path d="M4 10C24 2 38 16 58 8S96 2 116 9S154 16 174 8S206 3 216 9" fill="none" stroke="#FFB800" strokeWidth="6" strokeLinecap="round" />
            </svg>
            <p className="m-0 max-w-[480px] text-[19px] leading-normal font-semibold text-ink-soft">
              Describe what students should learn and how they should play.
              Envision builds the game, ready for class.
            </p>
            <div className="flex flex-wrap gap-3">
              <GameDrawer
                currentGameId={game?.id ?? null}
                isIncognito={isIncognito}
                disabled={isLoading}
                onOpenGame={handleOpenGame}
              />
            </div>
          </div>

          <div className="relative z-[1] min-w-0 max-w-[520px] flex-[1_1_440px]">
            <form onSubmit={handleSubmit} className="build-card max-sm:p-5">
              <label htmlFor="game-prompt" className="text-lg font-extrabold">
                Your game
              </label>
              <textarea
                id="game-prompt"
                ref={promptRef}
                value={prompt}
                onChange={(event) => setPrompt(event.target.value)}
                rows={4}
                required
                placeholder="A grade 8 game where students race to match each organelle to its job"
                className="field min-h-[150px] resize-y rounded-2xl p-4 text-[17px] leading-normal"
              />

              <div className="flex flex-wrap items-end gap-3">
                <div className="flex flex-[1_1_170px] flex-col gap-1.5">
                  <label htmlFor="game-style" className="text-[13px] font-extrabold text-ink-soft">
                    Game style
                  </label>
                  <div className="select-wrap">
                    <select
                      id="game-style"
                      value={gameStyle}
                      onChange={(event) =>
                        setGameStyle(event.target.value as Experience | "auto")
                      }
                      className="field text-[15px]"
                    >
                      <option value="auto">Let Envision suggest</option>
                      {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((item) => (
                        <option key={item} value={item}>
                          {EXPERIENCE_LABELS[item]}
                        </option>
                      ))}
                    </select>
                    {chevron}
                  </div>
                </div>
                <div className="flex flex-[1_1_170px] flex-col gap-1.5">
                  <label htmlFor="ai-provider" className="text-[13px] font-extrabold text-ink-soft">
                    AI provider
                  </label>
                  <div className="select-wrap">
                    <select
                      id="ai-provider"
                      value={provider}
                      onChange={(event) =>
                        setProvider(event.target.value as ProviderId)
                      }
                      className="field text-[15px]"
                    >
                      {PROVIDER_IDS.map((id) => (
                        <option key={id} value={id}>
                          {PROVIDER_LABELS[id]}
                        </option>
                      ))}
                    </select>
                    {chevron}
                  </div>
                </div>

                <button
                  type="submit"
                  disabled={isLoading || isAsking || Boolean(companion)}
                  className="action min-h-[52px] flex-[1_1_200px] px-5 text-[17px]"
                >
                  {isAsking
                    ? "Thinking about your idea..."
                    : isLoading && activeAction === "build"
                      ? "Building your game..."
                      : "Build my game"}
                  {!isAsking && !isLoading && (
                    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
                      <path d="M5 12h14M13 6l6 6-6 6" />
                    </svg>
                  )}
                </button>
              </div>

              {companion && (
                <Companion
                  answer={companion}
                  onBuild={handleCompanionBuild}
                  onCancel={() => setCompanion(null)}
                />
              )}
              {activeAction === "build" && runStatus}
            </form>
          </div>
        </div>
      </section>

      <div className="mx-auto flex w-full max-w-[1360px] flex-col gap-10 px-4 sm:px-10 [&:not(:empty)]:pt-10">
      {draft && (
        <div className="sheet overflow-hidden">
          <LiveReveal draft={draft} checks={checks} sources={sources} />
        </div>
      )}
      {game && !draft && (
        <section
          ref={resultRef}
          aria-labelledby="game-title"
          className="sheet flex scroll-mt-24 flex-col gap-5 p-4 sm:p-7"
        >
          <div className="flex flex-col gap-1">
            <h2 id="game-title" className="text-2xl font-bold text-ink">
              {game.name}
            </h2>
            <p className="text-ink-soft">
              Version {game.versionCount}. {game.summary}
            </p>
            <button
              type="button"
              onClick={() => gameFrameRef.current?.requestFullscreen()}
              className="action action-quiet h-10 px-4 sm:self-start"
            >
              Full screen
            </button>
            {(game.spec?.sources?.length ?? 0) > 0 && (
              <p className="text-sm text-ink-soft">
                Built using facts from{" "}
                {game.spec?.sources?.map((source, index) => (
                  <span key={source.url}>
                    {index > 0 && ", "}
                    <a
                      href={source.url}
                      target="_blank"
                      rel="noreferrer"
                      className="underline"
                    >
                      {source.title}
                    </a>
                  </span>
                ))}
                .
              </p>
            )}
          </div>
          <iframe
            ref={gameFrameRef}
            title="Your game"
            srcDoc={game.html}
            sandbox="allow-scripts"
            allowFullScreen
            className="game-frame h-[calc(100vh-96px)] min-h-[520px] w-full"
          />

          {!isIncognito && !game.prebuilt && (
            <ReviewPanel
              rounds={game.reviewRounds ?? []}
              disabled={isLoading}
              onResolve={handleReview}
            />
          )}

          <form onSubmit={handleChange} className="flex flex-col gap-4">
            <label className="field-label">
              Change something
              <textarea
                value={changeRequest}
                onChange={(event) => setChangeRequest(event.target.value)}
                rows={3}
                required
                placeholder="Set it in space, rewrite question 3, or add a harder round"
                className="field resize-y p-4 leading-7"
              />
            </label>
            <div className="flex flex-col gap-3 sm:flex-row">
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
              <Link href="/games" className="action action-quiet h-12 px-6">
                Publish or manage
              </Link>
            </div>
            {activeAction === "change" && runStatus}
          </form>
        </section>
      )}

      </div>

      <IdeaCards
        onUseIdea={startFrom}
        onMakeOwn={(subject: Subject) => startFrom(`A ${subject.toLowerCase()} game where students `)}
      />
    </div>
  );
}
