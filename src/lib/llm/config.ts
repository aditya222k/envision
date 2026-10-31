import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import {
  PROVIDER_IDS,
  type ProviderId,
  type ProviderSummary,
} from "./types";

type ProviderConfig = {
  endpoint: string;
  apiKey: string;
  model: string;
};

type StoredConfig = Partial<Record<ProviderId, Partial<ProviderConfig>>>;

const CONFIG_PATH = path.join(process.cwd(), ".envision", "providers.json");

const PROVIDER_SETTINGS: Record<
  ProviderId,
  {
    defaultEndpoint: string;
    endpointEnv: string;
    modelEnv: string;
    apiKeyEnv: string | null;
  }
> = {
  claude: {
    defaultEndpoint: "https://api.anthropic.com",
    endpointEnv: "ANTHROPIC_BASE_URL",
    modelEnv: "CLAUDE_MODEL",
    apiKeyEnv: "ANTHROPIC_API_KEY",
  },
  openai: {
    defaultEndpoint: "https://api.openai.com/v1",
    endpointEnv: "OPENAI_BASE_URL",
    modelEnv: "OPENAI_MODEL",
    apiKeyEnv: "OPENAI_API_KEY",
  },
  gemini: {
    defaultEndpoint: "https://generativelanguage.googleapis.com",
    endpointEnv: "GEMINI_BASE_URL",
    modelEnv: "GEMINI_MODEL",
    apiKeyEnv: "GEMINI_API_KEY",
  },
  ollama: {
    defaultEndpoint: "http://localhost:11434",
    endpointEnv: "OLLAMA_BASE_URL",
    modelEnv: "OLLAMA_MODEL",
    apiKeyEnv: null,
  },
};

export class ConfigValidationError extends Error {}

// The config page has no login yet, so saving is limited to local development.
export function canEditConfig() {
  return process.env.NODE_ENV !== "production";
}

async function readStoredConfig(): Promise<StoredConfig> {
  try {
    return JSON.parse(await readFile(CONFIG_PATH, "utf8"));
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ENOENT") {
      return {};
    }
    throw error;
  }
}

export async function getProviderConfig(
  id: ProviderId,
): Promise<ProviderConfig> {
  const settings = PROVIDER_SETTINGS[id];
  const stored = (await readStoredConfig())[id];
  const envApiKey = settings.apiKeyEnv ? process.env[settings.apiKeyEnv] : "";

  return {
    endpoint:
      stored?.endpoint ||
      process.env[settings.endpointEnv] ||
      settings.defaultEndpoint,
    apiKey: stored?.apiKey || envApiKey || "",
    model: stored?.model || process.env[settings.modelEnv] || "",
  };
}

export async function isProviderConfigured(id: ProviderId) {
  const { endpoint, apiKey, model } = await getProviderConfig(id);
  const hasRequiredKey = !PROVIDER_SETTINGS[id].apiKeyEnv || Boolean(apiKey);
  return Boolean(endpoint && model && hasRequiredKey);
}

function maskApiKey(apiKey: string) {
  if (!apiKey) {
    return "";
  }
  const lastFour = apiKey.length >= 16 ? apiKey.slice(-4) : "";
  return `${"•".repeat(8)}${lastFour}`;
}

export async function getProviderSummary(
  id: ProviderId,
): Promise<ProviderSummary> {
  const { endpoint, apiKey, model } = await getProviderConfig(id);
  return {
    id,
    endpoint,
    model,
    maskedApiKey: maskApiKey(apiKey),
    requiresApiKey: Boolean(PROVIDER_SETTINGS[id].apiKeyEnv),
    isConfigured: await isProviderConfigured(id),
  };
}

export function listProviderSummaries() {
  return Promise.all(PROVIDER_IDS.map(getProviderSummary));
}

function normalizeEndpoint(endpoint: string) {
  let url: URL;
  try {
    url = new URL(endpoint.trim());
  } catch {
    throw new ConfigValidationError("Enter a valid endpoint URL.");
  }
  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ConfigValidationError("The endpoint must use http or https.");
  }
  return url.href.replace(/\/+$/, "");
}

export async function saveProviderConfig(
  id: ProviderId,
  update: ProviderConfig,
) {
  const endpoint = normalizeEndpoint(update.endpoint);
  const apiKey = update.apiKey.trim();
  const current = await getProviderConfig(id);

  // Stops a saved key from being sent to an endpoint it wasn't entered for.
  if (current.apiKey && endpoint !== current.endpoint && !apiKey) {
    throw new ConfigValidationError(
      "Re-enter the API key when changing the endpoint.",
    );
  }

  const stored = await readStoredConfig();
  stored[id] = {
    ...stored[id],
    endpoint,
    model: update.model.trim(),
    ...(apiKey && { apiKey }),
  };

  await mkdir(path.dirname(CONFIG_PATH), { recursive: true });
  await writeFile(CONFIG_PATH, JSON.stringify(stored, null, 2), { mode: 0o600 });
}
