import { z } from "zod";

export const submitAvailabilitySchema = z.object({
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "date must be YYYY-MM-DD"),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "LATE", "LEAVE_EARLY", "MAYBE"]),
  note: z.string().max(500).optional(),
  recurrenceRule: z.string().max(500).optional(),
  isHolidayMode: z.boolean().optional(),
});

export type SubmitAvailabilityDto = z.infer<typeof submitAvailabilitySchema>;
