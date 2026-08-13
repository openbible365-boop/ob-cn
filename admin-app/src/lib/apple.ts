import { readFile } from "node:fs/promises";
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
const DEFAULT_APPLE_IOS_CLIENT_ID = "live.openbible.app";

const appleJwks = createRemoteJWKSet(new URL(`${APPLE_ISSUER}/auth/keys`));

function appleWebClientId() {
  return process.env.APPLE_CLIENT_ID?.trim() ?? "";
}

export function appleIosClientId() {
  return process.env.APPLE_IOS_CLIENT_ID?.trim() || DEFAULT_APPLE_IOS_CLIENT_ID;
}

async function applePrivateKey() {
  const inlineKey = process.env.APPLE_PRIVATE_KEY?.replace(/\\n/g, "\n").trim();
  if (inlineKey) return inlineKey;

  const keyPath = process.env.APPLE_PRIVATE_KEY_PATH?.trim();
  if (!keyPath) throw new Error("Apple private key is not configured");
  return (await readFile(keyPath, "utf8")).trim();
}

function appleSigningConfigured() {
  return Boolean(
    process.env.APPLE_TEAM_ID?.trim() &&
      process.env.APPLE_KEY_ID?.trim() &&
      (process.env.APPLE_PRIVATE_KEY?.trim() || process.env.APPLE_PRIVATE_KEY_PATH?.trim())
  );
}

export function appleConfigured() {
  return Boolean(appleWebClientId() && appleSigningConfigured());
}

export function appleNativeConfigured() {
  return Boolean(appleIosClientId() && appleSigningConfigured());
}

export function appleAuthorizeUrl(opts: { state: string; nonce: string; redirectUri: string }) {
  // Requesting name/email scopes requires response_mode=form_post — the
  // callback therefore arrives as a cross-site POST.
  const params = new URLSearchParams({
    response_type: "code",
    response_mode: "form_post",
    client_id: appleWebClientId(),
    redirect_uri: opts.redirectUri,
    scope: "name email",
    state: opts.state,
    nonce: opts.nonce,
  });
  return `${APPLE_ISSUER}/auth/authorize?${params.toString()}`;
}

export async function generateAppleClientSecret(clientId = appleWebClientId()) {
  if (!clientId) throw new Error("Apple client id is not configured");
  const pem = await applePrivateKey();
  const key = await importPKCS8(pem, "ES256");
  const now = Math.floor(Date.now() / 1000);

  return new SignJWT({})
    .setProtectedHeader({ alg: "ES256", kid: process.env.APPLE_KEY_ID!.trim() })
    .setIssuer(process.env.APPLE_TEAM_ID!.trim())
    .setSubject(clientId)
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
    client_id: appleWebClientId(),
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

export async function exchangeAppleNativeCode(code: string) {
  const clientId = appleIosClientId();
  const body = new URLSearchParams({
    grant_type: "authorization_code",
    code,
    client_id: clientId,
    client_secret: await generateAppleClientSecret(clientId),
  });

  const res = await fetch(`${APPLE_ISSUER}/auth/token`, {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body,
  });
  if (!res.ok) {
    throw new Error(`Apple native token exchange failed (${res.status})`);
  }
  return (await res.json()) as { id_token: string; refresh_token?: string };
}

export async function verifyAppleIdToken(
  idToken: string,
  options: { expectedNonce?: string; audience?: string } = {},
) {
  const { payload } = await jwtVerify(idToken, appleJwks, {
    issuer: APPLE_ISSUER,
    audience: options.audience ?? appleWebClientId(),
  });
  if (options.expectedNonce && payload.nonce !== options.expectedNonce) {
    throw new Error("Apple id_token nonce mismatch");
  }
  if (!payload.sub) {
    throw new Error("Apple id_token missing sub");
  }
  return payload;
}
