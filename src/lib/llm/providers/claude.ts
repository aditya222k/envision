import { NotImplementedError, type LlmProvider } from "../types";

export const claude: LlmProvider = {
  id: "claude",
  isConfigured: () =>
    Boolean(process.env.ANTHROPIC_API_KEY && process.env.CLAUDE_MODEL),
  async generate() {
    // TODO: call the Anthropic Messages API with CLAUDE_MODEL.
    throw new NotImplementedError("claude");
  },
};
