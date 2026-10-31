import { NotImplementedError, type LlmProvider } from "../types";

export const gemini: LlmProvider = {
  id: "gemini",
  isConfigured: () =>
    Boolean(process.env.GEMINI_API_KEY && process.env.GEMINI_MODEL),
  async generate() {
    // TODO: call the Gemini API with GEMINI_MODEL.
    throw new NotImplementedError("gemini");
  },
};
