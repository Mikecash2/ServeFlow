/**
 * Thin fetch wrapper over the ServeFlow API. Access tokens are kept in
 * memory (React state) for now, not localStorage — see docs/06-design-system.md
 * and the artifact rules this repo follows elsewhere: avoid persisting
 * sensitive tokens in browser storage. A production build should move to
 * httpOnly refresh cookies; this is a Phase 1 placeholder documented as such.
 */
const API_BASE = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:3001/v1";

export interface ApiError {
  error: { code: string; message: string; details?: unknown };
}

export async function apiFetch<T>(
  path: string,
  options: { method?: string; body?: unknown; accessToken?: string } = {},
): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    method: options.method ?? "GET",
    headers: {
      "Content-Type": "application/json",
      ...(options.accessToken ? { Authorization: `Bearer ${options.accessToken}` } : {}),
    },
    body: options.body ? JSON.stringify(options.body) : undefined,
  });

  const json = await res.json().catch(() => ({}));
  if (!res.ok) {
    const err = json as ApiError;
    throw new Error(err.error?.message ?? `Request failed with status ${res.status}`);
  }
  return json as T;
}
