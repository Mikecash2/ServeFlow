import { z } from "zod";

export const serviceTypeSchema = z.enum([
  "SUNDAY_SERVICE", "WEDNESDAY_SERVICE", "PRAYER_MEETING",
  "CONFERENCE", "WEDDING", "FUNERAL", "SPECIAL_EVENT",
]);

export const createServiceSchema = z.object({
  campusId: z.string().min(1),
  type: serviceTypeSchema,
  title: z.string().min(1).max(200),
  venue: z.string().max(200).optional(),
  date: z.string().datetime(),
  setupStart: z.string().datetime().optional(),
  soundcheck: z.string().datetime().optional(),
  doorsOpen: z.string().datetime().optional(),
  serviceStart: z.string().datetime(),
  serviceEnd: z.string().datetime().optional(),
  derigEnd: z.string().datetime().optional(),
  expectedAttendance: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  guestSpeaker: z.string().max(200).optional(),
  recurrenceRule: z.string().max(500).optional(),
});

export type CreateServiceDto = z.infer<typeof createServiceSchema>;
