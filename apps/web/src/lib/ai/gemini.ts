import { GoogleGenAI } from "@google/genai";
import type { AIAdapter, GenerateTextInput, GenerateTextOutput } from "./adapter";

function getClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) throw new Error("GEMINI_API_KEY is not set");
  return new GoogleGenAI({ apiKey });
}

export class GeminiAdapter implements AIAdapter {
  async generateText(input: GenerateTextInput): Promise<GenerateTextOutput> {
    const ai = getClient();
    const model = process.env.GEMINI_MODEL ?? "gemini-2.5-flash";

    const result = await ai.models.generateContent({
      model,
      contents: input.prompt,
      config: {
        ...(input.systemPrompt ? { systemInstruction: input.systemPrompt } : {}),
        ...(input.temperature !== undefined ? { temperature: input.temperature } : {}),
        ...(input.maxOutputTokens !== undefined ? { maxOutputTokens: input.maxOutputTokens } : {}),
      },
    });

    const text = result.text ?? "";
    const usage = result.usageMetadata;

    return {
      text,
      model,
      tokensUsed: usage
        ? {
            input: usage.promptTokenCount ?? 0,
            output: usage.candidatesTokenCount ?? 0,
            total: usage.totalTokenCount ?? 0,
          }
        : undefined,
    };
  }
}
