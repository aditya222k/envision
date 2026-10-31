import { parseJson } from "@/lib/games/pipeline";
import { getProvider, isProviderId } from "@/lib/llm";
import { isProviderConfigured } from "@/lib/llm/config";
import { COMPANION_SYSTEM_PROMPT } from "@/lib/llm/prompt";

const EXPERIENCES = [
  "world3d",
  "bodies",
  "systems",
  "decide",
  "arrange",
  "custom",
  "quest",
];

const WANTS_3D = /\b(3d|3-d|three[- ]dimensional)\b/i;

// Forces need the real physics engine, not formulas written by a model.
const FORCE_TOPICS =
  /\b(gravity|gravitational|orbits?|orbital|planets?|moons?|solar system|satellites?|asteroids?|electric charges?|electrostatic|coulomb)\b/i;

const COMPANION_SCHEMA = {
  type: "object",
  properties: {
    experience: { type: "string", enum: EXPERIENCES },
    reason: { type: "string", minLength: 1, maxLength: 160 },
    questions: {
      type: "array",
      maxItems: 2,
      items: {
        type: "object",
        properties: {
          question: { type: "string", minLength: 1, maxLength: 120 },
          options: {
            type: "array",
            minItems: 2,
            maxItems: 4,
            items: { type: "string", minLength: 1, maxLength: 60 },
          },
        },
        required: ["question", "options"],
      },
    },
  },
  required: ["experience", "reason", "questions"],
};

type CompanionReply = {
  experience: string;
  reason: string;
  questions: { question: string; options: string[] }[];
};

export async function POST(request: Request) {
  const body = await request.json().catch(() => null);
  if (typeof body?.prompt !== "string" || !body.prompt.trim()) {
    return Response.json({ error: "prompt is required" }, { status: 400 });
  }
  const chosenStyle = EXPERIENCES.includes(body.style) ? body.style : null;
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

  // The companion is a helpful extra, so a failure must not block building.
  try {
    const { text } = await provider.generate({
      system: COMPANION_SYSTEM_PROMPT,
      prompt: body.prompt,
      schema: COMPANION_SCHEMA,
      signal: request.signal,
    });
    const answer = parseJson(text) as CompanionReply | null;
    if (answer && EXPERIENCES.includes(answer.experience)) {
      return Response.json({
        // What the teacher asks for always beats the model's suggestion.
        experience:
          chosenStyle ??
          (WANTS_3D.test(body.prompt)
            ? "world3d"
            : answer.experience === "systems" && FORCE_TOPICS.test(body.prompt)
              ? "bodies"
              : answer.experience),
        reason: answer.reason ?? "",
        questions: Array.isArray(answer.questions)
          ? answer.questions.filter(
              (item) => item.question && item.options?.length >= 2,
            )
          : [],
      });
    }
  } catch (error) {
    console.warn("Companion unavailable:", error);
  }
  // Says plainly that no suggestion came back, rather than presenting a default as one.
  return Response.json({
    experience:
      chosenStyle ?? (WANTS_3D.test(body.prompt) ? "world3d" : "custom"),
    reason:
      "The AI model didn't answer, so there's no suggestion. Choose a type of game.",
    questions: [],
  });
}
