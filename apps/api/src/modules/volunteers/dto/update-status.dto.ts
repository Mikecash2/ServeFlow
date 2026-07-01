import { z } from "zod";

export const updateStatusSchema = z.object({
  status: z.enum(["ACTIVE", "INACTIVE", "SUSPENDED"]),
});

export type UpdateStatusDto = z.infer<typeof updateStatusSchema>;
