import { z } from "zod";

export const updateBatterySchema = z.object({
  batteryLevelPct: z.number().int().min(0).max(100),
});

export type UpdateBatteryDto = z.infer<typeof updateBatterySchema>;
