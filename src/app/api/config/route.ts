import { connection } from "next/server";
import { isProviderId } from "@/lib/llm";
import {
  canEditConfig,
  ConfigValidationError,
  getProviderSummary,
  listProviderSummaries,
  saveProviderConfig,
} from "@/lib/llm/config";

export async function GET() {
  await connection();
  return Response.json({
    editable: canEditConfig(),
    providers: await listProviderSummaries(),
  });
}

export async function PUT(request: Request) {
  if (!canEditConfig()) {
    return Response.json(
      { error: "Configuration can only be changed in local development." },
      { status: 403 },
    );
  }

  const body = await request.json().catch(() => null);
  if (!isProviderId(body?.provider)) {
    return Response.json({ error: "unknown provider" }, { status: 400 });
  }
  const { endpoint, model, apiKey = "" } = body;
  if ([endpoint, model, apiKey].some((value) => typeof value !== "string")) {
    return Response.json(
      { error: "endpoint, model and apiKey must be strings" },
      { status: 400 },
    );
  }

  try {
    await saveProviderConfig(body.provider, { endpoint, model, apiKey });
  } catch (error) {
    if (error instanceof ConfigValidationError) {
      return Response.json({ error: error.message }, { status: 400 });
    }
    throw error;
  }

  return Response.json(await getProviderSummary(body.provider));
}
