import { NotImplementedError, type LlmProvider } from "../types";

export const claude: LlmProvider = {
  id: "claude",
  async generate() {
    // TODO: call the Anthropic Messages API using getProviderConfig("claude").
    throw new NotImplementedError("claude");
  },
};
