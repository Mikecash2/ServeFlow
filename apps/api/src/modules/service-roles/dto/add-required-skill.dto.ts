import { z } from "zod";

export const addRequiredSkillSchema = z.object({
  skillName: z.string().min(1).max(100),
  minExperienceLevel: z.number().int().min(1).max(5),
});

export type AddRequiredSkillDto = z.infer<typeof addRequiredSkillSchema>;
