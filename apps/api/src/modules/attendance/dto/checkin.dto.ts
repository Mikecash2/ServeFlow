import { z } from "zod";

export const checkInSchema = z.object({
  volunteerProfileId: z.string().min(1),
  method: z.enum(["QR_CODE", "MANUAL", "GPS"]),
  gpsLat: z.number().min(-90).max(90).optional(),
  gpsLng: z.number().min(-180).max(180).optional(),
});

export type CheckInDto = z.infer<typeof checkInSchema>;
