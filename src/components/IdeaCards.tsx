"use client";

import Link from "next/link";
import { useState, type ComponentType } from "react";
import { EXAMPLE_GAMES, type Subject } from "@/lib/games/examples";
import {
  HistorianArt,
  MathleteArt,
  PoetArt,
  ScientistArt,
} from "@/components/SubjectArt";

const CARDS: {
  subject: Subject;
  persona: string;
  from: string;
  to: string;
  shadow: string;
  Art: ComponentType;
}[] = [
  { subject: "Science", persona: "The Scientist", from: "#E3FF6A", to: "#F7FFDA", shadow: "rgba(110,150,0,0.28)", Art: ScientistArt },
  { subject: "Math", persona: "The Mathlete", from: "#79BCFF", to: "#E4F1FF", shadow: "rgba(37,99,235,0.28)", Art: MathleteArt },
  { subject: "History", persona: "The Historian", from: "#FFB37D", to: "#FFEBDD", shadow: "rgba(225,110,40,0.28)", Art: HistorianArt },
  { subject: "English", persona: "The Poet", from: "#BCA4FF", to: "#F1EBFF", shadow: "rgba(91,63,217,0.28)", Art: PoetArt },
];

function FlipIcon({ back = false }: { back?: boolean }) {
  return (
    <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
      <path d={back ? "M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" : "M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5"} />
    </svg>
  );
}

// Subject cards that flip over to show their example games. Picking a game
// fills in the prompt, except ready-made explorers, which open directly.
export function IdeaCards({
  onUseIdea,
  onMakeOwn,
}: {
  onUseIdea: (prompt: string) => void;
  onMakeOwn: (subject: Subject) => void;
}) {
  const [flipped, setFlipped] = useState<Partial<Record<Subject, boolean>>>({});
  const anyClosed = CARDS.some((card) => !flipped[card.subject]);

  function flipAll() {
    setFlipped(Object.fromEntries(CARDS.map((card) => [card.subject, anyClosed])));
  }

  return (
    <section
      aria-labelledby="ideas-title"
      className="mx-auto flex w-full max-w-[1440px] flex-col gap-8 px-4 pt-18 pb-24 sm:px-10"
    >
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div className="flex flex-col gap-1.5">
          <h2 id="ideas-title" className="m-0 text-[34px] font-black tracking-[-0.02em]">
            Or start from{" "}
            <span className="font-display text-[1.1em] text-pencil">an idea</span>
          </h2>
          <p className="m-0 font-semibold text-ink-soft">
            Pick a subject card to flip it and see its games.
          </p>
        </div>
        <button type="button" onClick={flipAll} className="drawer-button min-h-11 px-4">
          <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M3 12a9 9 0 0 1 15.5-6.2L21 8M21 3v5h-5M21 12a9 9 0 0 1-15.5 6.2L3 16M3 21v-5h5" />
          </svg>
          {anyClosed ? "Flip all cards" : "Flip them back"}
        </button>
      </div>

      <div className="grid grid-cols-[repeat(auto-fit,minmax(min(290px,100%),1fr))] gap-6">
        {CARDS.map(({ subject, persona, from, to, shadow, Art }, index) => {
          const isFlipped = Boolean(flipped[subject]);
          const ideas = EXAMPLE_GAMES.filter((idea) => idea.subject === subject);
          // Opening one card closes the others, so one subject shows at a time.
          const toggle = () => setFlipped(isFlipped ? {} : { [subject]: true });

          return (
            <div key={subject} className="deal" style={{ animationDelay: `${0.08 + index * 0.12}s` }}>
              <div className={`flip-card hov ${isFlipped ? "is-flipped" : ""}`}>
                <div className="flip-inner">
                  <div
                    className="flip-face"
                    inert={isFlipped}
                    style={{ background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)`, boxShadow: `0 18px 40px ${shadow}` }}
                  >
                    <button
                      type="button"
                      onClick={toggle}
                      aria-label={`Flip the ${subject} card to see its games`}
                      className="flip-front-button"
                    >
                      <span className="persona-pill">{persona}</span>
                      <span className="subject-name mt-2.5 text-[70px]">{subject}</span>
                      <Art />
                      <span className="mt-auto flex w-full items-center justify-between gap-2">
                        <span className="text-[15px] font-extrabold">{ideas.length} games</span>
                        <span className="dark-pill">
                          <FlipIcon />
                          Flip
                        </span>
                      </span>
                    </button>
                  </div>

                  <div
                    className="flip-face flip-back"
                    inert={!isFlipped}
                    style={{ boxShadow: `0 18px 40px ${shadow}` }}
                  >
                    <div
                      className="flex items-center justify-between gap-3 py-5 pr-5 pl-6"
                      style={{ background: `linear-gradient(180deg, ${from} 0%, ${to} 100%)` }}
                    >
                      <div className="flex flex-col">
                        <span className="text-[13px] font-extrabold text-ink-soft">{persona}’s picks</span>
                        <span className="subject-name text-[36px] leading-none">{subject}</span>
                      </div>
                      <button
                        type="button"
                        onClick={toggle}
                        aria-label={`Flip back to the ${subject} card`}
                        className="round-button"
                      >
                        <FlipIcon back />
                      </button>
                    </div>

                    <ul className="m-0 flex flex-1 list-none flex-col gap-2 p-3">
                      {ideas.map((idea, number) => {
                        const content = (
                          <>
                            <span className="idea-number" style={{ background: from }}>
                              {number + 1}
                            </span>
                            <span className="flex min-w-0 flex-1 flex-col">
                              <span className="text-base leading-tight font-extrabold">{idea.title}</span>
                              <span className="text-[13px] font-semibold text-[#5B5876]">
                                {idea.prompt === undefined ? `${idea.grade} · ${idea.opens}` : idea.grade}
                              </span>
                            </span>
                            <span className="play-pill">
                              <svg width="11" height="11" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
                                <path d="M6 3.5v17l15-8.5z" />
                              </svg>
                              {idea.prompt === undefined ? "Play" : "Use"}
                            </span>
                          </>
                        );
                        return (
                          <li
                            key={idea.title}
                            className={isFlipped ? "pop" : ""}
                            style={{ animationDelay: isFlipped ? `${0.35 + number * 0.08}s` : "0s" }}
                          >
                            {idea.prompt === undefined ? (
                              <Link href={idea.href} className="idea-row">
                                {content}
                              </Link>
                            ) : (
                              <button
                                type="button"
                                onClick={() => onUseIdea(idea.prompt)}
                                className="idea-row"
                              >
                                {content}
                              </button>
                            )}
                          </li>
                        );
                      })}
                    </ul>

                    <button type="button" onClick={() => onMakeOwn(subject)} className="make-own">
                      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.6" strokeLinecap="round" aria-hidden="true">
                        <path d="M12 5v14M5 12h14" />
                      </svg>
                      Make your own {subject.toLowerCase()} game
                    </button>
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </section>
  );
}
