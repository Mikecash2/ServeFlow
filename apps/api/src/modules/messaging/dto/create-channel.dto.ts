import { z } from "zod";

export const createChannelSchema = z.object({
  type: z.enum(["ANNOUNCEMENT", "TEAM_CHAT"]),
  ministryId: z.string().optional(),
  name: z.string().max(200).optional(),
});

export type CreateChannelDto = z.infer<typeof createChannelSchema>;
