"use client";

import Link from "next/link";
import { useEffect, useState, type FormEvent } from "react";
import type { GameSummary } from "@/lib/games/store";
import { useTeachMode } from "@/lib/teach-mode";

function studentLink(id: string) {
  return `${window.location.origin}/play/${id}`;
}

function GameRow({
  game,
  canManage,
  onChanged,
  onDeleted,
}: {
  game: GameSummary;
  canManage: boolean;
  onChanged: (game: GameSummary) => void;
  onDeleted: (id: string) => void;
}) {
  const [isRenaming, setIsRenaming] = useState(false);
  const [name, setName] = useState(game.name);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function update(body: object) {
    setIsSaving(true);
    setError(null);
    setMessage(null);
    try {
      const response = await fetch(`/api/games/${game.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      const data = await response.json().catch(() => null);
      if (!response.ok) {
        setError(data?.error ?? "That didn't save. Try again.");
        return false;
      }
      onChanged(data.game);
      return true;
    } catch {
      setError("Envision couldn't reach the server. Try again.");
      return false;
    } finally {
      setIsSaving(false);
    }
  }

  async function handleRename(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (await update({ name })) {
      setIsRenaming(false);
    }
  }

  async function handleDelete() {
    setIsSaving(true);
    setError(null);
    try {
      const response = await fetch(`/api/games/${game.id}`, { method: "DELETE" });
      if (response.ok) {
        onDeleted(game.id);
      } else {
        setError("The game wasn't deleted. Try again.");
      }
    } catch {
      setError("Envision couldn't reach the server. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(studentLink(game.id));
      setMessage("Link copied.");
    } catch {
      setError(`Copy this link: ${studentLink(game.id)}`);
    }
  }

  const isPublished = game.publishedAt !== null;

  return (
    <article className="flex flex-col gap-4 p-6 sm:p-8">
      <div className="flex flex-col gap-1">
        {isRenaming ? (
          <form onSubmit={handleRename} className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <label className="field-label sm:flex-1">
              Game name
              <input
                value={name}
                onChange={(event) => setName(event.target.value)}
                maxLength={80}
                required
                autoFocus
                className="field h-12 px-3"
              />
            </label>
            <button type="submit" disabled={isSaving} className="action h-12 px-5">
              Save name
            </button>
            <button
              type="button"
              onClick={() => {
                setName(game.name);
                setIsRenaming(false);
              }}
              className="action action-quiet h-12 px-5"
            >
              Cancel
            </button>
          </form>
        ) : (
          <h2 className="text-2xl font-bold text-ink">{game.name}</h2>
        )}
        <p className="text-ink">{game.subjectLine}</p>
        <p className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-ink-soft">
          <span className={`font-bold ${isPublished ? "text-science" : ""}`}>
            {isPublished
              ? game.hasUnpublishedChanges
                ? "Published. Students don't have your latest changes yet."
                : "Published to students"
              : "Not published"}
          </span>
          <span>Version {game.versionCount}</span>
          <span>Updated {new Date(game.updatedAt).toLocaleDateString()}</span>
        </p>
      </div>

      <div className="flex flex-wrap gap-3">
        <Link href={`/?game=${game.id}`} className="action h-11 px-5">
          Open
        </Link>
        {canManage && (
          <button
            type="button"
            onClick={() => setIsRenaming(true)}
            className="action action-quiet h-11 px-5"
          >
            Rename
          </button>
        )}
        {canManage && (!isPublished || game.hasUnpublishedChanges) && (
          <button
            type="button"
            disabled={isSaving}
            onClick={() => update({ published: true })}
            className="action action-quiet h-11 px-5"
          >
            {isPublished ? "Publish latest" : "Publish to students"}
          </button>
        )}
        {canManage && isPublished && (
          <>
            <button
              type="button"
              onClick={handleCopy}
              className="action action-quiet h-11 px-5"
            >
              Copy student link
            </button>
            <button
              type="button"
              disabled={isSaving}
              onClick={() => update({ published: false })}
              className="action action-quiet h-11 px-5"
            >
              Unpublish
            </button>
          </>
        )}
        {canManage && (
          <button
            type="button"
            onClick={() => setIsDeleting(true)}
            className="h-11 px-2 font-bold text-history underline-offset-4 hover:underline sm:ml-auto"
          >
            Delete
          </button>
        )}
      </div>

      {isDeleting && (
        <div className="flex flex-col gap-3 rounded-xl bg-[#fbe9e7] p-4">
          <p className="font-bold text-ink">
            Delete {game.name}? This can&apos;t be undone
            {isPublished ? ", and students will lose access" : ""}.
          </p>
          <div className="flex flex-wrap gap-3">
            <button
              type="button"
              disabled={isSaving}
              onClick={handleDelete}
              className="action action-stop h-11 px-5"
            >
              Delete game
            </button>
            <button
              type="button"
              onClick={() => setIsDeleting(false)}
              className="action action-quiet h-11 px-5"
            >
              Keep game
            </button>
          </div>
        </div>
      )}

      {message && (
        <p role="status" className="font-bold text-science">
          {message}
        </p>
      )}
      {error && (
        <p role="alert" className="font-bold text-history">
          {error}
        </p>
      )}
    </article>
  );
}

export function GameCatalog() {
  const [games, setGames] = useState<GameSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLocalAddress, setIsLocalAddress] = useState(false);
  const isTeachMode = useTeachMode();

  useEffect(() => {
    fetch(isTeachMode ? "/api/games?demo=1" : "/api/games", {
      cache: "no-store",
    })
      .then((response) => {
        if (!response.ok) {
          throw new Error();
        }
        return response.json();
      })
      .then((data) => {
        setGames(data.games);
        setIsLocalAddress(
          ["localhost", "127.0.0.1"].includes(window.location.hostname),
        );
      })
      .catch(() => setError("Envision couldn't load your games. Reload the page."));
  }, [isTeachMode]);

  if (error) {
    return (
      <p role="alert" className="p-6 font-bold text-history sm:p-8">
        {error}
      </p>
    );
  }
  if (!games) {
    return <p className="p-6 text-ink-soft sm:p-8">Loading your games...</p>;
  }
  if (games.length === 0) {
    return (
      <div className="flex flex-col items-start gap-4 p-6 text-ink sm:p-8">
        <p>You haven&apos;t built a game yet. Describe one to get started.</p>
        <Link href="/" className="action h-11 px-5">
          Build a game
        </Link>
      </div>
    );
  }

  return (
    <>
      {isLocalAddress && games.some((game) => game.publishedAt) && (
        <p className="bg-[var(--pencil-light)] p-6 font-bold text-ink sm:px-8">
          Student links start with localhost, so they only work on this
          computer. Open Envision using your computer&apos;s network address
          before you copy a link for students.
        </p>
      )}
      {games.map((game) => (
        <GameRow
          key={game.id}
          game={game}
          canManage={!isTeachMode}
          onChanged={(next) =>
            setGames((current) =>
              (current ?? []).map((item) => (item.id === next.id ? next : item)),
            )
          }
          onDeleted={(id) =>
            setGames((current) =>
              (current ?? []).filter((item) => item.id !== id),
            )
          }
        />
      ))}
    </>
  );
}
