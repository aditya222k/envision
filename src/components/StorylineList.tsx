"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, type FormEvent } from "react";
import { BuildProgress } from "@/components/BuildProgress";
import type { Storyline } from "@/lib/games/storyline";
import { readEvents } from "@/lib/readEvents";

type OutlineEvent =
  | { type: "progress"; label: string; percent: number }
  | { type: "result"; storyline: Storyline }
  | { type: "error"; error: string }
  | { type: "stopped" };

export function StorylineList() {
  const router = useRouter();
  const [storylines, setStorylines] = useState<Storyline[] | null>(null);
  const [subject, setSubject] = useState("");
  const [notes, setNotes] = useState("");
  const [progress, setProgress] = useState<{
    label: string;
    percent: number;
    startedAt: number;
  } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const runRef = useRef<{ id: string; controller: AbortController } | null>(
    null,
  );

  useEffect(() => {
    fetch("/api/storylines", { cache: "no-store" })
      .then((response) => response.json())
      .then((data) => setStorylines(data.storylines))
      .catch(() => setError("Envision couldn't load your storylines."));
  }, []);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);
    setProgress({
      label: "Getting started",
      percent: 0,
      startedAt: Date.now(),
    });

    const run = { id: crypto.randomUUID(), controller: new AbortController() };
    runRef.current = run;

    try {
      const response = await fetch("/api/storylines", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          subject,
          notes,
          provider: "ollama",
          runId: run.id,
        }),
        signal: run.controller.signal,
      });
      if (!response.ok) {
        const data = await response.json().catch(() => null);
        setError(data?.error ?? "That didn't work. Try again.");
        return;
      }
      await readEvents<OutlineEvent>(response, (next) => {
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
          router.push(`/storylines/${next.storyline.id}`);
        } else if (next.type === "error") {
          setError(next.error);
        }
      });
    } catch {
      if (!run.controller.signal.aborted) {
        setError("Envision couldn't reach the server. Try again.");
      }
    } finally {
      setProgress(null);
      runRef.current = null;
    }
  }

  function handleStop() {
    const run = runRef.current;
    if (!run) {
      return;
    }
    run.controller.abort();
    fetch("/api/generate/stop", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ runId: run.id, provider: "ollama" }),
    }).catch(() => {});
  }

  return (
    <>
      <form
        onSubmit={handleSubmit}
        className="flex flex-col gap-4 bg-paper p-6 sm:p-10"
      >
        <h2 className="text-2xl font-bold text-ink">Plan a new storyline</h2>
        <label className="field-label">
          Subject
          <input
            value={subject}
            onChange={(event) => setSubject(event.target.value)}
            required
            maxLength={80}
            placeholder="Grade 8 Science"
            className="field h-12 px-3"
          />
        </label>
        <label className="field-label">
          What should it cover?
          <textarea
            value={notes}
            onChange={(event) => setNotes(event.target.value)}
            rows={3}
            placeholder="List the chapters or levels you want, or leave this blank"
            className="field p-3"
          />
        </label>
        <button
          type="submit"
          disabled={Boolean(progress) || !subject.trim()}
          className="action h-12 px-6"
        >
          {progress ? "Planning your storyline..." : "Plan my storyline"}
        </button>
        {progress && (
          <>
            <BuildProgress {...progress} />
            <button
              type="button"
              onClick={handleStop}
              className="action action-stop h-12 px-6"
            >
              Stop planning
            </button>
          </>
        )}
        {error && (
          <p role="alert" className="font-bold text-history">
            {error}
          </p>
        )}
      </form>

      {storylines?.map((storyline) => (
        <Link
          key={storyline.id}
          href={`/storylines/${storyline.id}`}
          className="flex flex-col gap-1 bg-paper p-6 text-ink hover:bg-[var(--pencil-light)]"
        >
          <span className="text-xl font-bold">{storyline.title}</span>
          <span>{storyline.subject}</span>
          <span className="text-sm font-bold">
            {storyline.chapters.length} chapters ·{" "}
            {storyline.published ? "Published" : "Not published"}
          </span>
        </Link>
      ))}
    </>
  );
}
