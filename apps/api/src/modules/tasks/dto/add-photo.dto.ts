import { z } from "zod";

export const addPhotoSchema = z.object({
  photoUrl: z.string().url(),
});

export type AddPhotoDto = z.infer<typeof addPhotoSchema>;
