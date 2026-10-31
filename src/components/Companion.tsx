"use client";

import { useState } from "react";

export type Experience =
  | "custom"
  | "bodies"
  | "systems"
  | "decide"
  | "arrange"
  | "quest";

export type CompanionAnswer = {
  experience: Experience;
  reason: string;
  questions: { question: string; options: string[] }[];
};

const EXPERIENCE_LABELS: Record<Experience, string> = {
  custom: "Custom game",
  bodies: "Physics lab",
  systems: "Simulation lab",
  decide: "Decision story",
  arrange: "Arrange and sort",
  quest: "Quiz adventure",
};

export function Companion({
  answer,
  onBuild,
  onCancel,
}: {
  answer: CompanionAnswer;
  onBuild: (experience: Experience, choices: string) => void;
  onCancel: () => void;
}) {
  const [experience, setExperience] = useState(answer.experience);
  const [choices, setChoices] = useState<Record<string, string>>({});

  return (
    <div className="companion">
      <p className="font-bold text-ink">
        {answer.reason || "Here's what I'd suggest."}
      </p>

      <fieldset className="companion-group">
        <legend>What kind of game?</legend>
        <div className="flex flex-wrap gap-2">
          {(Object.keys(EXPERIENCE_LABELS) as Experience[]).map((item) => (
            <button
              key={item}
              type="button"
              aria-pressed={experience === item}
              onClick={() => setExperience(item)}
              className="option"
            >
              {EXPERIENCE_LABELS[item]}
            </button>
          ))}
        </div>
      </fieldset>

      {answer.questions.map(({ question, options }) => (
        <fieldset key={question} className="companion-group">
          <legend>{question}</legend>
          <div className="flex flex-wrap gap-2">
            {options.map((option) => (
              <button
                key={option}
                type="button"
                aria-pressed={choices[question] === option}
                onClick={() =>
                  setChoices((current) => ({ ...current, [question]: option }))
                }
                className="option"
              >
                {option}
              </button>
            ))}
          </div>
        </fieldset>
      ))}

      <div className="flex flex-col gap-3 sm:flex-row">
        <button
          type="button"
          onClick={() =>
            onBuild(
              experience,
              Object.entries(choices)
                .map(([question, option]) => `${question} ${option}`)
                .join("\n"),
            )
          }
          className="action h-12 px-6 sm:flex-1"
        >
          Build it
        </button>
        <button
          type="button"
          onClick={onCancel}
          className="action action-quiet h-12 px-6"
        >
          Go back
        </button>
      </div>
    </div>
  );
}
