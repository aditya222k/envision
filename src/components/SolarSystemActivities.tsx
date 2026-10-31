"use client";

import { useRef, useState } from "react";
import dynamic from "next/dynamic";
import SolarSystemExplorer from "./SolarSystemExplorer";

const PlanetQuiz = dynamic(() => import("./PlanetQuiz"), {
  loading: () => <p role="status" className="text-chalk">Preparing your mission…</p>,
});

export default function SolarSystemActivities() {
  const [mode, setMode] = useState<"explore" | "quiz">("explore");
  const [quizStarted, setQuizStarted] = useState(false);
  const exploreTab = useRef<HTMLButtonElement>(null);
  const quizTab = useRef<HTMLButtonElement>(null);
  function choose(next: "explore" | "quiz") {
    if (next === "quiz") setQuizStarted(true);
    setMode(next);
  }
  return (
    <div className="flex flex-col gap-6">
      <div role="tablist" aria-label="Solar System activities" className="solar-activity-tabs"
        onKeyDown={(event) => {
          if (!["ArrowLeft", "ArrowRight", "Home", "End"].includes(event.key)) return;
          event.preventDefault();
          const next = event.key === "Home" ? "explore" : event.key === "End" ? "quiz" : mode === "explore" ? "quiz" : "explore";
          choose(next);
          (next === "explore" ? exploreTab : quizTab).current?.focus();
        }}>
        <button ref={exploreTab} id="explore-tab" role="tab" aria-selected={mode === "explore"} aria-controls="explore-panel" tabIndex={mode === "explore" ? 0 : -1} onClick={() => choose("explore")}>Explore in 3D</button>
        <button ref={quizTab} id="quiz-tab" role="tab" aria-selected={mode === "quiz"} aria-controls="quiz-panel" tabIndex={mode === "quiz" ? 0 : -1} onClick={() => choose("quiz")}>Who’s That Planet?</button>
      </div>
      <div id="explore-panel" role="tabpanel" aria-labelledby="explore-tab" hidden={mode !== "explore"}>
        <SolarSystemExplorer active={mode === "explore"} onStartQuiz={() => choose("quiz")} />
      </div>
      <div id="quiz-panel" role="tabpanel" aria-labelledby="quiz-tab" hidden={mode !== "quiz"}>
        {quizStarted && <PlanetQuiz active={mode === "quiz"} onExplore={() => choose("explore")} />}
      </div>
    </div>
  );
}
