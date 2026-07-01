import { z } from "zod";

export const updateChurchSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  timezone: z.string().min(1).max(100).optional(),
  primaryColor: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional(),
  logoUrl: z.string().url().optional(),
});

export type UpdateChurchDto = z.infer<typeof updateChurchSchema>;
