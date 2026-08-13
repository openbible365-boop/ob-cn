// Smoke-test for the Apple OAuth helpers using a throwaway P-256 key —
// verifies client-secret JWT structure and authorize URL without real
// Apple credentials.
import { generateKeyPairSync } from "node:crypto";
import { decodeJwt, decodeProtectedHeader, jwtVerify, importSPKI } from "jose";

const { privateKey, publicKey } = generateKeyPairSync("ec", { namedCurve: "P-256" });
const pem = privateKey.export({ type: "pkcs8", format: "pem" }).toString();
const pubPem = publicKey.export({ type: "spki", format: "pem" }).toString();

process.env.APPLE_CLIENT_ID = "com.example.openbible.web";
process.env.APPLE_TEAM_ID = "TEAM123456";
process.env.APPLE_KEY_ID = "KEY1234567";
process.env.APPLE_PRIVATE_KEY = pem;

const { appleConfigured, appleAuthorizeUrl, generateAppleClientSecret } = await import(
  "../src/lib/apple"
);

function assert(cond: boolean, label: string) {
  if (!cond) throw new Error(`FAIL: ${label}`);
  console.log(`ok: ${label}`);
}

assert(appleConfigured() === true, "appleConfigured true with env set");

const url = new URL(appleAuthorizeUrl({ state: "st4te", nonce: "n0nce", redirectUri: "https://example.com/api/auth/apple/callback" }));
assert(url.origin + url.pathname === "https://appleid.apple.com/auth/authorize", "authorize endpoint");
assert(url.searchParams.get("client_id") === "com.example.openbible.web", "client_id param");
assert(url.searchParams.get("response_mode") === "form_post", "form_post mode");
assert(url.searchParams.get("scope") === "name email", "scope");
assert(url.searchParams.get("state") === "st4te" && url.searchParams.get("nonce") === "n0nce", "state+nonce");
assert(url.searchParams.get("redirect_uri") === "https://example.com/api/auth/apple/callback", "redirect_uri");

const secret = await generateAppleClientSecret();
const header = decodeProtectedHeader(secret);
assert(header.alg === "ES256" && header.kid === "KEY1234567", "JWT header alg+kid");
const claims = decodeJwt(secret);
assert(claims.iss === "TEAM123456", "iss = team id");
assert(claims.sub === "com.example.openbible.web", "sub = client id");
assert(claims.aud === "https://appleid.apple.com", "aud = apple");
assert(typeof claims.exp === "number" && claims.exp - (claims.iat as number) === 300, "5min expiry");

// Signature must verify against the matching public key.
const pub = await importSPKI(pubPem, "ES256");
await jwtVerify(secret, pub, { issuer: "TEAM123456", audience: "https://appleid.apple.com" });
console.log("ok: client secret signature verifies with matching P-256 public key");

console.log("\nALL PASSED");
