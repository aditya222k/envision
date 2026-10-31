"use client";

import { useState, type PointerEvent } from "react";

const START_DISTANCE = 5;
const INTERACTIVE = "button, textarea, input, select, a";

// Moves notes directly during a drag, so they keep up with the pointer.
export function useNoteDrag(
  onSwap: (chapterId: string, fromId: string, toId: string) => void,
) {
  const [isDragging, setIsDragging] = useState(false);

  function onPointerDown(
    event: PointerEvent<HTMLElement>,
    chapterId: string,
    topicId: string,
  ) {
    if (
      event.button !== 0 ||
      (event.target as HTMLElement).closest(INTERACTIVE)
    ) {
      return;
    }

    const note = event.currentTarget;
    const startX = event.clientX;
    const startY = event.clientY;
    const originLevel = note.closest(".story-level")!;
    const others = [
      ...document.querySelectorAll<HTMLElement>(
        `[data-note-chapter="${chapterId}"]`,
      ),
    ].filter((item) => item !== note);
    let isActive = false;
    let target: HTMLElement | null = null;

    function setTarget(next: HTMLElement | null) {
      if (next === target) {
        return;
      }
      if (target) {
        target.style.transform = "";
        target.closest(".story-level")?.classList.remove("is-drop-target");
      }
      target = next;
      if (target) {
        const level = target.closest(".story-level")!;
        const from = originLevel.getBoundingClientRect();
        const to = level.getBoundingClientRect();
        level.classList.add("is-drop-target");
        target.style.transform = `translate(${from.left - to.left}px, ${from.top - to.top}px)`;
      }
    }

    function handleMove(moveEvent: globalThis.PointerEvent) {
      const x = moveEvent.clientX - startX;
      const y = moveEvent.clientY - startY;
      if (!isActive) {
        if (Math.hypot(x, y) < START_DISTANCE) {
          return;
        }
        isActive = true;
        note.setPointerCapture(moveEvent.pointerId);
        note.classList.add("is-dragging");
        setIsDragging(true);
      }

      note.style.transform = `translate(${x}px, ${y}px) rotate(2deg)`;
      setTarget(
        others.find((item) => {
          const box = item.closest(".story-level")!.getBoundingClientRect();
          return (
            moveEvent.clientX >= box.left &&
            moveEvent.clientX <= box.right &&
            moveEvent.clientY >= box.top &&
            moveEvent.clientY <= box.bottom
          );
        }) ?? null,
      );
    }

    function finish(shouldSwap: boolean) {
      const dropped = target;
      window.removeEventListener("pointermove", handleMove);
      window.removeEventListener("pointerup", handleUp);
      window.removeEventListener("pointercancel", handleCancel);
      window.removeEventListener("keydown", handleKey);
      if (!isActive) {
        return;
      }

      note.classList.remove("is-dragging");
      setTarget(null);
      setIsDragging(false);

      if (shouldSwap && dropped) {
        // The text swaps in the same frame, so nothing glides back.
        note.classList.add("no-transition");
        dropped.classList.add("no-transition");
        note.style.transform = "";
        dropped.style.transform = "";
        onSwap(chapterId, topicId, dropped.dataset.noteId!);
        requestAnimationFrame(() =>
          requestAnimationFrame(() => {
            note.classList.remove("no-transition");
            dropped.classList.remove("no-transition");
          }),
        );
      } else {
        note.style.transform = "";
      }
    }

    function handleUp() {
      finish(true);
    }

    function handleCancel() {
      finish(false);
    }

    function handleKey(keyEvent: KeyboardEvent) {
      if (keyEvent.key === "Escape") {
        finish(false);
      }
    }

    window.addEventListener("pointermove", handleMove);
    window.addEventListener("pointerup", handleUp);
    window.addEventListener("pointercancel", handleCancel);
    window.addEventListener("keydown", handleKey);
  }

  return { isDragging, onPointerDown };
}
