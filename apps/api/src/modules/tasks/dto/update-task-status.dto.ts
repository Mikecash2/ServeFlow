import { z } from "zod";

export const updateTaskStatusSchema = z.object({
  status: z.enum(["NOT_STARTED", "IN_PROGRESS", "BLOCKED", "COMPLETED"]),
  assignedVolunteerId: z.string().optional(),
});

export type UpdateTaskStatusDto = z.infer<typeof updateTaskStatusSchema>;
