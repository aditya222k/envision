"use client";

import type { GameDraft } from "@/lib/games/draft";

export type CheckedQuestion = {
  prompt: string;
  status: "checking" | "confirmed" | "doubtful" | "not-checked";
};

const STATUS_TEXT: Record<CheckedQuestion["status"], string> = {
  checking: "Checking",
  confirmed: "Answer confirmed",
  doubtful: "Needs your review",
  "not-checked": "Check this yourself",
};

export function LiveReveal({
  draft,
  checks,
}: {
  draft: GameDraft;
  checks: CheckedQuestion[] | null;
}) {
  const questions: CheckedQuestion[] =
    checks ??
    draft.questions.map((prompt) => ({ prompt, status: "checking" as const }));

  return (
    <section
      aria-label="Your game is taking shape"
      className="col-span-2 flex flex-col gap-4 bg-paper p-4 sm:p-6 lg:col-span-4 lg:row-start-5"
    >
      <h2 className="text-2xl font-bold text-ink">
        {draft.title ?? "Your game is taking shape"}
      </h2>

      <dl className="reveal-facts">
        {draft.player?.name && (
          <div>
            <dt>You play</dt>
            <dd>
              {draft.player.emoji} {draft.player.name}
            </dd>
          </div>
        )}
        {draft.challenger?.name && (
          <div>
            <dt>Your challenger</dt>
            <dd>
              {draft.challenger.emoji} {draft.challenger.name}
            </dd>
          </div>
        )}
        {draft.theme && (
          <div>
            <dt>World</dt>
            <dd>{draft.theme}</dd>
          </div>
        )}
        {draft.mechanic && (
          <div>
            <dt>Game type</dt>
            <dd>{draft.mechanic.replace(/-/g, " ")}</dd>
          </div>
        )}
      </dl>

      {draft.intro && <p className="text-ink">{draft.intro}</p>}

      {questions.length > 0 && (
        <ol className="flex flex-col gap-2">
          {questions.map((question, index) => (
            <li key={index} className={`reveal-question reveal-${question.status}`}>
              <span>
                {index + 1}. {question.prompt}
              </span>
              {checks && (
                <span className="text-sm font-bold">
                  {STATUS_TEXT[question.status]}
                </span>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
