import { z } from "zod";

export const createServiceRoleSchema = z.object({
  ministryId: z.string().min(1),
  name: z.string().min(1).max(200),
  minRequired: z.number().int().min(0).max(50).optional(),
  maxAllowed: z.number().int().min(1).max(50).optional(),
});

export type CreateServiceRoleDto = z.infer<typeof createServiceRoleSchema>;
