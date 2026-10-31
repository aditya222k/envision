import { buildGame } from "@/lib/games/pipeline";
import { finishRun, startRun } from "@/lib/games/runs";
import {
  GenerationStoppedError,
  getProvider,
  isProviderId,
  NotImplementedError,
  ProviderRequestError,
} from "@/lib/llm";
import { isProviderConfigured } from "@/lib/llm/config";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (typeof body?.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (body.provider !== undefined && !isProviderId(body.provider)) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }

  const provider = getProvider(body.provider);
  if (!(await isProviderConfigured(provider.id))) {
    return Response.json(
      { error: `${provider.id} is not configured` },
      { status: 503 },
    );
  }

  const runId = typeof body.runId === "string" ? body.runId : crypto.randomUUID();
  const run = startRun(runId);

  try {
    const signal = AbortSignal.any([request.signal, run.signal]);
    return Response.json(await buildGame(provider, body.prompt, signal));
  } catch (error) {
    if (error instanceof GenerationStoppedError) {
      return Response.json({ stopped: true }, { status: 499 });
    }
    if (error instanceof NotImplementedError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    if (error instanceof ProviderRequestError) {
      return Response.json({ error: error.message }, { status: 502 });
    }
    throw error;
  } finally {
    finishRun(runId);
  }
}
