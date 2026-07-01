import { z } from "zod";

export const ministryCategorySchema = z.enum([
  "MEDIA", "PRODUCTION", "WORSHIP", "HOSPITALITY", "CHILDREN",
  "SECURITY", "USHERING", "PRAYER", "CLEANING", "CUSTOM",
]);

export const createMinistrySchema = z.object({
  name: z.string().min(1).max(200),
  category: ministryCategorySchema,
  campusId: z.string().optional(),
  description: z.string().max(1000).optional(),
});

export type CreateMinistryDto = z.infer<typeof createMinistrySchema>;
