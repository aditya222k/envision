"use client";

import { useEffect, useRef, useState, type RefObject } from "react";

type Pin = { x: number; y: number; gutter: number };

const SAG = 44;
const SAME_ROW_DISTANCE = 40;
const CURVE = 70;

function stringPath(from: Pin, to: Pin) {
  if (Math.abs(from.y - to.y) < SAME_ROW_DISTANCE) {
    const middleX = (from.x + to.x) / 2;
    const lowest = Math.max(from.y, to.y);
    return `M ${from.x} ${from.y} Q ${middleX} ${lowest + SAG} ${to.x} ${to.y}`;
  }

  // Runs down the gap beside the note, so the string doesn't cross its text.
  const { gutter } = from;
  return `M ${from.x} ${from.y} C ${gutter} ${from.y} ${gutter} ${from.y} ${gutter} ${from.y + CURVE} L ${gutter} ${to.y - CURVE} C ${gutter} ${to.y} ${gutter} ${to.y} ${to.x} ${to.y}`;
}

// Draws a string through the notes marked with data-story-pin, in page order.
export function StoryString({
  containerRef,
  layoutKey,
  isLive,
}: {
  containerRef: RefObject<HTMLElement | null>;
  layoutKey: string;
  isLive: boolean;
}) {
  const [pins, setPins] = useState<Pin[]>([]);
  const measureRef = useRef<() => void>(() => {});

  useEffect(() => {
    const container = containerRef.current;
    if (!container) {
      return;
    }

    function measure() {
      const box = container!.getBoundingClientRect();
      setPins(
        [...container!.querySelectorAll("[data-story-pin]")].map((element) => {
          const pin = element.getBoundingClientRect();
          const level = element.closest(".story-level");
          return {
            x: pin.left + pin.width / 2 - box.left,
            y: pin.top + pin.height / 2 - box.top,
            gutter: (level?.getBoundingClientRect().left ?? 0) - box.left - 8,
          };
        }),
      );
    }

    measureRef.current = measure;
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    container
      .querySelectorAll("[data-story-note]")
      .forEach((note) => observer.observe(note));
    return () => observer.disconnect();
  }, [containerRef, layoutKey]);

  // Follows the notes on every frame while one is being dragged.
  useEffect(() => {
    if (!isLive) {
      return;
    }
    let frame = requestAnimationFrame(function update() {
      measureRef.current();
      frame = requestAnimationFrame(update);
    });
    return () => {
      cancelAnimationFrame(frame);
      window.setTimeout(() => measureRef.current(), 260);
    };
  }, [isLive]);

  return (
    <svg aria-hidden="true" className="story-string">
      <defs>
        <marker
          id="story-arrow"
          viewBox="0 0 10 10"
          refX="16"
          refY="5"
          markerWidth="7"
          markerHeight="7"
          orient="auto-start-reverse"
        >
          <path d="M 0 0 L 10 5 L 0 10 z" className="story-string-arrow" />
        </marker>
      </defs>
      {pins.slice(1).map((pin, index) => (
        <path
          key={index}
          d={stringPath(pins[index], pin)}
          markerEnd="url(#story-arrow)"
          className="story-string-line"
        />
      ))}
      {pins.map((pin, index) => (
        <circle
          key={index}
          cx={pin.x}
          cy={pin.y}
          r="7"
          className="story-string-pin"
        />
      ))}
    </svg>
  );
}
