import { z } from "zod";

export const submitRecurringAvailabilitySchema = z.object({
  recurrenceRule: z.string().min(1).max(500),
  status: z.enum(["AVAILABLE", "UNAVAILABLE", "LATE", "LEAVE_EARLY", "MAYBE"]),
  from: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "from must be YYYY-MM-DD"),
  to: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "to must be YYYY-MM-DD"),
  note: z.string().max(500).optional(),
});

export type SubmitRecurringAvailabilityDto = z.infer<typeof submitRecurringAvailabilitySchema>;
