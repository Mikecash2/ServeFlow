import { z } from "zod";

export const reportFaultSchema = z.object({
  severity: z.enum(["LOW", "MEDIUM", "HIGH", "CRITICAL"]),
  description: z.string().min(1).max(1000),
});

export type ReportFaultDto = z.infer<typeof reportFaultSchema>;
