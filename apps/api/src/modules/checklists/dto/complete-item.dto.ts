import { z } from "zod";

export const completeItemSchema = z.object({
  note: z.string().max(500).optional(),
  photoUrl: z.string().url().optional(),
});

export type CompleteItemDto = z.infer<typeof completeItemSchema>;
