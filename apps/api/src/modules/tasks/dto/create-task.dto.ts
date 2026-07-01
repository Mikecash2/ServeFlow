import { z } from "zod";

export const createTaskSchema = z.object({
  phase: z.enum(["SETUP", "SERVICE", "DERIG"]),
  title: z.string().min(1).max(200),
  description: z.string().max(2000).optional(),
  priority: z.number().int().min(1).max(5).optional(),
  estimatedMinutes: z.number().int().min(0).max(1000).optional(),
  dependsOnTaskId: z.string().optional(),
});

export type CreateTaskDto = z.infer<typeof createTaskSchema>;
