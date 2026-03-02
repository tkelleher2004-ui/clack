import { createHmac, randomBytes } from "crypto";

const STATE_SECRET = process.env.SOCIAL_OAUTH_STATE_SECRET ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY ?? "fallback";
const TTL_MS = 10 * 60 * 1000; // 10 minutes

export interface OAuthState {
  userId: string;
  platform: string;
  nonce: string;
  ts: number;
  code_verifier?: string; // For Twitter PKCE
}

export function encodeOAuthState(
  userId: string,
  platform: string,
  extra?: { code_verifier?: string }
): string {
  const nonce = randomBytes(16).toString("hex");
  const payload: OAuthState = {
    userId,
    platform,
    nonce,
    ts: Date.now(),
    ...(extra?.code_verifier && { code_verifier: extra.code_verifier }),
  };
  const data = Buffer.from(JSON.stringify(payload)).toString("base64url");
  const sig = createHmac("sha256", STATE_SECRET).update(data).digest("hex").slice(0, 16);
  return `${data}.${sig}`;
}

export function decodeOAuthState(state: string): OAuthState | null {
  try {
    const [data, sig] = state.split(".");
    if (!data || !sig) return null;
    const expectedSig = createHmac("sha256", STATE_SECRET).update(data).digest("hex").slice(0, 16);
    if (sig !== expectedSig) return null;
    const payload = JSON.parse(Buffer.from(data, "base64url").toString("utf8")) as OAuthState;
    if (Date.now() - payload.ts > TTL_MS) return null;
    return payload;
  } catch {
    return null;
  }
}
