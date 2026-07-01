import { z } from "zod";

export const addTemplateItemSchema = z.object({
  label: z.string().min(1).max(300),
  sortOrder: z.number().int().min(0).optional(),
  isRequired: z.boolean().optional(),
});

export type AddTemplateItemDto = z.infer<typeof addTemplateItemSchema>;
