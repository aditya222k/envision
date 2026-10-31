import { NotImplementedError, type LlmProvider } from "../types";

export const ollama: LlmProvider = {
  id: "ollama",
  isConfigured: () =>
    Boolean(process.env.OLLAMA_BASE_URL && process.env.OLLAMA_MODEL),
  async generate() {
    // TODO: call the Ollama server at OLLAMA_BASE_URL with OLLAMA_MODEL.
    throw new NotImplementedError("ollama");
  },
};
