import fs from "node:fs";
import path from "node:path";
import { z } from "zod";

export const evalQuerySchema = z.object({
  id: z.number().int(),
  split: z.enum(["dev", "test"]),
  category: z.string(),
  query: z.string().min(1),
  expected: z.object({
    diet: z.enum(["veg", "vegan", "non-veg", "any"]),
    spice_level: z.union([
      z.literal(0),
      z.literal(1),
      z.literal(2),
      z.literal(3),
      z.null(),
    ]),
    budget_total: z.number().positive().nullable(),
    party_size: z.number().int().positive(),
    exclusions: z.array(z.string()),
    cuisine: z.string().nullable(),
  }),
});

export const queriesListSchema = z.array(evalQuerySchema);

export type EvalQuery = z.infer<typeof evalQuerySchema>;

export function loadEvalQueries(filePath?: string): EvalQuery[] {
  const resolvedPath =
    filePath || path.resolve(process.cwd(), "scripts/eval/queries.json");

  if (!fs.existsSync(resolvedPath)) {
    throw new Error(`Evaluation queries file not found at: ${resolvedPath}`);
  }

  let rawContent: string;
  try {
    rawContent = fs.readFileSync(resolvedPath, "utf-8");
  } catch (err) {
    throw new Error(
      `Failed to read evaluation queries file at ${resolvedPath}: ${
        (err as Error).message
      }`
    );
  }

  let parsedJson: unknown;
  try {
    parsedJson = JSON.parse(rawContent);
  } catch (err) {
    throw new Error(
      `Invalid JSON in evaluation queries file (${resolvedPath}): ${
        (err as Error).message
      }`
    );
  }

  const result = queriesListSchema.safeParse(parsedJson);
  if (!result.success) {
    const formattedErrors = result.error.issues
      .map((e) => `  - at path [${e.path.join(".")}]: ${e.message}`)
      .join("\n");
    throw new Error(
      `Evaluation queries file validation failed (${resolvedPath}):\n${formattedErrors}`
    );
  }

  return result.data;
}
