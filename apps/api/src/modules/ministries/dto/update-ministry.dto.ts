import { z } from "zod";

export const updateMinistrySchema = z.object({
  name: z.string().min(1).max(200).optional(),
  description: z.string().max(1000).optional(),
  campusId: z.string().optional(),
});

export type UpdateMinistryDto = z.infer<typeof updateMinistrySchema>;
