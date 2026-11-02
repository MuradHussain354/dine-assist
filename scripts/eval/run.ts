import fs from "node:fs";
import path from "node:path";
import { loadEvalQueries, EvalQuery } from "./loader";
import {
  RawQueryOutput,
  ConfigId,
  evaluateQueryUnderConfig,
  aggregateMetrics,
  aggregateByCategory,
  ScoredQuery,
} from "./scoring";
import { OllamaProvider } from "../../src/lib/llm/ollama";
import { executeLlmCall } from "../../src/lib/intent/extract";
import { Intent } from "../../src/lib/intent/schema";

interface CliOptions {
  model: string;
  refresh: boolean;
  split: "dev" | "test" | "all";
  failures: boolean;
  tag?: string;
  queriesPath?: string;
}

function parseCliArgs(): CliOptions {
  const args = process.argv.slice(2);
  let model = process.env.OLLAMA_MODEL || "llama3.2:3b";
  let refresh = false;
  let split: "dev" | "test" | "all" = "all";
  let failures = false;
  let tag: string | undefined = undefined;
  let queriesPath: string | undefined = undefined;

  for (let i = 0; i < args.length; i++) {
    const arg = args[i];
    if (arg === "--model" && i + 1 < args.length) {
      model = args[++i];
    } else if (arg.startsWith("--model=")) {
      model = arg.split("=")[1];
    } else if (arg === "--refresh") {
      refresh = true;
    } else if (arg === "--failures") {
      failures = true;
    } else if (arg === "--tag" && i + 1 < args.length) {
      tag = args[++i];
    } else if (arg.startsWith("--tag=")) {
      tag = arg.split("=")[1];
    } else if (arg === "--queries" && i + 1 < args.length) {
      queriesPath = args[++i];
    } else if (arg.startsWith("--queries=")) {
      queriesPath = arg.split("=")[1];
    } else if (arg === "--split" && i + 1 < args.length) {
      const val = args[++i].toLowerCase();
      if (val === "dev" || val === "test" || val === "all") {
        split = val;
      }
    } else if (arg.startsWith("--split=")) {
      const val = arg.split("=")[1].toLowerCase();
      if (val === "dev" || val === "test" || val === "all") {
        split = val;
      }
    }
  }

  return { model, refresh, split, failures, tag, queriesPath };
}

function formatDuration(ms: number): string {
  const sec = Math.ceil(ms / 1000);
  if (sec < 60) return `${sec}s`;
  const min = Math.floor(sec / 60);
  const remSec = sec % 60;
  return `${min}m ${remSec}s`;
}

function getTodayString(): string {
  const now = new Date();
  const yyyy = now.getFullYear();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  return `${yyyy}-${mm}-${dd}`;
}

function formatFieldValue(val: unknown): string {
  if (val === null || val === undefined) return "null";
  if (typeof val === "string") return JSON.stringify(val);
  if (Array.isArray(val)) return JSON.stringify(val);
  return String(val);
}

function formatDifferences(
  expected: EvalQuery["expected"],
  got: Intent | null,
  fieldMatches: ScoredQuery["fieldMatches"]
): string {
  const fields: Array<keyof Intent> = [
    "diet",
    "spice_level",
    "budget_total",
    "party_size",
    "exclusions",
    "cuisine",
  ];

  const diffs: string[] = [];
  for (const f of fields) {
    if (!fieldMatches[f]) {
      const expStr = formatFieldValue(expected[f]);
      const gotStr = formatFieldValue(got ? got[f] : null);
      diffs.push(`${f}: expected ${expStr}, got ${gotStr}`);
    }
  }

  return diffs.join("; ");
}

function buildFailuresTable(failures: ScoredQuery[]): string {
  if (failures.length === 0) {
    return "## Failed Queries (Full Pipeline - Config c)\n\nNo failures found.";
  }

  const lines: string[] = [
    "## Failed Queries (Full Pipeline - Config c)",
    "| ID | Split | Category | Query | Differing Fields (Expected vs Got) |",
    "| :--- | :--- | :--- | :--- | :--- |",
  ];

  for (const s of failures) {
    const cleanQuery = s.query.replace(/\|/g, "\\|").replace(/\r?\n/g, " ");
    const diffs = formatDifferences(s.expected, s.got, s.fieldMatches);
    lines.push(
      `| ${s.id} | ${s.split} | ${s.category} | ${cleanQuery} | ${diffs} |`
    );
  }

  return lines.join("\n");
}

async function main() {
  const options = parseCliArgs();
  const resolvedQueriesPath = options.queriesPath
    ? path.resolve(process.cwd(), options.queriesPath)
    : undefined;
  const queries = loadEvalQueries(resolvedQueriesPath);
  const sanitizedModel = options.model.replace(/:/g, "-");

  const resultsDir = path.resolve(process.cwd(), "eval-results");
  if (!fs.existsSync(resultsDir)) {
    fs.mkdirSync(resultsDir, { recursive: true });
  }

  const rawCachePath = path.join(
    resultsDir,
    `raw-${sanitizedModel}.json`
  );

  // Load existing raw cache if present (unless --refresh)
  const cachedMap = new Map<number, RawQueryOutput>();
  if (!options.refresh && fs.existsSync(rawCachePath)) {
    try {
      const cacheRaw = fs.readFileSync(rawCachePath, "utf-8");
      const parsed: RawQueryOutput[] = JSON.parse(cacheRaw);
      for (const item of parsed) {
        cachedMap.set(item.id, item);
      }
      console.log(
        `Loaded ${cachedMap.size} cached responses from ${rawCachePath}`
      );
    } catch {
      // Ignore unparseable cache
    }
  }

  const timeoutMs = process.env.OLLAMA_TIMEOUT_MS
    ? parseInt(process.env.OLLAMA_TIMEOUT_MS, 10)
    : 90000;

  const provider = new OllamaProvider(
    process.env.OLLAMA_URL || "http://localhost:11434",
    options.model,
    timeoutMs
  );

  // If there are queries that need calling
  const uncompleted = queries.filter((q) => !cachedMap.has(q.id));

  if (uncompleted.length > 0) {
    console.log(`Executing LLM extraction with model: "${options.model}"`);
    console.log(
      `Queries to execute: ${uncompleted.length} (out of ${queries.length} total)`
    );

    // Warm-up call
    console.log("Sending warm-up request to Ollama...");
    const warmUpStart = performance.now();
    try {
      await provider.generateJson(
        "You are an assistant. Return JSON only.",
        "Warm up check"
      );
      const warmUpMs = Math.round(performance.now() - warmUpStart);
      console.log(`✓ Warm-up completed in ${warmUpMs}ms.`);
    } catch (err) {
      console.warn("⚠️ Warm-up request failed (proceeding):", err);
    }

    const startTime = performance.now();
    for (let i = 0; i < uncompleted.length; i++) {
      const q = uncompleted[i];
      const singleStart = performance.now();

      const res = await executeLlmCall(q.query, { provider });
      const durationMs = Math.round(performance.now() - singleStart);

      const queryOutput: RawQueryOutput = {
        id: q.id,
        query: q.query,
        rawLlmOutput: res.rawLlmOutput,
        latencyMs: res.latencyMs,
        error: res.error ? res.error.message : null,
        isTimeout: res.isTimeout,
      };

      cachedMap.set(q.id, queryOutput);

      // Incrementally persist to cache file
      const allCachedList = Array.from(cachedMap.values()).sort(
        (a, b) => a.id - b.id
      );
      fs.writeFileSync(
        rawCachePath,
        JSON.stringify(allCachedList, null, 2),
        "utf-8"
      );

      // Progress & ETA
      const elapsed = performance.now() - startTime;
      const avgMs = elapsed / (i + 1);
      const remainingMs = avgMs * (uncompleted.length - (i + 1));
      const truncated =
        q.query.length > 35 ? q.query.slice(0, 32) + "..." : q.query;

      console.log(
        `[${i + 1}/${uncompleted.length}] "${truncated}" ` +
          `(${durationMs}ms${res.isTimeout ? " - TIMEOUT" : ""}) | ` +
          `ETA: ${formatDuration(remainingMs)}`
      );
    }

    console.log(`\n✓ All raw outputs saved to: ${rawCachePath}\n`);
  } else {
    console.log(
      `✓ Reusing all ${queries.length} cached LLM outputs from: ${rawCachePath}\n`
    );
  }

  // Assemble all raw outputs in query order
  const rawOutputs: RawQueryOutput[] = [];
  for (const q of queries) {
    const item = cachedMap.get(q.id);
    if (item) rawOutputs.push(item);
  }

  // Score all 5 configurations for all queries
  const configs: ConfigId[] = [
    "llm_only",
    "llm_guard",
    "llm_guard_rules",
    "full_pipeline",
    "fallback_only",
  ];

  const allScored: Record<ConfigId, ScoredQuery[]> = {
    llm_only: [],
    llm_guard: [],
    llm_guard_rules: [],
    full_pipeline: [],
    fallback_only: [],
  };

  const allFailures: Array<{
    id: number;
    split: "dev" | "test";
    category: string;
    query: string;
    config: ConfigId;
    expected: EvalQuery["expected"];
    got: unknown;
    mismatches: string[];
  }> = [];

  for (const config of configs) {
    for (const q of queries) {
      const raw = cachedMap.get(q.id);
      const scored = evaluateQueryUnderConfig(q, raw, config);
      allScored[config].push(scored);

      if (!scored.isExactMatch) {
        const mismatches: string[] = [];
        if (!scored.fieldMatches.diet) mismatches.push("diet");
        if (!scored.fieldMatches.spice_level) mismatches.push("spice_level");
        if (!scored.fieldMatches.budget_total) mismatches.push("budget_total");
        if (!scored.fieldMatches.party_size) mismatches.push("party_size");
        if (!scored.fieldMatches.exclusions) mismatches.push("exclusions");
        if (!scored.fieldMatches.cuisine) mismatches.push("cuisine");

        allFailures.push({
          id: q.id,
          split: q.split,
          category: q.category,
          query: q.query,
          config,
          expected: q.expected,
          got: scored.got,
          mismatches,
        });
      }
    }
  }

  const devQueries = queries.filter((q) => q.split === "dev");
  const testQueries = queries.filter((q) => q.split === "test");

  const latencies = rawOutputs.map((r) => r.latencyMs);

  // Compute metrics per split & config
  const metricsDev: Record<ConfigId, ReturnType<typeof aggregateMetrics>> = {
    llm_only: aggregateMetrics(
      allScored.llm_only.filter((s) => s.split === "dev"),
      rawOutputs
        .filter((r) => devQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    llm_guard: aggregateMetrics(
      allScored.llm_guard.filter((s) => s.split === "dev"),
      rawOutputs
        .filter((r) => devQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    llm_guard_rules: aggregateMetrics(
      allScored.llm_guard_rules.filter((s) => s.split === "dev"),
      rawOutputs
        .filter((r) => devQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    full_pipeline: aggregateMetrics(
      allScored.full_pipeline.filter((s) => s.split === "dev"),
      rawOutputs
        .filter((r) => devQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    fallback_only: aggregateMetrics(
      allScored.fallback_only.filter((s) => s.split === "dev"),
      []
    ),
  };

  const metricsTest: Record<ConfigId, ReturnType<typeof aggregateMetrics>> = {
    llm_only: aggregateMetrics(
      allScored.llm_only.filter((s) => s.split === "test"),
      rawOutputs
        .filter((r) => testQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    llm_guard: aggregateMetrics(
      allScored.llm_guard.filter((s) => s.split === "test"),
      rawOutputs
        .filter((r) => testQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    llm_guard_rules: aggregateMetrics(
      allScored.llm_guard_rules.filter((s) => s.split === "test"),
      rawOutputs
        .filter((r) => testQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    full_pipeline: aggregateMetrics(
      allScored.full_pipeline.filter((s) => s.split === "test"),
      rawOutputs
        .filter((r) => testQueries.some((q) => q.id === r.id))
        .map((r) => r.latencyMs)
    ),
    fallback_only: aggregateMetrics(
      allScored.fallback_only.filter((s) => s.split === "test"),
      []
    ),
  };

  const metricsAll: Record<ConfigId, ReturnType<typeof aggregateMetrics>> = {
    llm_only: aggregateMetrics(allScored.llm_only, latencies),
    llm_guard: aggregateMetrics(allScored.llm_guard, latencies),
    llm_guard_rules: aggregateMetrics(allScored.llm_guard_rules, latencies),
    full_pipeline: aggregateMetrics(allScored.full_pipeline, latencies),
    fallback_only: aggregateMetrics(allScored.fallback_only, []),
  };

  const categoryMetricsConfigC = aggregateByCategory(allScored.full_pipeline);

  const configLabels: Record<ConfigId, string> = {
    llm_only: "LLM Only (a)",
    llm_guard: "LLM + Guard (b)",
    llm_guard_rules: "LLM + Guard + Rules (e)",
    full_pipeline: "Full Pipeline (c)",
    fallback_only: "Fallback Only (d)",
  };

  // Generate Markdown Tables
  const dateStr = getTodayString();
  const mdReportLines: string[] = [];

  mdReportLines.push(`# Evaluation Report: ${options.model}`);
  mdReportLines.push(`- **Date**: ${dateStr}`);
  mdReportLines.push(`- **Model**: \`${options.model}\``);
  if (options.tag) {
    mdReportLines.push(`- **Tag**: \`${options.tag}\``);
  }
  if (options.queriesPath) {
    mdReportLines.push(`- **Queries**: \`${options.queriesPath}\``);
  }
  mdReportLines.push(
    `- **Dataset**: ${queries.length} queries (${devQueries.length} dev, ${testQueries.length} test)`
  );
  mdReportLines.push(
    `- **LLM Latency**: Mean: ${metricsAll.llm_only.meanLatencyMs}ms | P95: ${metricsAll.llm_only.p95LatencyMs}ms`
  );
  mdReportLines.push(
    `- **JSON Validity Rate (Config a)**: ${metricsAll.llm_only.jsonValidityRate}%`
  );
  mdReportLines.push(
    `- **Fallback Rate (Config c)**: ${metricsAll.full_pipeline.fallbackRate}%`
  );
  mdReportLines.push("");

  // 1. Headline Table
  mdReportLines.push("## Headline: Exact-Match Rate by Configuration");
  mdReportLines.push(
    "| Configuration | Dev Exact Match | Test Exact Match | All Exact Match |"
  );
  mdReportLines.push("| :--- | :--- | :--- | :--- |");
  for (const c of configs) {
    const devRate = `${metricsDev[c].exactMatchRate}% (${metricsDev[c].exactMatchCount}/${devQueries.length})`;
    const testRate = `${metricsTest[c].exactMatchRate}% (${metricsTest[c].exactMatchCount}/${testQueries.length})`;
    const allRate = `${metricsAll[c].exactMatchRate}% (${metricsAll[c].exactMatchCount}/${queries.length})`;
    mdReportLines.push(
      `| ${configLabels[c]} | ${devRate} | ${testRate} | ${allRate} |`
    );
  }
  mdReportLines.push("");

  // 2. Per-Field Accuracy on Test Split
  mdReportLines.push("## Per-Field Accuracy on Test Split");
  mdReportLines.push(
    "| Configuration | Diet | Spice Level | Budget Total | Party Size | Exclusions | Cuisine | Exact Match |"
  );
  mdReportLines.push(
    "| :--- | :--- | :--- | :--- | :--- | :--- | :--- | :--- |"
  );
  for (const c of configs) {
    const m = metricsTest[c];
    mdReportLines.push(
      `| ${configLabels[c]} | ${m.dietAccuracy}% | ${m.spiceAccuracy}% | ${m.budgetAccuracy}% | ${m.partyAccuracy}% | ${m.exclusionsAccuracy}% | ${m.cuisineAccuracy}% | **${m.exactMatchRate}%** |`
    );
  }
  mdReportLines.push("");

  // 3. Exact Match by Category for Full Pipeline (c)
  mdReportLines.push("## Exact-Match by Category (Full Pipeline - Config c)");
  mdReportLines.push(
    "| Category | Dev Matches | Test Matches | Total Queries | Exact Match Rate |"
  );
  mdReportLines.push("| :--- | :--- | :--- | :--- | :--- |");
  for (const cat of categoryMetricsConfigC) {
    mdReportLines.push(
      `| ${cat.category} | ${cat.devMatches}/${cat.devTotal} | ${cat.testMatches}/${cat.testTotal} | ${cat.total} | **${cat.exactMatchRate}%** |`
    );
  }
  mdReportLines.push("");

  // 4. Compact failure table for Configuration (c) if --failures flag is passed
  if (options.failures) {
    const pipelineFailures = allScored.full_pipeline.filter((s) => {
      if (s.isExactMatch) return false;
      if (options.split !== "all" && s.split !== options.split) return false;
      return true;
    });

    mdReportLines.push(buildFailuresTable(pipelineFailures));
    mdReportLines.push("");
  }

  const mdReport = mdReportLines.join("\n");

  // Write markdown report
  const fileSuffix = options.tag ? `-${options.tag}` : "";
  const reportPath = path.join(
    resultsDir,
    `${sanitizedModel}-${dateStr}${fileSuffix}.md`
  );
  fs.writeFileSync(reportPath, mdReport, "utf-8");

  // Write failures json
  const failuresPath = path.join(
    resultsDir,
    `${sanitizedModel}-${dateStr}${fileSuffix}-failures.json`
  );
  fs.writeFileSync(failuresPath, JSON.stringify(allFailures, null, 2), "utf-8");

  // Print results to stdout
  console.log("\n" + mdReport);
  console.log(`\nReport written to: ${reportPath}`);
  console.log(`Failures logged to: ${failuresPath}`);
}

main().catch((err) => {
  console.error("Evaluation harness error:", err);
  process.exit(1);
});
