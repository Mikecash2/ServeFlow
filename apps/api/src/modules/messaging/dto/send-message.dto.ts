import { z } from "zod";

export const sendMessageSchema = z.object({
  body: z.string().min(1).max(4000),
  mentionUserIds: z.array(z.string()).optional(),
  attachmentUrls: z.array(z.string().url()).optional(),
});

export type SendMessageDto = z.infer<typeof sendMessageSchema>;
