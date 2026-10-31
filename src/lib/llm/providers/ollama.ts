import { getProviderConfig } from "../config";
import {
  GenerationStoppedError,
  ProviderRequestError,
  type LlmProvider,
} from "../types";

const CONTEXT_TOKENS = 16384;
const UNLOAD_CHECKS = 10;
const UNLOAD_CHECK_MS = 500;

async function isModelLoaded(endpoint: string, model: string) {
  const response = await fetch(`${endpoint}/api/ps`);
  const data = await response.json();
  return data.models.some((item: { name: string }) => item.name === model);
}

export const ollama: LlmProvider = {
  id: "ollama",
  async generate({ system, prompt, schema, signal }) {
    const { endpoint, model } = await getProviderConfig("ollama");

    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: schema,
        options: { num_ctx: CONTEXT_TOKENS },
        messages: [
          { role: "system", content: system },
          { role: "user", content: prompt },
        ],
      }),
    }).catch(() => {
      if (signal?.aborted) {
        throw new GenerationStoppedError();
      }
      throw new ProviderRequestError(
        `Envision couldn't reach Ollama at ${endpoint}. Check that it's running.`,
      );
    });

    const data = await response.json().catch(() => {
      if (signal?.aborted) {
        throw new GenerationStoppedError();
      }
      return null;
    });
    if (!response.ok) {
      throw new ProviderRequestError(
        `Ollama couldn't run ${model}: ${data?.error ?? response.status}`,
      );
    }

    return { model, text: data.message.content };
  },

  // Repeats the request because Ollama can keep the model while a cancelled
  // generation is still shutting down.
  async unload() {
    const { endpoint, model } = await getProviderConfig("ollama");

    try {
      for (let check = 0; check < UNLOAD_CHECKS; check++) {
        await fetch(`${endpoint}/api/generate`, {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ model, keep_alive: 0 }),
        });
        if (!(await isModelLoaded(endpoint, model))) {
          return true;
        }
        await new Promise((resolve) => setTimeout(resolve, UNLOAD_CHECK_MS));
      }
    } catch {
      return false;
    }
    return false;
  },
};
