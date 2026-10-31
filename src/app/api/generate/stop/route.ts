import { stopRun } from "@/lib/games/runs";
import { getProvider, isProviderId } from "@/lib/llm";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (typeof body?.runId !== "string" || !isProviderId(body.provider)) {
    return Response.json(
      { error: "runId and provider are required" },
      { status: 400 },
    );
  }

  stopRun(body.runId);
  const unloaded = (await getProvider(body.provider).unload?.()) ?? true;
  return Response.json({ stopped: true, unloaded });
}
