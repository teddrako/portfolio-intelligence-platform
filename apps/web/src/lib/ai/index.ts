import { GeminiAdapter } from "./gemini";
import type { AIAdapter } from "./adapter";

export type { AIAdapter, GenerateTextInput, GenerateTextOutput } from "./adapter";

// Swap this export to change the active provider (Anthropic, OpenAI, etc.)
export const ai: AIAdapter = new GeminiAdapter();

// ─── Domain helpers ───────────────────────────────────────────────────────────

export interface TopMover {
  ticker: string;
  name: string;
  changePercent: number;
}

export interface NewsItem {
  headline: string;
  source: string;
  summary?: string;
}

export async function generatePortfolioCloseNote(
  portfolioSummary: {
    totalValue: number;
    dayChangePercent: number;
    topHoldings: string[];
  },
  topMovers: TopMover[],
  keyNews: NewsItem[],
  macroContext?: string,
): Promise<string> {
  const prompt = [
    "Generate a concise daily close note for a retail investor's portfolio.",
    "",
    `Portfolio value: $${portfolioSummary.totalValue.toLocaleString()}`,
    `Day change: ${portfolioSummary.dayChangePercent >= 0 ? "+" : ""}${portfolioSummary.dayChangePercent.toFixed(2)}%`,
    `Top holdings: ${portfolioSummary.topHoldings.join(", ")}`,
    "",
    "Top movers:",
    ...topMovers.map(
      (m) =>
        `  ${m.ticker} (${m.name}): ${m.changePercent >= 0 ? "+" : ""}${m.changePercent.toFixed(2)}%`,
    ),
    "",
    "Key news:",
    ...keyNews.map((n) => `  [${n.source}] ${n.headline}`),
    macroContext ? `\nMacro context: ${macroContext}` : "",
  ]
    .filter((l) => l !== undefined)
    .join("\n");

  const systemPrompt =
    "You are a concise financial analyst writing a daily portfolio close note. " +
    "Keep the note under 200 words. Use plain language, no jargon. " +
    "Structure: 1-sentence summary, key drivers, notable news, brief outlook.";

  const result = await ai.generateText({ prompt, systemPrompt, temperature: 0.4 });
  return result.text;
}
