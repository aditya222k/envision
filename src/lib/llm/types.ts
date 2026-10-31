export const PROVIDER_IDS = ["claude", "openai", "gemini", "ollama"] as const;

export type ProviderId = (typeof PROVIDER_IDS)[number];

export type GenerateRequest = {
  prompt: string;
};

export type GenerateResult = {
  provider: ProviderId;
  model: string;
  text: string;
};

export type LlmProvider = {
  id: ProviderId;
  isConfigured: () => boolean;
  generate: (request: GenerateRequest) => Promise<GenerateResult>;
};

export class NotImplementedError extends Error {
  constructor(provider: ProviderId) {
    super(`The ${provider} provider is not implemented yet.`);
    this.name = "NotImplementedError";
  }
}
