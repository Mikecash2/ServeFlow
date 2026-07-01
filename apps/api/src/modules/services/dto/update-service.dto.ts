import { z } from "zod";

export const updateServiceSchema = z.object({
  title: z.string().min(1).max(200).optional(),
  venue: z.string().max(200).optional(),
  setupStart: z.string().datetime().optional(),
  soundcheck: z.string().datetime().optional(),
  doorsOpen: z.string().datetime().optional(),
  serviceStart: z.string().datetime().optional(),
  serviceEnd: z.string().datetime().optional(),
  derigEnd: z.string().datetime().optional(),
  expectedAttendance: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
  guestSpeaker: z.string().max(200).optional(),
});

export type UpdateServiceDto = z.infer<typeof updateServiceSchema>;
