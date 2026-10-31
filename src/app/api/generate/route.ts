import { runDemoChange, runPrebuiltBuild } from "@/lib/games/demo";
import { buildGame } from "@/lib/games/pipeline";
import { reviseGame } from "@/lib/games/revise";
import { finishRun, startRun } from "@/lib/games/runs";
import { parseGameSpec } from "@/lib/games/spec";
import {
  addVersion,
  createGame,
  getLatestSpec,
} from "@/lib/games/store";
import {
  GenerationStoppedError,
  getProvider,
  isProviderId,
  NotImplementedError,
  ProviderRequestError,
} from "@/lib/llm";
import { isProviderConfigured } from "@/lib/llm/config";

function describeFailure(error: unknown) {
  if (error instanceof NotImplementedError) {
    return { type: "error", status: 501, error: error.message };
  }
  if (error instanceof ProviderRequestError) {
    return { type: "error", status: 502, error: error.message };
  }
  console.error(error);
  return { type: "error", status: 500, error: "Something went wrong. Try again." };
}

// Streams one JSON event per line, so the page can show real progress.
export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (typeof body?.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (body.provider !== undefined && !isProviderId(body.provider)) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }

  const isDemo = body.demo === true;
  const provider = getProvider(body.provider);
  if (!isDemo && !(await isProviderConfigured(provider.id))) {
    return Response.json(
      { error: `${provider.id} is not configured` },
      { status: 503 },
    );
  }

  const gameId: string | null =
    typeof body.gameId === "string" ? body.gameId : null;
  const currentSpec = gameId ? await getLatestSpec(gameId) : null;
  if (gameId && !currentSpec) {
    return Response.json({ error: "That game no longer exists." }, { status: 404 });
  }

  const runId = typeof body.runId === "string" ? body.runId : crypto.randomUUID();
  const run = startRun(runId);
  const signal = AbortSignal.any([request.signal, run.signal]);
  const encoder = new TextEncoder();

  const demoSpec = isDemo && body.spec ? parseGameSpec(body.spec) : null;

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The page has gone, so there's nobody left to tell.
        }
      };
      const onProgress = (progress: object) =>
        send({ type: "progress", ...progress });

      try {
        if (isDemo) {
          // Teach mode never calls a provider or changes a saved game.
          const game =
            gameId && currentSpec
              ? await runDemoChange(
                  { id: gameId },
                  demoSpec && "spec" in demoSpec ? demoSpec.spec : currentSpec,
                  Number(body.versionCount) || 1,
                  body.prompt,
                  signal,
                  onProgress,
                )
              : await runPrebuiltBuild(body.prompt, signal, onProgress);
          send({
            type: "result",
            game,
            spec: "spec" in game ? game.spec : undefined,
          });
        } else if (gameId && currentSpec) {
          const revision = await reviseGame(
            provider,
            currentSpec,
            body.prompt,
            signal,
            onProgress,
          );
          const game = await addVersion(
            gameId,
            revision.spec,
            `${revision.changes.join(". ")}.`,
          );
          send(
            game
              ? { type: "result", game }
              : { type: "error", status: 404, error: "That game no longer exists." },
          );
        } else {
          const build = await buildGame(
            provider,
            body.prompt,
            signal,
            onProgress,
          );
          send({
            type: "result",
            game: await createGame(build.spec),
            spec: build.spec,
            attempts: build.attempts,
            disputedRounds: build.disputedRounds,
          });
        }
      } catch (error) {
        send(
          error instanceof GenerationStoppedError
            ? { type: "stopped" }
            : describeFailure(error),
        );
      } finally {
        finishRun(runId);
        try {
          controller.close();
        } catch {
          // Already closed because the page disconnected.
        }
      }
    },
    cancel() {
      run.abort();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "application/x-ndjson",
      "Cache-Control": "no-store",
    },
  });
}
