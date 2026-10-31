"use client";

import { useParams } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type PathTopic = {
  id: string;
  title: string;
  storyBeat: string;
  gameId: string;
};

type PathChapter = {
  id: string;
  title: string;
  story: string;
  topics: PathTopic[];
};

type Path = {
  title: string;
  premise: string;
  ending: string;
  hero: { name: string; emoji: string };
  chapters: PathChapter[];
};

function readCompleted(id: string): string[] {
  try {
    return JSON.parse(window.localStorage.getItem(`envision-path-${id}`) ?? "[]");
  } catch {
    return [];
  }
}

function saveCompleted(id: string, completed: string[]) {
  try {
    window.localStorage.setItem(`envision-path-${id}`, JSON.stringify(completed));
  } catch {
    // Progress lasts until the page closes when storage is unavailable.
  }
}

export function StudentPath() {
  const { id } = useParams<{ id: string }>();
  const [path, setPath] = useState<Path | null>(null);
  const [completed, setCompleted] = useState<string[]>([]);
  const [hasFinishedGame, setHasFinishedGame] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const frameRef = useRef<HTMLIFrameElement>(null);

  useEffect(() => {
    fetch(`/api/path/${id}`, { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error();
        }
        return response.json();
      })
      .then((data) => {
        setCompleted(readCompleted(id));
        setPath(data.path);
      })
      .catch(() =>
        setError("This course isn't available. Ask your teacher for a new link."),
      );
  }, [id]);

  const topics =
    path?.chapters.flatMap((chapter) =>
      chapter.topics.map((topic) => ({ chapter, topic })),
    ) ?? [];
  const current = topics.find(({ topic }) => !completed.includes(topic.id));

  useEffect(() => {
    function handleMessage(event: MessageEvent) {
      if (
        event.source === frameRef.current?.contentWindow &&
        event.data?.type === "envision-finished" &&
        event.data.won === true
      ) {
        setHasFinishedGame(true);
      }
    }
    window.addEventListener("message", handleMessage);
    return () => window.removeEventListener("message", handleMessage);
  }, []);

  function handleContinue() {
    if (!current) {
      return;
    }
    const next = [...completed, current.topic.id];
    setCompleted(next);
    saveCompleted(id, next);
    setHasFinishedGame(false);
  }

  if (error) {
    return <p className="bg-paper p-6 font-bold text-ink">{error}</p>;
  }
  if (!path) {
    return <p className="bg-paper p-6 text-ink">Loading...</p>;
  }

  return (
    <>
      <section className="flex flex-col gap-2 bg-paper p-6 sm:p-10">
        <h1 className="font-display text-4xl leading-none text-ink sm:text-5xl">
          {path.title}
        </h1>
        <p className="text-lg text-ink">{path.premise}</p>
        <p className="font-bold text-ink">
          {path.hero.emoji} {path.hero.name} · {completed.length} of{" "}
          {topics.length} complete
        </p>
      </section>

      <nav aria-label="Your progress" className="flex flex-wrap gap-2 bg-paper p-6">
        {topics.map(({ topic }) => (
          <span
            key={topic.id}
            aria-current={topic.id === current?.topic.id ? "step" : undefined}
            className={`path-step ${completed.includes(topic.id) ? "path-step-done" : ""}`}
          >
            {topic.title}
          </span>
        ))}
      </nav>

      {current ? (
        <section className="flex flex-col gap-4 bg-paper p-4 sm:p-6">
          <div className="flex flex-col gap-1">
            <h2 className="text-2xl font-bold text-ink">
              {current.chapter.title}: {current.topic.title}
            </h2>
            <p className="text-ink">{current.topic.storyBeat}</p>
          </div>
          <iframe
            key={current.topic.id}
            ref={frameRef}
            title={current.topic.title}
            src={`/play/${current.topic.gameId}`}
            sandbox="allow-scripts"
            className="h-[85vh] w-full border-2 border-ink bg-white lg:h-[640px]"
          />
          {hasFinishedGame && (
            <button
              type="button"
              onClick={handleContinue}
              className="action h-12 px-6"
            >
              Continue the story
            </button>
          )}
        </section>
      ) : (
        <section className="flex flex-col gap-2 bg-paper p-6 sm:p-10">
          <h2 className="font-display text-3xl leading-none text-ink">
            You finished the story!
          </h2>
          <p className="text-lg text-ink">{path.ending}</p>
        </section>
      )}
    </>
  );
}
