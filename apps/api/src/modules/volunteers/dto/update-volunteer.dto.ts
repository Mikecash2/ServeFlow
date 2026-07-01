import { z } from "zod";

export const updateVolunteerSchema = z.object({
  emergencyContactName: z.string().max(200).optional(),
  emergencyContactPhone: z.string().max(30).optional(),
  notes: z.string().max(2000).optional(),
});

export type UpdateVolunteerDto = z.infer<typeof updateVolunteerSchema>;
