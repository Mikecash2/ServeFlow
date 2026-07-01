import { z } from "zod";

export const registerSchema = z.object({
  email: z.string().email(),
  password: z
    .string()
    .min(10, "Password must be at least 10 characters")
    .regex(/[A-Z]/, "Password must contain an uppercase letter")
    .regex(/[0-9]/, "Password must contain a number"),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  churchName: z.string().min(1).max(200),
  timezone: z.string().min(1).max(100).optional(),
});

export type RegisterDto = z.infer<typeof registerSchema>;
