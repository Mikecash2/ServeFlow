import { z } from "zod";

export const reserveEquipmentSchema = z.object({
  serviceId: z.string().optional(),
  reservedFrom: z.string().datetime(),
  reservedTo: z.string().datetime(),
});

export type ReserveEquipmentDto = z.infer<typeof reserveEquipmentSchema>;
