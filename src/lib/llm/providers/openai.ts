import { NotImplementedError, type LlmProvider } from "../types";

export const openai: LlmProvider = {
  id: "openai",
  async generate() {
    // TODO: call the OpenAI API using getProviderConfig("openai").
    throw new NotImplementedError("openai");
  },
};
