import { NextRequest, NextResponse } from "next/server";
import { z } from "zod";
import { ai } from "@/lib/ai";

const requestSchema = z.object({
  prompt: z.string().min(1).max(4000),
  systemPrompt: z.string().max(2000).optional(),
});

export async function POST(req: NextRequest) {
  let body: unknown;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: "Invalid JSON" }, { status: 400 });
  }

  const parsed = requestSchema.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: "Validation failed", issues: parsed.error.issues },
      { status: 400 },
    );
  }

  try {
    const result = await ai.generateText({
      prompt: parsed.data.prompt,
      systemPrompt: parsed.data.systemPrompt,
    });
    return NextResponse.json(result);
  } catch (err) {
    const message = err instanceof Error ? err.message : "Generation failed";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
