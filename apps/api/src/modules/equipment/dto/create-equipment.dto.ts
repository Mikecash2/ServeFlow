import { z } from "zod";

export const createEquipmentSchema = z.object({
  name: z.string().min(1).max(200),
  category: z.string().min(1).max(100),
  campusId: z.string().optional(),
  storageLocation: z.string().max(200).optional(),
  batteryLevelPct: z.number().int().min(0).max(100).optional(),
  warrantyExpiresAt: z.string().datetime().optional(),
  purchasedAt: z.string().datetime().optional(),
});

export type CreateEquipmentDto = z.infer<typeof createEquipmentSchema>;
