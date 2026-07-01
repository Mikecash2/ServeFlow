import { z } from "zod";

export const addPreferredRoleSchema = z.object({
  roleName: z.string().min(1).max(200),
});

export type AddPreferredRoleDto = z.infer<typeof addPreferredRoleSchema>;
