import { z } from "zod";

export const updateServiceRoleSchema = z.object({
  name: z.string().min(1).max(200).optional(),
  minRequired: z.number().int().min(0).max(50).optional(),
  maxAllowed: z.number().int().min(1).max(50).optional(),
});

export type UpdateServiceRoleDto = z.infer<typeof updateServiceRoleSchema>;
