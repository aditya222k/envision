"use client";

import dynamic from "next/dynamic";
import { Component, useEffect, useReducer, useRef, useState, type ReactNode } from "react";
import { PLANETS } from "@/lib/explorer/solarSystem";
import { initialQuiz, PLANET_QUIZ, quizReducer, shuffledPlanetIds } from "@/lib/explorer/planetQuiz";

const QuizPlanetScene = dynamic(() => import("./QuizPlanetScene"), {
  ssr: false,
  loading: () => <p className="quiz-preview-fallback" role="status">Preparing your planet…</p>,
});

class PreviewBoundary extends Component<{ children: ReactNode }, { failed: boolean }> {
  state = { failed: false };
  static getDerivedStateFromError() { return { failed: true }; }
  render() {
    return this.state.failed
      ? <p className="quiz-preview-fallback">The 3D preview is unavailable. You can still finish the quiz.</p>
      : this.props.children;
  }
}

export default function PlanetQuiz({ active, onExplore }: { active: boolean; onExplore: () => void }) {
  const [state, dispatch] = useReducer(quizReducer, undefined, () => initialQuiz(shuffledPlanetIds()));
  const [guess, setGuess] = useState("");
  const input = useRef<HTMLInputElement>(null);
  const heading = useRef<HTMLHeadingElement>(null);
  const planet = PLANETS.find((item) => item.id === state.order[state.round])!;
  const activity = PLANET_QUIZ[planet.id];
  const question = activity.questions[state.question];
  const answered = state.selected !== null;
  const revealed = state.phase === "reveal" || state.phase === "question";

  useEffect(() => {
    if (!active) return;
    if (state.phase === "guess") input.current?.focus({ preventScroll: true });
    else heading.current?.focus({ preventScroll: true });
  }, [active, state.round, state.phase, state.question]);

  function advance() {
    setGuess("");
    dispatch({ type: "continue" });
  }

  if (state.phase === "complete") return (
    <section className="sheet quiz-results p-6 sm:p-10">
      <p className="font-bold">Mission complete</p>
      <h2 ref={heading} tabIndex={-1} className="font-display text-4xl text-ink">You explored all eight planets!</h2>
      <p className="text-xl">Your score: <strong>{state.score} / 160</strong></p>
      <p>You identified {state.planetsGuessed} of 8 planets and answered {state.answersCorrect} of 16 follow-up questions correctly.</p>
      <p>Every clue helped you learn something new. Explore again or try a fresh order.</p>
      <div className="flex flex-wrap gap-3">
        <button className="action h-12 px-5" onClick={() => { setGuess(""); dispatch({ type: "restart", order: shuffledPlanetIds() }); }}>Play again</button>
        <button className="action action-quiet h-12 px-5" onClick={onExplore}>Explore in 3D</button>
      </div>
    </section>
  );

  return (
    <section aria-label="Who's That Planet quiz" className="flex flex-col gap-5">
      <div className="flex flex-wrap items-center justify-between gap-3 font-bold text-chalk">
        <p>Planet {state.round + 1} of 8</p><p>Score: {state.score}</p>
      </div>
      <progress className="quiz-progress" aria-label="Planets completed" max={8} value={state.round} />
      <div className="planet-quiz-layout">
        <div className="quiz-planet-window">
          {revealed ? (
            <>
              <div className="quiz-reveal-title" role="status">
                <span>{state.identified ? "You got it!" : "Mystery solved"}</span>
                <strong className="font-display">It’s {planet.name}!</strong>
              </div>
              {active && <PreviewBoundary key={planet.id}><QuizPlanetScene planet={planet} /></PreviewBoundary>}
              <p className="quiz-drag-hint">Drag to rotate · Scroll or pinch to zoom</p>
            </>
          ) : (
            <div className="quiz-mystery">
              <span className="quiz-eyebrow">A visitor from our solar system</span>
              <div className="quiz-silhouette" aria-label="Hidden mystery planet"><span aria-hidden="true">?</span></div>
              <p className="font-display text-3xl">Who’s that planet?</p>
              <p>Follow the clues. Name your discovery.</p>
            </div>
          )}
        </div>
        <div className="sheet quiz-question-panel p-5 sm:p-7">
          {state.phase === "guess" ? (
            <>
              <h2 ref={heading} tabIndex={-1} className="font-display text-3xl">Read the clues</h2>
              <ol className="quiz-clues" aria-label="Planet clues" aria-live="polite">
                {activity.clues.slice(0, state.clues).map((clue, index) => <li key={clue}><span aria-hidden="true">{index + 1}</span>{clue}</li>)}
              </ol>
              <form onSubmit={(event) => { event.preventDefault(); dispatch({ type: "guess", value: guess }); }} className="flex flex-col gap-3">
                <label htmlFor="planet-guess" className="font-bold">Which planet am I?</label>
                <input ref={input} id="planet-guess" className="field p-3" value={guess} onChange={(event) => setGuess(event.target.value)} placeholder="Type a planet name" autoComplete="off" spellCheck={false} maxLength={60} aria-describedby="guess-feedback guess-points" />
                <button className="action h-12 px-5" type="submit" disabled={!guess.trim()}>Guess planet</button>
              </form>
              <p id="guess-feedback" role="status" className="quiz-feedback">{state.feedback}</p>
              <div className="flex flex-wrap gap-3">
                <button className="action action-quiet min-h-11 px-4" disabled={state.clues >= activity.clues.length} onClick={() => dispatch({ type: "hint" })}>Another clue</button>
                <button className="quiz-text-button" onClick={() => dispatch({ type: "reveal" })}>Reveal planet</button>
              </div>
              <p id="guess-points" className="text-sm text-ink-soft">Guess now for {10 - (state.clues - 1) * 2} points. Each extra clue costs 2 points. Revealing earns no identification points.</p>
            </>
          ) : state.phase === "reveal" ? (
            <>
              <p className="font-bold">Discovery {state.round + 1} of 8</p>
              <h2 ref={heading} tabIndex={-1} className="font-display text-3xl">Meet {planet.name}</h2>
              <p>{planet.description}</p>
              <p>Now answer two questions about your discovery. Each correct answer earns 5 points.</p>
              <button className="action min-h-12 px-5" onClick={advance}>Test your knowledge</button>
            </>
          ) : (
            <>
              <p className="font-bold">{planet.name} · Question {state.question + 1} of 2</p>
              <h2 ref={heading} tabIndex={-1} className="font-display text-2xl">{question.prompt}</h2>
              <div className="flex flex-col gap-3" role="group" aria-label="Answer choices">
                {question.choices.map((choice, index) => {
                  const correct = answered && index === question.answer;
                  const wrong = answered && index === state.selected && !correct;
                  return <button key={choice} disabled={answered} className={`quiz-answer ${correct ? "quiz-answer-correct" : ""} ${wrong ? "quiz-answer-wrong" : ""}`} onClick={() => dispatch({ type: "answer", choice: index })}><span>{choice}</span>{correct && <strong>✓ Correct</strong>}{wrong && <strong>✕ Your answer</strong>}</button>;
                })}
              </div>
              {answered && <div role="status" className="quiz-explanation"><strong>{state.selected === question.answer ? "✓ Correct! +5 points" : "Not quite. Here’s why:"}</strong><p>{question.explanation}</p></div>}
              {answered && <button className="action min-h-12 px-5" onClick={advance}>{state.question === 0 ? "Next question" : state.round === 7 ? "See results" : "Next mystery planet"}</button>}
            </>
          )}
        </div>
      </div>
    </section>
  );
}
