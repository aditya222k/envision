"use client";

import { useState } from "react";
import type { ChoiceRound } from "@/lib/games/spec";

function ReviewItem({
  round,
  disabled,
  onResolve,
}: {
  round: ChoiceRound;
  disabled: boolean;
  onResolve: (answerIndex: number | null) => void;
}) {
  const [answerIndex, setAnswerIndex] = useState(round.answerIndex);

  return (
    <li className="flex flex-col gap-3 border-2 border-ink p-4">
      <p className="font-bold text-ink">{round.prompt}</p>
      <p className="text-sm text-ink">{round.explanation}</p>
      <label className="field-label">
        Correct answer
        <select
          value={answerIndex}
          onChange={(event) => setAnswerIndex(Number(event.target.value))}
          className="field h-11 px-2"
        >
          {round.choices.map((choice, index) => (
            <option key={index} value={index}>
              {choice}
            </option>
          ))}
        </select>
      </label>
      <div className="flex flex-wrap gap-3">
        <button
          type="button"
          disabled={disabled}
          onClick={() => onResolve(answerIndex)}
          className="action h-11 px-5"
        >
          Add to game
        </button>
        <button
          type="button"
          disabled={disabled}
          onClick={() => onResolve(null)}
          className="action action-quiet h-11 px-5"
        >
          Leave out
        </button>
      </div>
    </li>
  );
}

export function ReviewPanel({
  rounds,
  disabled,
  onResolve,
}: {
  rounds: ChoiceRound[];
  disabled: boolean;
  onResolve: (index: number, answerIndex: number | null) => void;
}) {
  if (rounds.length === 0) {
    return null;
  }

  return (
    <div className="flex flex-col gap-3">
      <div className="flex flex-col gap-1">
        <h3 className="text-xl font-bold text-ink">
          Questions for you to review
        </h3>
        <p className="text-ink">
          Envision couldn&apos;t confirm these answers, so they aren&apos;t in
          your game. Choose the correct answer to add one, or leave it out.
        </p>
      </div>
      <ol className="flex flex-col gap-3">
        {rounds.map((round, index) => (
          <ReviewItem
            key={round.prompt}
            round={round}
            disabled={disabled}
            onResolve={(answerIndex) => onResolve(index, answerIndex)}
          />
        ))}
      </ol>
    </div>
  );
}
