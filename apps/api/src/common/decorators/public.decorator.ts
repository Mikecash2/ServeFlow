import { SetMetadata } from "@nestjs/common";

export const IS_PUBLIC_KEY = "isPublic";

/** Marks a route as not requiring JwtAuthGuard — used only for /auth/* endpoints. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
