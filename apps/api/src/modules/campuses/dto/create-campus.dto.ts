import { z } from "zod";

export const createCampusSchema = z.object({
  name: z.string().min(1).max(200),
  address: z.string().max(500).optional(),
  timezone: z.string().max(100).optional(),
  isPrimary: z.boolean().optional(),
});

export type CreateCampusDto = z.infer<typeof createCampusSchema>;
