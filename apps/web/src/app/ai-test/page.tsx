"use client";

import { useState } from "react";

interface AIResponse {
  text: string;
  model: string;
  tokensUsed?: { input: number; output: number; total: number };
}

export default function AITestPage() {
  const [prompt, setPrompt] = useState("");
  const [systemPrompt, setSystemPrompt] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<AIResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setResult(null);
    setError(null);

    try {
      const res = await fetch("/api/ai/test", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          prompt,
          systemPrompt: systemPrompt.trim() || undefined,
        }),
      });

      const data = await res.json();
      if (!res.ok) {
        setError(data.error ?? "Unknown error");
      } else {
        setResult(data as AIResponse);
      }
    } catch {
      setError("Request failed — check console");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="mx-auto max-w-2xl p-8">
      <h1 className="mb-6 text-2xl font-bold">AI Integration Test</h1>
      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            System prompt <span className="text-gray-400">(optional)</span>
          </label>
          <textarea
            value={systemPrompt}
            onChange={(e) => setSystemPrompt(e.target.value)}
            rows={3}
            placeholder="You are a helpful assistant..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <div>
          <label className="mb-1 block text-sm font-medium text-gray-700">
            Prompt <span className="text-red-500">*</span>
          </label>
          <textarea
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            rows={5}
            required
            placeholder="Enter your prompt here..."
            className="w-full rounded-md border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
        </div>

        <button
          type="submit"
          disabled={loading || !prompt.trim()}
          className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {loading ? "Generating..." : "Generate"}
        </button>
      </form>

      {error && (
        <div className="mt-6 rounded-md border border-red-200 bg-red-50 p-4">
          <p className="text-sm font-medium text-red-700">Error</p>
          <p className="mt-1 text-sm text-red-600">{error}</p>
        </div>
      )}

      {result && (
        <div className="mt-6 space-y-3">
          <div className="flex items-center justify-between">
            <p className="text-sm font-medium text-gray-700">Response</p>
            <span className="text-xs text-gray-400">
              model: {result.model}
              {result.tokensUsed && ` · ${result.tokensUsed.total} tokens`}
            </span>
          </div>
          <div className="rounded-md border border-gray-200 bg-gray-50 p-4">
            <pre className="whitespace-pre-wrap text-sm text-gray-800">{result.text}</pre>
          </div>
        </div>
      )}
    </div>
  );
}
