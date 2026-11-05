import { createHmac } from "node:crypto";

/**
 * Minimal HS256 JWT signer for the PostgREST-based test suite.
 *
 * In production Supabase signs these; here we mint anon/user tokens with the
 * same secret PostgREST validates, which produces the exact
 * `Authorization: Bearer ...` header the app sends.
 */
export const JWT_SECRET =
  process.env.SUPABASE_JWT_SECRET ?? "lifeos-test-jwt-secret-at-least-32-characters";

const now = () => Math.floor(Date.now() / 1000);

function encode(value: unknown): string {
  return Buffer.from(JSON.stringify(value)).toString("base64url");
}

export function signJwt(payload: Record<string, unknown>): string {
  const header = encode({ alg: "HS256", typ: "JWT" });
  const body = encode({ iss: "lifeos-test", exp: now() + 60 * 60, ...payload });
  const signature = createHmac("sha256", JWT_SECRET)
    .update(`${header}.${body}`)
    .digest("base64url");
  return `${header}.${body}.${signature}`;
}

export const anonymousToken = (): string => signJwt({ role: "anon" });

export const userToken = (userId: string, email = `${userId}@lifeos.test`): string =>
  signJwt({ sub: userId, role: "authenticated", aud: "authenticated", email });
