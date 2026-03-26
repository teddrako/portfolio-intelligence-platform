export interface GenerateTextInput {
  prompt: string;
  systemPrompt?: string;
  temperature?: number;
  maxOutputTokens?: number;
}

export interface GenerateTextOutput {
  text: string;
  model: string;
  tokensUsed?: {
    input: number;
    output: number;
    total: number;
  };
}

export interface AIAdapter {
  generateText(input: GenerateTextInput): Promise<GenerateTextOutput>;
}
