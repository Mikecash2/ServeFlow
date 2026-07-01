import { z } from "zod";

export const createTeamSchema = z.object({
  name: z.string().min(1).max(200),
});

export type CreateTeamDto = z.infer<typeof createTeamSchema>;
