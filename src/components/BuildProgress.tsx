"use client";

import { useEffect, useState } from "react";

function formatElapsed(milliseconds: number) {
  const seconds = Math.max(Math.floor(milliseconds / 1000), 0);
  const minutes = Math.floor(seconds / 60);
  return `${minutes}:${String(seconds % 60).padStart(2, "0")}`;
}

export function BuildProgress({
  label,
  percent,
  startedAt,
}: {
  label: string;
  percent: number;
  startedAt: number;
}) {
  const [now, setNow] = useState(startedAt);

  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(timer);
  }, []);

  const rounded = Math.round(percent);

  return (
    <div className="flex flex-col gap-2">
      <div className="flex justify-between gap-4 text-ink">
        <span className="font-bold">{label}</span>
        <span className="tabular-nums">
          {rounded}% · {formatElapsed(now - startedAt)}
        </span>
      </div>
      <div
        role="progressbar"
        aria-label={label}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={rounded}
        className="progress"
      >
        <span style={{ width: `${percent}%` }} />
      </div>
    </div>
  );
}
