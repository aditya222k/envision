"use client";

import { Component, useState, type ReactNode } from "react";
import { PLANETS, ordinal, type Planet } from "@/lib/explorer/solarSystem";
import SolarSystemScene from "./SolarSystemScene";

function hasWebGL() {
  try {
    const canvas = document.createElement("canvas");
    return Boolean(canvas.getContext("webgl2") ?? canvas.getContext("webgl"));
  } catch {
    return false;
  }
}

function prefersReducedMotion() {
  return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

class SceneBoundary extends Component<
  { fallback: ReactNode; children: ReactNode },
  { failed: boolean }
> {
  state = { failed: false };

  static getDerivedStateFromError() {
    return { failed: true };
  }

  componentDidCatch(error: unknown) {
    console.error("The 3D view couldn't render.", error);
  }

  render() {
    return this.state.failed ? this.props.fallback : this.props.children;
  }
}

function SceneError({ onRetry }: { onRetry?: () => void }) {
  return (
    <div role="alert" className="explorer-status explorer-error">
      <div className="flex max-w-[44ch] flex-col items-center gap-4 px-6 text-center">
        <p className="text-lg font-bold">
          The 3D view couldn&apos;t load on this device.
        </p>
        <p className="text-chalk-dim">
          Try a recent version of Chrome, Edge, Firefox or Safari, and check
          that hardware acceleration is on. You can still choose a planet below
          to read about it.
        </p>
        {onRetry && (
          <button type="button" onClick={onRetry} className="stage-button">
            Try again
          </button>
        )}
      </div>
    </div>
  );
}

function PlanetCard({
  planet,
  onClose,
  onInspect,
  inspecting,
}: {
  planet: Planet;
  onClose: () => void;
  onInspect: () => void;
  inspecting: boolean;
}) {
  return (
    <section
      aria-labelledby="planet-name"
      className="explorer-card sheet flex flex-col gap-4 p-5"
    >
      <div className="flex items-start justify-between gap-4">
        <h2 id="planet-name" className="font-display text-3xl text-ink">
          {planet.name}
        </h2>
        <button
          type="button"
          onClick={onClose}
          className="action action-quiet h-10 px-3 text-base"
        >
          Close
        </button>
      </div>
      <p className="leading-7 text-ink">{planet.description}</p>
      <button type="button" onClick={onInspect} className="action h-11 px-4">
        {inspecting ? "Back to solar system" : "Inspect planet"}
      </button>
      <dl className="planet-facts">
        <div>
          <dt>Position from the Sun</dt>
          <dd>{ordinal(planet.order)} planet</dd>
        </div>
        <div>
          <dt>Average distance from the Sun</dt>
          <dd>{planet.distanceFromSun}</dd>
        </div>
        <div>
          <dt>Orbital period, one trip around the Sun</dt>
          <dd>{planet.orbitalPeriod}</dd>
        </div>
      </dl>
    </section>
  );
}

export default function SolarSystemExplorer({ active = true, onStartQuiz }: {
  active?: boolean;
  onStartQuiz?: () => void;
}) {
  const [canRender] = useState(hasWebGL);
  const [playing, setPlaying] = useState(() => !prefersReducedMotion());
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [resetSignal, setResetSignal] = useState(0);
  const [sceneKey, setSceneKey] = useState(0);
  const [contextLost, setContextLost] = useState(false);
  const [useExternalModels, setUseExternalModels] = useState(true);
  const [focusedId, setFocusedId] = useState<string | null>(null);
  const selected = PLANETS.find((planet) => planet.id === selectedId) ?? null;

  function retry() {
    setContextLost(false);
    setSceneKey((key) => key + 1);
  }

  function selectPlanet(id: string | null) {
    setSelectedId(id);
    if (focusedId) setFocusedId(id);
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="explorer-layout">
        <div className="explorer-stage">
          {!canRender ? (
            <SceneError />
          ) : contextLost ? (
            <SceneError onRetry={retry} />
          ) : (
            <SceneBoundary key={sceneKey} fallback={<SceneError onRetry={retry} />}>
              {active && <SolarSystemScene
                playing={playing}
                selectedId={selectedId}
                resetSignal={resetSignal}
                onSelect={selectPlanet}
                onContextLost={() => setContextLost(true)}
                useExternalModels={useExternalModels}
                focusedId={focusedId}
              />}
            </SceneBoundary>
          )}

          {canRender && !contextLost && (
            <div className="explorer-controls">
              <button
                type="button"
                onClick={() => {
                  if (!playing) setFocusedId(null);
                  setPlaying(!playing);
                }}
                className="stage-button stage-button-primary"
              >
                {playing ? "Pause orbits" : "Play orbits"}
              </button>
              <button
                type="button"
                onClick={() => {
                  setFocusedId(null);
                  setResetSignal((signal) => signal + 1);
                }}
                className="stage-button"
              >
                Reset view
              </button>
            </div>
          )}
        </div>

        <div aria-live="polite" className="explorer-card-slot">
          {selected ? (
            <PlanetCard
              planet={selected}
              onClose={() => selectPlanet(null)}
              inspecting={focusedId === selected.id}
              onInspect={() => {
                setFocusedId(focusedId ? null : selected.id);
                setPlaying(false);
              }}
            />
          ) : (
            <p className="explorer-hint">
              Click or tap a planet to learn about it.
            </p>
          )}
        </div>
      </div>

      <p className="explorer-note">
        Not to scale. Planet sizes, distances and orbital speeds are simplified
        so everything fits on screen. The facts on each planet card are real.
      </p>

      <div role="group" aria-label="Choose a planet" className="flex flex-wrap gap-2">
        {PLANETS.map((planet) => (
          <button
            key={planet.id}
            type="button"
            aria-pressed={planet.id === selectedId}
            onClick={() => selectPlanet(planet.id)}
            className="planet-chip"
          >
            <span
              aria-hidden="true"
              className="planet-dot"
              style={{ background: planet.scene.colors[0] }}
            />
            {planet.name}
          </button>
        ))}
      </div>
      <div className="flex flex-col gap-2 text-sm text-chalk-dim">
        <label className="flex min-h-11 items-center gap-3">
          <input
            type="checkbox"
            checked={useExternalModels}
            onChange={(event) => setUseExternalModels(event.target.checked)}
          />
          Use detailed NASA models for the Sun and all eight planets
        </label>
        <p>
          Models courtesy of NASA/JPL-Caltech and NASA VTAD.
          {" "}
          <a href="/solar-system/models/README.md" className="underline">
            Sources and credits
          </a>
        </p>
      </div>
      {onStartQuiz && <div className="sheet flex flex-wrap items-center justify-between gap-4 p-5">
        <div><h2 className="font-display text-2xl text-ink">Ready for a mystery?</h2><p className="text-ink-soft">Identify eight hidden planets, then test what you know.</p></div>
        <button className="action min-h-12 px-5" onClick={onStartQuiz}>Test your planet knowledge</button>
      </div>}
    </div>
  );
}
