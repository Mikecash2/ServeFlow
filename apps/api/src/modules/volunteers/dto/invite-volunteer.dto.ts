import { z } from "zod";

export const inviteVolunteerSchema = z.object({
  email: z.string().email(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  phone: z.string().max(30).optional(),
});

export type InviteVolunteerDto = z.infer<typeof inviteVolunteerSchema>;
