import { claude } from "./providers/claude";
import { gemini } from "./providers/gemini";
import { ollama } from "./providers/ollama";
import { openai } from "./providers/openai";
import { PROVIDER_IDS, type LlmProvider, type ProviderId } from "./types";

export { NotImplementedError, ProviderRequestError } from "./types";

const providers: Record<ProviderId, LlmProvider> = {
  claude,
  openai,
  gemini,
  ollama,
};

export function isProviderId(value: unknown): value is ProviderId {
  return PROVIDER_IDS.includes(value as ProviderId);
}

export function getProvider(id?: ProviderId): LlmProvider {
  const selected = id ?? process.env.LLM_PROVIDER;
  if (!isProviderId(selected)) {
    throw new Error(`LLM_PROVIDER must be one of: ${PROVIDER_IDS.join(", ")}`);
  }
  return providers[selected];
}
