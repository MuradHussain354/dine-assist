import { z } from "zod";

export const dietTagEnum = z.enum(["veg", "vegan", "non-veg"]);
export type DietTag = z.infer<typeof dietTagEnum>;

export const categoryEnum = z.enum([
  "starter",
  "main",
  "side",
  "dessert",
  "drink",
]);
export type Category = z.infer<typeof categoryEnum>;

const dietTagsValidation = z
  .array(dietTagEnum)
  .min(1, "At least one diet tag is required")
  .refine(
    (tags) => {
      if (tags.includes("vegan")) {
        return tags.includes("veg");
      }
      return true;
    },
    {
      message: 'Vegan items must also include "veg"',
    }
  );

export const createMenuItemSchema = z.object({
  name: z.string().trim().min(1, "Name is required"),
  description: z.string().trim().default(""),
  price: z.number().int("Price must be an integer").positive("Price must be a positive integer"),
  category: categoryEnum,
  spiceLevel: z
    .number()
    .int("Spice level must be an integer")
    .min(0, "Spice level must be at least 0")
    .max(3, "Spice level must be at most 3"),
  dietTags: dietTagsValidation,
  cuisine: z.string().trim().min(1, "Cuisine is required"),
  isAvailable: z.boolean().default(true),
});

export const updateMenuItemSchema = createMenuItemSchema.extend({
  id: z.string().min(1, "Menu item ID is required"),
});

export const toggleAvailabilitySchema = z.object({
  id: z.string().min(1, "Menu item ID is required"),
  isAvailable: z.boolean().optional(),
});

export const deleteMenuItemSchema = z.object({
  id: z.string().min(1, "Menu item ID is required"),
});

export type CreateMenuItemInput = z.infer<typeof createMenuItemSchema>;
export type UpdateMenuItemInput = z.infer<typeof updateMenuItemSchema>;
export type ToggleAvailabilityInput = z.infer<typeof toggleAvailabilitySchema>;

