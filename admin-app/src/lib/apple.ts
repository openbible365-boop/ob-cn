import { SignJWT, jwtVerify, createRemoteJWKSet, importPKCS8 } from "jose";

// Sign in with Apple (web OAuth flow), implemented against Apple's REST
// endpoints directly. Requires an Apple Developer account:
//
//   APPLE_CLIENT_ID   — the Services ID (e.g. com.example.openbible.web)
//   APPLE_TEAM_ID     — 10-char team id from the developer portal
//   APPLE_KEY_ID      — key id of the Sign in with Apple .p8 key
//   APPLE_PRIVATE_KEY — the .p8 file contents (PEM; \n may be escaped)
//   APP_URL           — public HTTPS origin; Apple rejects http/localhost
//                       return URLs, so local testing needs an HTTPS tunnel
//
// Apple has no static client secret: it must be a short-lived ES256 JWT
// signed with the .p8 key — generated per token exchange below.

const APPLE_ISSUER = "https://appleid.apple.com";

const appleJwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

export function appleConfigured() {
  return Boolean(
    process.env.APPLE_CLIENT_ID &&
      process.env.APPLE_TEAM_ID &&
      process.env.APPLE_KEY_ID &&
      process.env.APPLE_PRIVATE_KEY
  );
}

export function appleAuthorizeUrl(opts: { state: string; nonce: string; redirectUri: string }) {
  // Requesting name/email scopes requires response_mode=form_post — the
  // callback therefore arrives as a cross-site POST.
  const params = new URLSearchParams({
    response_type: "code",
    response_mode: "form_post",
    client_id: process.env.APPLE_CLIENT_ID!,
    redirect_uri: opts.redirectUri,
    scope: "name email",
    state: opts.state,
    nonce: opts.nonce,
  });
  return `${APPLE_ISSUER}/auth/authorize?${params.toString()}`;
}

export async function generateAppleClientSecret() {
  const pem = process.env.APPLE_PRIVATE_KEY!.replace(/\\n/g, "\n");
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID! })
    .setIssuer(process.env.APPLE_TEAM_ID!)
    .setSubject(process.env.APPLE_CLIENT_ID!)
    .setAudience(APPLE_ISSUER)
    .setIssuedAt(now)
    .setExpirationTime(now + 300)
    .sign(key);
}

export async function exchangeAppleCode(code: string, redirectUri: string) {
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    redirect_uri: redirectUri,
    client_id: process.env.APPLE_CLIENT_ID!,
    client_secret: await generateAppleClientSecret(),
  });

  const res = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Apple token endpoint ${res.status}: ${await res.text()}`);
  }
  return (await res.json()) as { id_token: string };
}

export async function verifyAppleIdToken(idToken: string, expectedNonce?: string) {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: process.env.APPLE_CLIENT_ID!,
  });
  if (expectedNonce && payload.nonce !== expectedNonce) {
    throw new Error("Apple id_token nonce mismatch");
  }
  if (!payload.sub) {
    throw new Error("Apple id_token missing sub");
  }
  return payload;
}
