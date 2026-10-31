export const PROVIDER_IDS = ["claude", "openai", "gemini", "ollama"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export const PROVIDER_LABELS: Record<ProviderId, string> = {
  claude: "Claude",
  openai: "OpenAI",
  gemini: "Gemini",
  ollama: "Ollama (local)",
};

export type ProviderSummary = {
  id: ProviderId;
  endpoint: string;
  model: string;
  maskedApiKey: string;
  requiresApiKey: boolean;
  isConfigured: boolean;
};

export type GenerateRequest = {
  system: string;
  prompt: string;
  schema: object;
  signal?: AbortSignal;
};

export type GenerateResult = {
  model: string;
  text: string;
};

export type LlmProvider = {
  id: ProviderId;
  generate: (request: GenerateRequest) => Promise<GenerateResult>;
  unload?: () => Promise<boolean>;
};

export class ProviderRequestError extends Error {}

export class GenerationStoppedError extends Error {}

export class NotImplementedError extends Error {
  constructor(provider: ProviderId) {
    super(`The ${provider} provider is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}
