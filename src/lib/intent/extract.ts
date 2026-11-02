import { getProvider, LLMProvider } from "../llm";
import { intentSchema, Intent } from "./schema";
import { SYSTEM_PROMPT } from "./prompt";
import {
  extractFallbackIntent,
  DIET_KEYWORDS,
  SPICE_KEYWORDS,
  BUDGET_NUMBER_PATTERN,
  BUDGET_NUMBER_WORD_PATTERN,
  K_AMOUNT_PATTERN,
} from "./fallback";
import { applyPostProcessingRules } from "./postprocess";

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
export function applyGroundingGuard(
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

  const hasBudgetEvidence =
    BUDGET_NUMBER_PATTERN.test(query) ||
    BUDGET_NUMBER_WORD_PATTERN.test(query) ||
    K_AMOUNT_PATTERN.test(query);

  if (!hasBudgetEvidence && corrected.budget_total !== null) {
    adjustments.push(
      `budget_total reset from ${corrected.budget_total} to null`
    );
    corrected.budget_total = null;
  }

  return { corrected, adjustments };
}

/**
 * Stage A helper: Strip code fences, parse JSON, and validate against intentSchema.
 */
export type ParseLlmResult =
  | { success: true; data: Intent; parsed: unknown }
  | {
      success: false;
      reason: "invalid_json" | "schema_validation";
      error: unknown;
      raw: string;
    };

export function parseAndValidateLlmOutput(rawOutput: string): ParseLlmResult {
  let cleaned = rawOutput.trim();
  if (cleaned.startsWith("```")) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, "")
      .replace(/\s*```$/i, "")
      .trim();
  }

  let parsed: unknown;
  try {
    parsed = JSON.parse(cleaned);
  } catch (err) {
    return {
      success: false,
      reason: "invalid_json",
      error: err,
      raw: cleaned,
    };
  }

  const result = intentSchema.safeParse(parsed);
  if (!result.success) {
    return {
      success: false,
      reason: "schema_validation",
      error: result.error,
      raw: cleaned,
    };
  }

  return { success: true, data: result.data, parsed };
}

/**
 * Stage LLM Call helper: executes the raw LLM call with timing and error handling.
 */
export interface CallLlmResult {
  rawLlmOutput: string | null;
  latencyMs: number;
  error: Error | null;
  isTimeout: boolean;
}

export async function executeLlmCall(
  query: string,
  options?: { provider?: LLMProvider; systemPrompt?: string }
): Promise<CallLlmResult> {
  const startTime = performance.now();
  const provider = options?.provider ?? getProvider();
  const systemPrompt = options?.systemPrompt ?? SYSTEM_PROMPT;

  try {
    const rawLlmOutput = await provider.generateJson(systemPrompt, query);
    const latencyMs = Math.round(performance.now() - startTime);
    return { rawLlmOutput, latencyMs, error: null, isTimeout: false };
  } catch (err) {
    const latencyMs = Math.round(performance.now() - startTime);
    const isTimeout =
      err instanceof Error &&
      (err.name === "AbortError" || err.message.includes("abort"));
    return {
      rawLlmOutput: null,
      latencyMs,
      error: err instanceof Error ? err : new Error(String(err)),
      isTimeout,
    };
  }
}

export async function extractIntent(query: string): Promise<ExtractResult> {
  const llmRes = await executeLlmCall(query);

  if (llmRes.error || llmRes.rawLlmOutput === null) {
    const fallbackIntent = extractFallbackIntent(query);
    return {
      intent: fallbackIntent,
      usedFallback: true,
      fallbackReason: llmRes.isTimeout ? "timeout" : "provider_error",
      latencyMs: llmRes.latencyMs,
      rawLlmOutput: null,
      adjustments: [],
    };
  }

  const parseResult = parseAndValidateLlmOutput(llmRes.rawLlmOutput);

  if (!parseResult.success) {
    if (parseResult.reason === "invalid_json") {
      console.warn(
        "LLM returned invalid JSON, using fallback:",
        parseResult.raw
      );
    } else {
      console.warn(
        "Intent Zod validation failed, using fallback:",
        parseResult.error
      );
    }
    const fallbackIntent = extractFallbackIntent(query);
    return {
      intent: fallbackIntent,
      usedFallback: true,
      fallbackReason: parseResult.reason,
      latencyMs: llmRes.latencyMs,
      rawLlmOutput: llmRes.rawLlmOutput,
      adjustments: [],
    };
  }

  const { corrected, adjustments: guardAdjustments } = applyGroundingGuard(
    parseResult.data,
    query
  );

  const { processed, adjustments: ruleAdjustments } = applyPostProcessingRules(
    corrected,
    query
  );

  return {
    intent: processed,
    usedFallback: false,
    fallbackReason: null,
    latencyMs: llmRes.latencyMs,
    rawLlmOutput: llmRes.rawLlmOutput,
    adjustments: [...guardAdjustments, ...ruleAdjustments],
  };
}

export { extractFallbackIntent, applyPostProcessingRules };
