import { z } from "zod";

export const instantiateChecklistSchema = z.object({
  templateId: z.string().min(1),
});

export type InstantiateChecklistDto = z.infer<typeof instantiateChecklistSchema>;
