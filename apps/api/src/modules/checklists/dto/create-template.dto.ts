import { z } from "zod";

export const createTemplateSchema = z.object({
  kind: z.enum(["SETUP", "SERVICE", "EMERGENCY", "SHUTDOWN", "DERIG"]),
  name: z.string().min(1).max(200),
});

export type CreateTemplateDto = z.infer<typeof createTemplateSchema>;
