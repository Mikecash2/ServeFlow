import { z } from "zod";

export const addTrainingSchema = z.object({
  courseName: z.string().min(1).max(200),
  completedAt: z.string().datetime().optional(),
  requiredForRoles: z.array(z.string()).optional(),
});

export type AddTrainingDto = z.infer<typeof addTrainingSchema>;
