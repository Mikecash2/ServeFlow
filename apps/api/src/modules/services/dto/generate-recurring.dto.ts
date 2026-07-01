import { z } from "zod";

export const generateRecurringSchema = z.object({
  count: z.number().int().min(1).max(26),
});

export type GenerateRecurringDto = z.infer<typeof generateRecurringSchema>;
