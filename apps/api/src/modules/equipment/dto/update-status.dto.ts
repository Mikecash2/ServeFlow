import { z } from "zod";

export const updateEquipmentStatusSchema = z.object({
  status: z.enum(["AVAILABLE", "IN_USE", "UNDER_MAINTENANCE", "RETIRED"]),
});

export type UpdateEquipmentStatusDto = z.infer<typeof updateEquipmentStatusSchema>;
