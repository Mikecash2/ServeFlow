import { z } from "zod";

export const addSkillSchema = z.object({
  skillName: z.string().min(1).max(100),
  experienceLevel: z.number().int().min(1).max(5),
  yearsExperience: z.number().min(0).max(80).optional(),
});

export type AddSkillDto = z.infer<typeof addSkillSchema>;
