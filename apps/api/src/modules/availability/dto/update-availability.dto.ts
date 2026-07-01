import { z } from "zod";

export const updateAvailabilitySchema = z.object({
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "LATE", "LEAVE_EARLY", "MAYBE"]).optional(),
  note: z.string().max(500).optional(),
});

export type UpdateAvailabilityDto = z.infer<typeof updateAvailabilitySchema>;
