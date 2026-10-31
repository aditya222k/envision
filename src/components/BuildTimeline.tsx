"use client";

import { BuildProgress } from "@/components/BuildProgress";

export type QueueItem = {
  topicId: string;
  title: string;
  status: "waiting" | "building" | "done" | "failed" | "stopped";
  seconds?: number;
  detail?: string;
};

const STATUS_LABELS: Record<QueueItem["status"], string> = {
  waiting: "Waiting",
  building: "Building now",
  done: "Done",
  failed: "Failed",
  stopped: "Not built",
};

function estimateRemaining(items: QueueItem[]) {
  const finished = items.filter((item) => item.seconds !== undefined);
  const left = items.filter(
    (item) => item.status === "waiting" || item.status === "building",
  ).length;
  if (finished.length === 0 || left === 0) {
    return null;
  }
  const average =
    finished.reduce((total, item) => total + (item.seconds ?? 0), 0) /
    finished.length;
  return `About ${Math.max(Math.ceil((average * left) / 60), 1)} min left`;
}

export function BuildTimeline({
  items,
  startedAt,
  currentPercent,
  isRunning,
  onStop,
}: {
  items: QueueItem[];
  startedAt: number;
  currentPercent: number;
  isRunning: boolean;
  onStop: () => void;
}) {
  const finished = items.filter(
    (item) => item.status === "done" || item.status === "failed",
  ).length;
  const percent =
    ((finished + (isRunning ? currentPercent / 100 : 0)) / items.length) * 100;
  const position = Math.min(finished + 1, items.length);
  const estimate = estimateRemaining(items);

  return (
    <section
      aria-label="Build all games"
      className="flex flex-col gap-4 bg-paper p-6 sm:p-10"
    >
      <h2 className="text-2xl font-bold text-ink">Build timeline</h2>
      {isRunning ? (
        <BuildProgress
          label={`Building game ${position} of ${items.length}`}
          percent={percent}
          startedAt={startedAt}
        />
      ) : (
        <p role="status" className="font-bold text-ink">
          {items.filter((item) => item.status === "done").length} of{" "}
          {items.length} games built
        </p>
      )}
      {isRunning && estimate && <p className="text-ink">{estimate}</p>}

      <ol className="flex flex-col">
        {items.map((item, index) => (
          <li
            key={item.topicId}
            aria-current={item.status === "building" ? "step" : undefined}
            className={`timeline-item timeline-${item.status}`}
          >
            <span className="font-bold">
              {index + 1}. {item.title}
            </span>
            <span>
              {STATUS_LABELS[item.status]}
              {item.seconds !== undefined ? ` in ${item.seconds}s` : ""}
            </span>
            {item.detail && (
              <span className="w-full text-sm">{item.detail}</span>
            )}
          </li>
        ))}
      </ol>

      {isRunning && (
        <button
          type="button"
          onClick={onStop}
          className="action action-stop h-12 px-6"
        >
          Stop building all
        </button>
      )}
    </section>
  );
}
