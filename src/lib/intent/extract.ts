import { getProvider } from "../llm";
import { intentSchema, Intent } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";
import {
  extractFallbackIntent,
  DIET_KEYWORDS,
  SPICE_KEYWORDS,
  BUDGET_NUMBER_PATTERN,
} from "./fallback";

export type FallbackReason =
  | "timeout"
  | "invalid_json"
  | "schema_validation"
  | "provider_error"
  | null;

export interface ExtractResult {
  intent: Intent;
  usedFallback: boolean;
  fallbackReason: FallbackReason;
  latencyMs: number;
  rawLlmOutput: string | null;
  adjustments: string[];
}

/**
 * Grounding guard: resets LLM-inferred fields that the user query
 * doesn't actually mention, preventing hallucinated constraints.
 */
function applyGroundingGuard(
  intent: Intent,
  query: string
): { corrected: Intent; adjustments: string[] } {
  const adjustments: string[] = [];
  const corrected = { ...intent };

  if (!DIET_KEYWORDS.test(query) && corrected.diet !== "any") {
    adjustments.push(`diet reset from "${corrected.diet}" to "any"`);
    corrected.diet = "any";
  }

  if (!SPICE_KEYWORDS.test(query) && corrected.spice_level !== null) {
    adjustments.push(
      `spice_level reset from ${corrected.spice_level} to null`
    );
    corrected.spice_level = null;
  }

  if (!BUDGET_NUMBER_PATTERN.test(query) && corrected.budget_total !== null) {
    adjustments.push(
      `budget_total reset from ${corrected.budget_total} to null`
    );
    corrected.budget_total = null;
  }

  return { corrected, adjustments };
}

export async function extractIntent(query: string): Promise<ExtractResult> {
  const startTime = performance.now();
  let rawLlmOutput: string | null = null;

  try {
    const provider = getProvider();
    rawLlmOutput = await provider.generateJson(SYSTEM_PROMPT, query);

    let cleaned = rawLlmOutput.trim();
    if (cleaned.startsWith("```")) {
      cleaned = cleaned
        .replace(/^```(?:json)?\s*/i, "")
        .replace(/\s*```$/i, "")
        .trim();
    }

    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      console.warn("LLM returned invalid JSON, using fallback:", cleaned);
      const fallbackIntent = extractFallbackIntent(query);
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        intent: fallbackIntent,
        usedFallback: true,
        fallbackReason: "invalid_json",
        latencyMs,
        rawLlmOutput,
        adjustments: [],
      };
    }

    const result = intentSchema.safeParse(parsed);

    if (result.success) {
      const { corrected, adjustments } = applyGroundingGuard(
        result.data,
        query
      );
      const latencyMs = Math.round(performance.now() - startTime);
      return {
        intent: corrected,
        usedFallback: false,
        fallbackReason: null,
        latencyMs,
        rawLlmOutput,
        adjustments,
      };
    }

    console.warn(
      "Intent Zod validation failed, using fallback:",
      result.error
    );
    const fallbackIntent = extractFallbackIntent(query);
    const latencyMs = Math.round(performance.now() - startTime);
    return {
      intent: fallbackIntent,
      usedFallback: true,
      fallbackReason: "schema_validation",
      latencyMs,
      rawLlmOutput,
      adjustments: [],
    };
  } catch (error) {
    const isTimeout =
      error instanceof Error &&
      (error.name === "AbortError" || error.message.includes("abort"));

    console.warn(
      `LLM extraction failed (${isTimeout ? "timeout" : "provider_error"}), using fallback:`,
      error
    );

    const fallbackIntent = extractFallbackIntent(query);
    const latencyMs = Math.round(performance.now() - startTime);

    return {
      intent: fallbackIntent,
      usedFallback: true,
      fallbackReason: isTimeout ? "timeout" : "provider_error",
      latencyMs,
      rawLlmOutput,
      adjustments: [],
    };
  }
}
