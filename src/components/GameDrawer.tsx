"use client";

import Link from "next/link";
import { useRef, useState, type MouseEvent } from "react";
import type { GameSummary } from "@/lib/games/store";

export function GameDrawer({
  currentGameId,
  isIncognito,
  disabled,
  onOpenGame,
}: {
  currentGameId: string | null;
  isIncognito: boolean;
  disabled: boolean;
  onOpenGame: (id: string) => void;
}) {
  const dialogRef = useRef<HTMLDialogElement>(null);
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function openDrawer() {
    dialogRef.current?.showModal();
    setError(null);

    try {
      const response = await fetch(
        isIncognito ? "/api/games?demo=1" : "/api/games",
        { cache: "no-store" },
      );
      if (!response.ok) {
        throw new Error();
      }
      setGames((await response.json()).games);
    } catch {
      setError("Envision couldn't load your games. Try again.");
    }
  }

  function closeDrawer() {
    dialogRef.current?.close();
  }

  // A click on the dimmed area lands on the dialog itself.
  function handleDialogClick(event: MouseEvent<HTMLDialogElement>) {
    if (event.target === dialogRef.current) {
      closeDrawer();
    }
  }

  return (
    <>
      <button
        type="button"
        onClick={openDrawer}
        disabled={disabled}
        aria-haspopup="dialog"
        className="drawer-button"
      >
        Open a saved game
      </button>

      <dialog
        ref={dialogRef}
        aria-labelledby="game-drawer-title"
        onClick={handleDialogClick}
        className="drawer"
      >
        <div className="flex h-full flex-col">
          <div className="flex items-center justify-between gap-4 px-6 pt-6 pb-4">
            <h2
              id="game-drawer-title"
              className="font-display text-3xl leading-none text-ink"
            >
              Your games
            </h2>
            <button
              type="button"
              onClick={closeDrawer}
              className="action action-quiet h-10 px-4"
            >
              Close
            </button>
          </div>

          <div className="flex flex-1 flex-col overflow-y-auto">
            {error && (
              <p role="alert" className="p-5 font-bold text-history">
                {error}
              </p>
            )}
            {!error && !games && <p className="p-5 text-ink">Loading...</p>}
            {!error && games?.length === 0 && (
              <p className="p-5 text-ink">
                Games you build will appear here. Describe one to get started.
              </p>
            )}
            {games?.map((game) => (
              <button
                key={game.id}
                type="button"
                aria-current={game.id === currentGameId}
                onClick={() => {
                  closeDrawer();
                  onOpenGame(game.id);
                }}
                className="drawer-game"
              >
                <span className="text-lg leading-6 font-bold">{game.name}</span>
                <span className="text-sm">{game.subjectLine}</span>
                <span className="text-sm font-bold">
                  {game.publishedAt ? "Published" : "Not published"}
                </span>
              </button>
            ))}
          </div>

          <div className="flex flex-wrap gap-5 border-t border-[var(--line)] px-6 py-5">
            <Link href="/games" className="font-bold text-ink underline">
              Manage all games
            </Link>
            <Link href="/storylines" className="font-bold text-ink underline">
              Storylines
            </Link>
          </div>
        </div>
      </dialog>
    </>
  );
}
