// Kept on globalThis so the build and stop routes share one list in development.
const store = globalThis as typeof globalThis & {
  envisionRuns?: Map<string, AbortController>;
};
const runs = (store.envisionRuns ??= new Map());

export function startRun(runId: string) {
  const controller = new AbortController();
  runs.set(runId, controller);
  return controller;
}

export function finishRun(runId: string) {
  runs.delete(runId);
}

export function stopRun(runId: string) {
  runs.get(runId)?.abort();
}
