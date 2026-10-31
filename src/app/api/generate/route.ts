import { getProvider, isProviderId, NotImplementedError } from "@/lib/llm";

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);

  if (typeof body?.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  if (body.provider !== undefined && !isProviderId(body.provider)) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }

  const provider = getProvider(body.provider);
  if (!provider.isConfigured()) {
    return Response.json(
      { error: `${provider.id} is not configured` },
      { status: 503 },
    );
  }

  try {
    const result = await provider.generate({ prompt: body.prompt });
    return Response.json(result);
  } catch (error) {
    if (error instanceof NotImplementedError) {
      return Response.json({ error: error.message }, { status: 501 });
    }
    throw error;
  }
}
