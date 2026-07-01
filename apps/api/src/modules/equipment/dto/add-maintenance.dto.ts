import { z } from "zod";

export const addMaintenanceSchema = z.object({
  performedAt: z.string().datetime(),
  description: z.string().min(1).max(1000),
  cost: z.number().min(0).optional(),
  performedBy: z.string().max(200).optional(),
});

export type AddMaintenanceDto = z.infer<typeof addMaintenanceSchema>;
