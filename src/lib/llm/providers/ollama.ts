import { getProviderConfig } from "../config";
import { GAME_SYSTEM_PROMPT, stripCodeFence } from "../prompt";
import { ProviderRequestError, type LlmProvider } from "../types";

export const ollama: LlmProvider = {
  id: "ollama",
  async generate({ prompt }) {
    const { endpoint, model } = await getProviderConfig("ollama");

    const response = await fetch(`${endpoint}/api/chat`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model,
        stream: false,
        messages: [
          { role: "system", content: GAME_SYSTEM_PROMPT },
          { role: "user", content: prompt },
        ],
      }),
    }).catch(() => {
      throw new ProviderRequestError(
        `Envision couldn't reach Ollama at ${endpoint}. Check that it's running.`,
      );
    });

    const data = await response.json().catch(() => null);
    if (!response.ok) {
      throw new ProviderRequestError(
        `Ollama couldn't run ${model}: ${data?.error ?? response.status}`,
      );
    }

    return {
      provider: "ollama",
      model,
      text: stripCodeFence(data.message.content),
    };
  },
};
