"use client";

import { useEffect, useState, type FormEvent } from "react";
import { PROVIDER_LABELS, type ProviderSummary } from "@/lib/llm/types";

function ProviderRow({
  initial,
  editable,
}: {
  initial: ProviderSummary;
  editable: boolean;
}) {
  const [summary, setSummary] = useState(initial);
  const [endpoint, setEndpoint] = useState(initial.endpoint);
  const [model, setModel] = useState(initial.model);
  const [apiKey, setApiKey] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const label = PROVIDER_LABELS[summary.id];

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSaving(true);
    setMessage(null);
    setError(null);

    try {
      const response = await fetch("/api/config", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          provider: summary.id,
          endpoint,
          model,
          apiKey,
        }),
      });
      const data = await response.json().catch(() => null);

      if (response.ok) {
        setSummary(data);
        setEndpoint(data.endpoint);
        setModel(data.model);
        setApiKey("");
        setMessage(`${label} settings saved.`);
      } else {
        setError(data?.error ?? "The settings weren't saved. Try again.");
      }
    } catch {
      setError("Envision couldn't reach the server. Try again.");
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="grid gap-6 p-6 sm:p-8 md:grid-cols-[1fr_2fr]"
    >
      <div className="flex flex-col gap-1">
        <h2 className="text-2xl font-bold text-ink">{label}</h2>
        <p className={`font-bold ${summary.isConfigured ? "text-science" : "text-ink-soft"}`}>
          {summary.isConfigured ? "Ready to use" : "Not set up yet"}
        </p>
      </div>

      <div className="flex flex-col gap-4">
        <label className="field-label">
          API endpoint
          <input
            type="url"
            value={endpoint}
            onChange={(event) => setEndpoint(event.target.value)}
            required
            disabled={!editable}
            className="field h-12 px-3"
          />
        </label>

        {summary.requiresApiKey && (
          <label className="field-label">
            API key
            <input
              type="password"
              value={apiKey}
              onChange={(event) => setApiKey(event.target.value)}
              placeholder={summary.maskedApiKey || "Paste your API key"}
              autoComplete="new-password"
              disabled={!editable}
              className="field h-12 px-3"
            />
            {summary.maskedApiKey && (
              <span className="font-normal">
                Your key is saved. Leave this blank to keep it.
              </span>
            )}
          </label>
        )}

        <label className="field-label">
          Model
          <input
            type="text"
            value={model}
            onChange={(event) => setModel(event.target.value)}
            disabled={!editable}
            className="field h-12 px-3"
          />
        </label>

        <button
          type="submit"
          disabled={!editable || isSaving}
          className="action h-12 px-6 sm:self-start"
        >
          {isSaving ? "Saving..." : `Save ${label} settings`}
        </button>

        {message && (
          <p role="status" className="font-bold text-science">
            {message}
          </p>
        )}
        {error && (
          <p role="alert" className="font-bold text-history">
            {error}
          </p>
        )}
      </div>
    </form>
  );
}

export function ProviderSettings() {
  const [providers, setProviders] = useState<ProviderSummary[] | null>(null);
  const [editable, setEditable] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/config", { cache: "no-store" })
      .then((response) => {
        if (!response.ok) {
          throw new Error();
        }
        return response.json();
      })
      .then((data) => {
        setEditable(data.editable);
        setProviders(data.providers);
      })
      .catch(() => setError("Envision couldn't load your settings. Reload the page."));
  }, []);

  if (error) {
    return (
      <p role="alert" className="p-6 font-bold text-history sm:p-8">
        {error}
      </p>
    );
  }
  if (!providers) {
    return <p className="p-6 text-ink-soft sm:p-8">Loading settings...</p>;
  }

  return (
    <>
      {!editable && (
        <p className="bg-[var(--pencil-light)] p-6 text-ink sm:p-8">
          These settings can only be changed in local development. Use
          environment variables for this deployment.
        </p>
      )}
      {providers.map((provider) => (
        <ProviderRow key={provider.id} initial={provider} editable={editable} />
      ))}
    </>
  );
}
