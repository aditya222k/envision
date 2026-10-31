"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { BuildProgress } from "@/components/BuildProgress";
import { BuildTimeline, type QueueItem } from "@/components/BuildTimeline";
import { StoryString } from "@/components/StoryString";
import { useNoteDrag } from "@/components/useNoteDrag";
import type { GameSummary } from "@/lib/games/store";
import type { Storyline, Topic } from "@/lib/games/storyline";
import { readEvents } from "@/lib/readEvents";

type BuildEvent =
  | { type: "progress"; label: string; percent: number }
  | { type: "result"; game: { id: string } }
  | { type: "error"; error: string }
  | { type: "stopped" };

async function fetchStoryline(id: string): Promise<Storyline> {
  const response = await fetch(`/api/storylines/${id}`, { cache: "no-store" });
  if (!response.ok) {
    throw new Error();
  }
  return (await response.json()).storyline;
}

export function StorylineEditor() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [storyline, setStoryline] = useState<Storyline | null>(null);
  const [games, setGames] = useState<GameSummary[]>([]);
  const [buildingTopic, setBuildingTopic] = useState<string | null>(null);
  const [progress, setProgress] = useState<{
    label: string;
    percent: number;
    startedAt: number;
  } | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editingNote, setEditingNote] = useState<string | null>(null);
  const [queue, setQueue] = useState<{
    items: QueueItem[];
    startedAt: number;
  } | null>(null);
  const [isQueueRunning, setIsQueueRunning] = useState(false);
  const stopQueueRef = useRef(false);
  const storyBoardRef = useRef<HTMLDivElement>(null);
  const runRef = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );

  useEffect(() => {
    fetchStoryline(id)
      .then(setStoryline)
      .catch(() => setError("Envision couldn't open that storyline."));
    fetch("/api/games", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setGames(data.games))
      .catch(() => {});
  }, [id]);

  async function save(body: object) {
    setError(null);
    setMessage(null);
    const response = await fetch(`/api/storylines/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await response.json().catch(() => null);
    if (response.ok) {
      setStoryline(data.storyline);
      return true;
    }
    setError(data?.error ?? "That didn't save. Try again.");
    return false;
  }

  function updateTopic(topicId: string, changes: Partial<Topic>) {
    if (!storyline) {
      return;
    }
    save({
      ...storyline,
      chapters: storyline.chapters.map((chapter) => ({
        ...chapter,
        topics: chapter.topics.map((topic) =>
          topic.id === topicId ? { ...topic, ...changes } : topic,
        ),
      })),
    });
  }

  // Only the story notes swap. Each level keeps its name, goal and game.
  function swapNotes(chapterId: string, fromId: string, toId: string) {
    if (!storyline || fromId === toId) {
      return;
    }
    const chapter = storyline.chapters.find((item) => item.id === chapterId);
    const from = chapter?.topics.find((topic) => topic.id === fromId);
    const to = chapter?.topics.find((topic) => topic.id === toId);
    if (!chapter || !from || !to) {
      return;
    }
    const previous = storyline;
    const next = {
      ...storyline,
      chapters: storyline.chapters.map((item) =>
        item.id === chapterId
          ? {
              ...item,
              topics: item.topics.map((topic) => {
                if (topic.id === fromId) {
                  return { ...topic, storyBeat: to.storyBeat };
                }
                return topic.id === toId
                  ? { ...topic, storyBeat: from.storyBeat }
                  : topic;
              }),
            }
          : item,
      ),
    };
    // The board updates at once, and goes back if the save fails.
    setStoryline(next);
    save(next).then((saved) => {
      if (!saved) {
        setStoryline(previous);
      }
    });
  }

  const { isDragging, onPointerDown } = useNoteDrag(swapNotes);

  function addTopic(chapterId: string) {
    if (!storyline) {
      return;
    }
    const topic = {
      id: crypto.randomUUID(),
      title: "New level",
      goal: "Describe what students should learn.",
      storyBeat: "Describe what happens in this level.",
      gameId: null,
      builtBeat: null,
    };
    save({
      ...storyline,
      chapters: storyline.chapters.map((chapter) =>
        chapter.id === chapterId
          ? { ...chapter, topics: [...chapter.topics, topic] }
          : chapter,
      ),
    });
  }

  function removeTopic(chapterId: string, topicId: string) {
    if (!storyline) {
      return;
    }
    save({
      ...storyline,
      chapters: storyline.chapters.map((chapter) =>
        chapter.id === chapterId
          ? {
              ...chapter,
              topics: chapter.topics.filter((topic) => topic.id !== topicId),
            }
          : chapter,
      ),
    });
  }

  function updateQueueItem(topicId: string, changes: Partial<QueueItem>) {
    setQueue((current) =>
      current
        ? {
            ...current,
            items: current.items.map((item) =>
              item.topicId === topicId ? { ...item, ...changes } : item,
            ),
          }
        : current,
    );
  }

  async function handleBuildAll() {
    const levels =
      storyline?.chapters.flatMap((chapter) =>
        chapter.topics.filter((topic) => !topic.gameId),
      ) ?? [];
    if (levels.length === 0) {
      return;
    }

    stopQueueRef.current = false;
    setIsQueueRunning(true);
    setQueue({
      startedAt: Date.now(),
      items: levels.map((topic) => ({
        topicId: topic.id,
        title: topic.title,
        status: "waiting",
      })),
    });

    for (const topic of levels) {
      if (stopQueueRef.current) {
        updateQueueItem(topic.id, { status: "stopped" });
        continue;
      }

      updateQueueItem(topic.id, { status: "building" });
      const startedAt = Date.now();
      const outcome = await buildTopic(topic);
      const seconds = Math.round((Date.now() - startedAt) / 1000);

      if (outcome.status === "built") {
        updateQueueItem(topic.id, { status: "done", seconds });
      } else if (outcome.status === "failed") {
        updateQueueItem(topic.id, {
          status: "failed",
          seconds,
          detail: outcome.error,
        });
      } else {
        updateQueueItem(topic.id, { status: "stopped" });
      }
    }

    setIsQueueRunning(false);
  }

  function handleStopAll() {
    stopQueueRef.current = true;
    handleStop();
  }

  async function buildTopic(topic: Topic): Promise<{
    status: "built" | "failed" | "stopped";
    error?: string;
  }> {
    setBuildingTopic(topic.id);
    setError(null);
    setMessage(null);
    setProgress({
      label: "Getting started",
      percent: 0,
      startedAt: Date.now(),
    });

    const run = { id: crypto.randomUUID(), controller: new AbortController() };
    runRef.current = run;
    let wasBuilt = false;
    let failure: string | null = null;

    try {
      const response = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt: topic.title,
          provider: "ollama",
          runId: run.id,
          storylineId: id,
          topicId: topic.id,
        }),
        signal: run.controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        failure = data?.error ?? "That didn't work. Try again.";
        setError(failure);
        return { status: "failed", error: failure ?? undefined };
      }
      await readEvents<BuildEvent>(response, (next) => {
        if (next.type === "progress") {
          setProgress((current) =>
            current
              ? {
                  ...current,
                  label: next.label,
                  percent: Math.max(current.percent, next.percent),
                }
              : current,
          );
        } else if (next.type === "result") {
          wasBuilt = true;
        } else if (next.type === "error") {
          failure = next.error;
          setError(next.error);
        }
      });
      setStoryline(await fetchStoryline(id));
    } catch {
      if (!run.controller.signal.aborted) {
        failure = "Envision couldn't reach the server.";
        setError(`${failure} Try again.`);
      }
    } finally {
      setProgress(null);
      setBuildingTopic(null);
      runRef.current = null;
    }

    if (wasBuilt) {
      return { status: "built" };
    }
    return failure
      ? { status: "failed", error: failure }
      : { status: "stopped" };
  }

  function handleStop() {
    const run = runRef.current;
    if (!run) {
      return;
    }
    run.controller.abort();
    setMessage("Stopped. No new game was built.");
    fetch("/api/generate/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, provider: "ollama" }),
    }).catch(() => {});
  }

  async function handleCopy() {
    const link = `${window.location.origin}/path/${id}`;
    try {
      await navigator.clipboard.writeText(link);
      setMessage("Link copied.");
    } catch {
      setMessage(`Copy this link: ${link}`);
    }
  }

  async function handleDelete() {
    const response = await fetch(`/api/storylines/${id}`, { method: "DELETE" });
    if (response.ok) {
      router.push("/storylines");
    } else {
      setError("The storyline wasn't deleted. Try again.");
    }
  }

  if (!storyline) {
    return (
      <p className="bg-paper p-6 text-ink">
        {error ?? "Loading your storyline..."}
      </p>
    );
  }

  const isBusy = buildingTopic !== null || isQueueRunning;
  const topicCount = storyline.chapters.reduce(
    (total, chapter) => total + chapter.topics.length,
    0,
  );
  const readyCount = storyline.chapters.reduce(
    (total, chapter) =>
      total + chapter.topics.filter((topic) => topic.gameId).length,
    0,
  );

  return (
    <>
      <section className="flex flex-col gap-3 bg-paper p-6 sm:p-10">
        <p className="font-bold text-ink">{storyline.subject}</p>
        <h1 className="font-display text-4xl leading-none text-ink">
          {storyline.title}
        </h1>
        <p className="text-lg text-ink">{storyline.premise}</p>
        <p className="text-ink">
          Hero: {storyline.hero.emoji} {storyline.hero.name}
        </p>
        <p className="font-bold text-ink">
          {readyCount} of {topicCount} levels have a game
        </p>
        <div className="flex flex-wrap gap-3">
          {readyCount < topicCount && (
            <button
              type="button"
              disabled={isBusy || isQueueRunning}
              onClick={handleBuildAll}
              className="action h-11 px-5"
            >
              Build all games ({topicCount - readyCount})
            </button>
          )}
          {storyline.published ? (
            <>
              <button
                type="button"
                onClick={handleCopy}
                className="action h-11 px-5"
              >
                Copy student link
              </button>
              <button
                type="button"
                onClick={() => save({ publish: false })}
                className="action action-quiet h-11 px-5"
              >
                Unpublish
              </button>
            </>
          ) : (
            <button
              type="button"
              disabled={isBusy}
              onClick={() => save({ publish: true })}
              className="action h-11 px-5"
            >
              Publish to students
            </button>
          )}
          <button
            type="button"
            onClick={() => setIsDeleting(true)}
            className="action action-quiet h-11 px-5"
          >
            Delete storyline
          </button>
        </div>
        {isDeleting && (
          <div className="flex flex-col gap-3 rounded-xl bg-[#fbe9e7] p-4">
            <p className="font-bold text-ink">
              Delete {storyline.title}? Your games stay in your catalog.
            </p>
            <div className="flex flex-wrap gap-3">
              <button
                type="button"
                onClick={handleDelete}
                className="action action-stop h-11 px-5"
              >
                Delete storyline
              </button>
              <button
                type="button"
                onClick={() => setIsDeleting(false)}
                className="action action-quiet h-11 px-5"
              >
                Keep storyline
              </button>
            </div>
          </div>
        )}
        {message && (
          <p role="status" className="font-bold text-science">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="font-bold text-history">
            {error}
          </p>
        )}
      </section>

      {queue && (
        <BuildTimeline
          items={queue.items}
          startedAt={queue.startedAt}
          currentPercent={progress?.percent ?? 0}
          isRunning={isQueueRunning}
          onStop={handleStopAll}
        />
      )}

      <div ref={storyBoardRef} className="story-chapters">
        <StoryString
          containerRef={storyBoardRef}
          layoutKey={storyline.chapters
            .flatMap((chapter) => chapter.topics.map((topic) => topic.id))
            .join()}
          isLive={isDragging}
        />
      {storyline.chapters.map((chapter, chapterIndex) => (
        <section key={chapter.id} className="flex flex-col gap-4 bg-paper p-6 sm:p-10">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-ink">
              Chapter {chapterIndex + 1}: {chapter.title}
            </h2>
            <p className="text-ink">{chapter.story}</p>
            <p className="text-sm text-ink">
              The string joins the notes in story order. Drag a note onto another level to swap them. World:{" "}
              {chapter.theme}.
            </p>
          </div>

          <div className="story-board">
            {chapter.topics.map((topic, levelIndex) => (
              <article
                key={topic.id}
                className="story-level"
              >
                <h3 className="font-bold text-ink">Level {levelIndex + 1}</h3>
                <label className="field-label">
                  Level name
                  <input
                    key={topic.title}
                    defaultValue={topic.title}
                    disabled={isBusy}
                    onBlur={(event) => {
                      const title = event.target.value.trim();
                      if (title && title !== topic.title) {
                        updateTopic(topic.id, { title });
                      }
                    }}
                    className="field h-11 px-3"
                  />
                </label>

                <div
                  data-story-note
                  data-note-id={topic.id}
                  data-note-chapter={chapter.id}
                  onPointerDown={(event) =>
                    !isBusy && onPointerDown(event, chapter.id, topic.id)
                  }
                  className="story-note"
                >
                  <span data-story-pin className="story-pin-spot" />
                  <p className="text-sm font-bold text-ink">
                    <span aria-hidden="true">⠿</span> Story step{" "}
                    {storyline.chapters
                      .slice(0, chapterIndex)
                      .reduce((total, item) => total + item.topics.length, 0) +
                      levelIndex +
                      1}
                  </p>
                  {editingNote === topic.id ? (
                    <label className="flex flex-col gap-1 text-sm font-bold text-ink">
                      Story note
                      <textarea
                        autoFocus
                        defaultValue={topic.storyBeat}
                        rows={5}
                        onBlur={(event) => {
                          const storyBeat = event.target.value.trim();
                          setEditingNote(null);
                          if (storyBeat && storyBeat !== topic.storyBeat) {
                            updateTopic(topic.id, { storyBeat });
                          }
                        }}
                        className="w-full resize-y bg-transparent text-base font-normal"
                      />
                    </label>
                  ) : (
                    <p className="flex-1 text-ink">{topic.storyBeat}</p>
                  )}
                  <div className="flex justify-between gap-2">
                    <button
                      type="button"
                      disabled={isBusy || levelIndex === 0}
                      aria-label={`Move the story note in level ${levelIndex + 1} one level earlier`}
                      onClick={() =>
                        swapNotes(
                          chapter.id,
                          topic.id,
                          chapter.topics[levelIndex - 1].id,
                        )
                      }
                      className="note-move"
                    >
                      Earlier
                    </button>
                    <button
                      type="button"
                      disabled={isBusy}
                      onClick={() => setEditingNote(topic.id)}
                      aria-label={`Edit the story note in level ${levelIndex + 1}`}
                      className="note-move"
                    >
                      Edit
                    </button>
                    <button
                      type="button"
                      disabled={
                        isBusy || levelIndex === chapter.topics.length - 1
                      }
                      aria-label={`Move the story note in level ${levelIndex + 1} one level later`}
                      onClick={() =>
                        swapNotes(
                          chapter.id,
                          topic.id,
                          chapter.topics[levelIndex + 1].id,
                        )
                      }
                      className="note-move"
                    >
                      Later
                    </button>
                  </div>
                </div>

                {topic.gameId &&
                  topic.builtBeat &&
                  topic.builtBeat !== topic.storyBeat && (
                    <p className="text-sm font-bold text-history">
                      This game was built for a different story note. Rebuild
                      it so the story matches.
                    </p>
                  )}

                <div className="flex flex-col gap-3">
                  {topic.gameId ? (
                    <Link
                      href={`/?game=${topic.gameId}`}
                      className="action link-action h-11 px-4"
                    >
                      Open game
                    </Link>
                  ) : null}
                  <button
                    type="button"
                    disabled={isBusy}
                    onClick={() => buildTopic(topic)}
                    className={`action h-11 px-4 ${topic.gameId ? "action-quiet" : ""}`}
                  >
                    {topic.gameId ? "Rebuild this game" : "Build this game"}
                  </button>
                  <label className="field-label">
                    Use a saved game
                    <select
                      value={topic.gameId ?? ""}
                      disabled={isBusy}
                      onChange={(event) =>
                        updateTopic(topic.id, {
                          gameId: event.target.value || null,
                          builtBeat: null,
                        })
                      }
                      className="field h-11 px-2"
                    >
                      <option value="">None</option>
                      {games.map((game) => (
                        <option key={game.id} value={game.id}>
                          {game.name}
                        </option>
                      ))}
                    </select>
                  </label>
                  <button
                    type="button"
                    disabled={isBusy || chapter.topics.length === 1}
                    onClick={() => removeTopic(chapter.id, topic.id)}
                    className="action action-quiet h-11 px-4"
                  >
                    Remove level
                  </button>
                </div>

                {!isQueueRunning && buildingTopic === topic.id && progress && (
                  <>
                    <BuildProgress {...progress} />
                    <button
                      type="button"
                      onClick={handleStop}
                      className="action action-stop h-11 px-4"
                    >
                      Stop building
                    </button>
                  </>
                )}
              </article>
            ))}
          </div>

          <button
            type="button"
            disabled={isBusy}
            onClick={() => addTopic(chapter.id)}
            className="action action-quiet h-11 px-5 sm:self-start"
          >
            Add a level
          </button>
        </section>
      ))}
      </div>

      <section className="flex flex-col gap-1 bg-paper p-6 sm:p-10">
        <h2 className="text-2xl font-bold text-ink">How it ends</h2>
        <p className="text-ink">{storyline.ending}</p>
      </section>
    </>
  );
}
