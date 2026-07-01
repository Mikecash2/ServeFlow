import { z } from "zod";

export const overrideAssignmentSchema = z.object({
  volunteerProfileId: z.string().min(1),
});

export type OverrideAssignmentDto = z.infer<typeof overrideAssignmentSchema>;
