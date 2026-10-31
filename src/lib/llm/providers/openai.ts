import { NotImplementedError, type LlmProvider } from "../types";

export const openai: LlmProvider = {
  id: "openai",
  isConfigured: () =>
    Boolean(process.env.OPENAI_API_KEY && process.env.OPENAI_MODEL),
  async generate() {
    // TODO: call the OpenAI API with OPENAI_MODEL.
    throw new NotImplementedError("openai");
  },
};
