import { z } from "zod";

export const dietSchema = z.enum(["veg", "vegan", "non-veg", "any"]);
export type Diet = z.infer<typeof dietSchema>;

export const intentSchema = z.object({
  diet: dietSchema.default("any"),
  spice_level: z
    .number()
    .int()
    .min(0)
    .max(3)
    .nullable()
    .default(null),
  budget_total: z
    .number()
    .positive()
    .nullable()
    .default(null),
  party_size: z
    .number()
    .int()
    .min(1)
    .default(1),
  exclusions: z
    .array(z.string())
    .default([]),
  cuisine: z
    .string()
    .nullable()
    .default(null),
});

export type Intent = z.infer<typeof intentSchema>;
