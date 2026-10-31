import { buildLab, reviseLab } from "@/lib/games/buildLab";
import {
  buildCustomGame,
  customSpec,
  reviseCustomGame,
} from "@/lib/games/customGame";
import {
  runDemoBuild,
  runDemoChange,
  runPrebuiltBuild,
  runPrebuiltChange,
} from "@/lib/games/demo";
import { LAB_KITS, type LabKit } from "@/lib/games/lab";
import { buildGame } from "@/lib/games/pipeline";
import { researchLesson, withResearch } from "@/lib/games/research";
import { reviseGame } from "@/lib/games/revise";
import { finishRun, startRun } from "@/lib/games/runs";
import { parseGameSpec } from "@/lib/games/spec";
import { topicPrompt } from "@/lib/games/storyline";
import { getStoryline, linkTopicGame } from "@/lib/games/storylineStore";
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
  // Ready-made games aren't saved, so they're changed by their own route.
  const prebuiltId = gameId?.startsWith("prebuilt-") ? gameId : null;
  const currentSpec = gameId && !prebuiltId ? await getLatestSpec(gameId) : null;
  if (gameId && !prebuiltId && !currentSpec) {
    return Response.json({ error: "That game no longer exists." }, { status: 404 });
  }

  const storyline =
    typeof body.storylineId === "string"
      ? await getStoryline(body.storylineId)
      : null;
  const topicRun =
    storyline && typeof body.topicId === "string"
      ? topicPrompt(storyline, body.topicId)
      : null;
  if (body.storylineId && !topicRun) {
    return Response.json({ error: "That level no longer exists." }, { status: 404 });
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
        if (prebuiltId) {
          send({
            type: "result",
            game: await runPrebuiltChange(
              prebuiltId,
              Number(body.versionCount) || 1,
              signal,
              onProgress,
            ),
          });
        } else if (isDemo && !gameId && !storyline) {
          send({
            type: "result",
            game: await runPrebuiltBuild(body.prompt, signal, onProgress),
          });
        } else if (isDemo) {
          // Incognito never calls a provider or changes a saved game.
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
              : await runDemoBuild(body.prompt, signal, onProgress, send);
          if (storyline && topicRun && game) {
            await linkTopicGame(storyline.id, topicRun.topic.id, game.id);
          }
          send({ type: "result", game, spec: game?.spec });
        } else if (gameId && currentSpec?.custom) {
          const revision = await reviseCustomGame(
            provider,
            currentSpec,
            body.prompt,
            signal,
            onProgress,
          );
          const game = await addVersion(
            gameId,
            customSpec(
              currentSpec.custom.plan,
              revision.html,
              revision.notes,
              currentSpec.custom.kind,
            ),
            "Updated the game.",
          );
          send(
            game
              ? { type: "result", game }
              : { type: "error", status: 404, error: "That game no longer exists." },
          );
        } else if (
          (body.experience === "custom" || body.experience === "world3d") &&
          !gameId
        ) {
          onProgress({ label: "Looking up the facts", percent: 2 });
          const lesson = topicRun?.prompt ?? body.prompt;
          const research = await researchLesson(provider, lesson, signal);
          send({ type: "sources", sources: research.sources });
          const build = await buildCustomGame(
            provider,
            withResearch(lesson, research),
            signal,
            onProgress,
            send,
            body.experience === "world3d" ? "3d" : undefined,
          );
          const game = await createGame({
            ...customSpec(build.plan, build.html, build.notes, build.kind),
            sources: research.sources,
          });
          if (storyline && topicRun) {
            await linkTopicGame(storyline.id, topicRun.topic.id, game.id);
          }
          send({ type: "result", game, spec: game.spec });
        } else if (gameId && currentSpec?.lab) {
          const revision = await reviseLab(
            provider,
            currentSpec,
            body.prompt,
            signal,
            onProgress,
            send,
          );
          const game = await addVersion(gameId, revision.spec, "Updated the lab.");
          send(
            game
              ? { type: "result", game }
              : { type: "error", status: 404, error: "That game no longer exists." },
          );
        } else if (LAB_KITS.includes(body.experience as LabKit) && !gameId) {
          onProgress({ label: "Looking up the facts", percent: 2 });
          const lesson = topicRun?.prompt ?? body.prompt;
          const research = await researchLesson(provider, lesson, signal);
          send({ type: "sources", sources: research.sources });
          const build = await buildLab(
            provider,
            body.experience as LabKit,
            withResearch(lesson, research),
            signal,
            onProgress,
            send,
          );
          const game = await createGame({
            ...build.spec,
            sources: research.sources,
          });
          if (storyline && topicRun) {
            await linkTopicGame(storyline.id, topicRun.topic.id, game.id);
          }
          send({ type: "result", game, spec: build.spec });
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
            revision.doubtfulRounds,
          );
          send(
            game
              ? { type: "result", game }
              : { type: "error", status: 404, error: "That game no longer exists." },
          );
        } else {
          onProgress({ label: "Looking up the facts", percent: 2 });
          const lesson = topicRun?.prompt ?? body.prompt;
          const research = await researchLesson(provider, lesson, signal);
          send({ type: "sources", sources: research.sources });
          const build = await buildGame(
            provider,
            withResearch(lesson, research),
            signal,
            onProgress,
            send,
          );
          // Every game in a storyline keeps the same hero and its chapter's world.
          const spec =
            storyline && topicRun
              ? {
                  ...build.spec,
                  player: storyline.hero,
                  theme: topicRun.chapter.theme,
                }
              : build.spec;
          const game = await createGame(
            { ...spec, sources: research.sources },
            build.doubtfulRounds,
          );
          if (storyline && topicRun) {
            await linkTopicGame(storyline.id, topicRun.topic.id, game.id);
          }
          send({
            type: "result",
            game,
            spec,
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
