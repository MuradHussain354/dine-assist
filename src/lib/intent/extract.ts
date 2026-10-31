import { getProvider } from "../llm";
import { intentSchema, Intent } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";
import { extractFallbackIntent } from "./fallback";

export interface ExtractResult {
  intent: Intent;
  usedFallback: boolean;
  latencyMs: number;
}

export async function extractIntent(query: string): Promise<ExtractResult> {
  const startTime = performance.now();

  try {
    const provider = getProvider();
    const rawOutput = await provider.generateJson(SYSTEM_PROMPT, query);

    let cleaned = rawOutput.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    const parsed = JSON.parse(cleaned);
    const result = intentSchema.safeParse(parsed);

    if (result.success) {
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        intent: result.data,
        usedFallback: false,
        latencyMs,
      };
    }

    console.warn("Intent Zod validation failed, using fallback:", result.error);
  } catch (error) {
    console.warn("LLM extraction failed or timed out, using fallback:", error);
  }

  // Fallback path
  const fallbackIntent = extractFallbackIntent(query);
  const latencyMs = Math.round(performance.now() - startTime);

  return {
    intent: fallbackIntent,
    usedFallback: true,
    latencyMs,
  };
}
