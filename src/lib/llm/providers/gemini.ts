import { NotImplementedError, type LlmProvider } from "../types";

export const gemini: LlmProvider = {
  id: "gemini",
  async generate() {
    // TODO: call the Gemini API using getProviderConfig("gemini").
    throw new NotImplementedError("gemini");
  },
};
