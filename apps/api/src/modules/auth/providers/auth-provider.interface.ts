/**
 * Abstraction over "how do we verify a user's identity." Phase 1 ships
 * LocalAuthProvider (email/password + argon2, JWTs issued by this API).
 * Swapping to Supabase Auth or Clerk later means implementing this interface
 * and changing one binding in auth.module.ts — no call sites elsewhere in
 * the app reference password hashing or token issuance directly.
 */
export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
}

export interface AuthProvider {
  registerUser(input: RegisterInput): Promise<{ userId: string }>;
  verifyCredentials(email: string, password: string): Promise<{ userId: string } | null>;
}

export const AUTH_PROVIDER = Symbol("AUTH_PROVIDER");
