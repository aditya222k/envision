import { connection } from "next/server";
import { parseJson } from "@/lib/games/pipeline";
import { finishRun, startRun } from "@/lib/games/runs";
import { parseOutline, STORYLINE_SCHEMA } from "@/lib/games/storyline";
import {
  createStoryline,
  listStorylines,
} from "@/lib/games/storylineStore";
import {
  GenerationStoppedError,
  getProvider,
  isProviderId,
  ProviderRequestError,
} from "@/lib/llm";
import { isProviderConfigured } from "@/lib/llm/config";
import { STORYLINE_SYSTEM_PROMPT } from "@/lib/llm/prompt";

const EXPECTED_CHARACTERS = 2000;
const MAX_ATTEMPTS = 2;

export async function GET() {
  await connection();
  return Response.json({ storylines: await listStorylines() });
}

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  const subject = typeof body?.subject === "string" ? body.subject.trim() : "";
  if (!subject) {
    return Response.json({ error: "subject is required" }, { status: 400 });
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
  const signal = AbortSignal.any([request.signal, run.signal]);
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (event: object) => {
        try {
          controller.enqueue(encoder.encode(`${JSON.stringify(event)}\n`));
        } catch {
          // The page has gone, so there's nobody left to tell.
        }
      };

      try {
        for (let attempt = 1; attempt <= MAX_ATTEMPTS; attempt++) {
          send({ type: "progress", label: "Starting the AI model", percent: 5 });
          const { text } = await provider.generate({
            system: STORYLINE_SYSTEM_PROMPT,
            prompt: `Subject: ${subject}\nTeacher's notes: ${body.notes || "None"}`,
            schema: STORYLINE_SCHEMA,
            signal,
            onCharacters: (count) =>
              send({
                type: "progress",
                label: "Planning your storyline",
                percent: 5 + Math.min(count / EXPECTED_CHARACTERS, 1) * 90,
              }),
          });

          const outline = parseJson(text);
          if (parseOutline(outline)) {
            send({
              type: "result",
              storyline: await createStoryline(subject, outline),
            });
            return;
          }
        }
        throw new ProviderRequestError(
          "Envision couldn't plan that storyline. Add more detail and try again.",
        );
      } catch (error) {
        if (error instanceof GenerationStoppedError) {
          send({ type: "stopped" });
        } else {
          console.error(error);
          send({
            type: "error",
            error:
              error instanceof ProviderRequestError
                ? error.message
                : "Something went wrong. Try again.",
          });
        }
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
