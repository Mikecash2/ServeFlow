import { z } from "zod";

export const addCertificationSchema = z.object({
  name: z.string().min(1).max(200),
  issuedAt: z.string().datetime().optional(),
  expiresAt: z.string().datetime().optional(),
  documentUrl: z.string().url().optional(),
});

export type AddCertificationDto = z.infer<typeof addCertificationSchema>;
