import { isIP } from "node:net";

export type IpLocation = {
  country: string | null;
  countryCode: string | null;
  region: string | null;
  city: string | null;
};

function cleanIp(raw: string) {
  let ip = raw.split(",")[0]?.trim() ?? "";
  if (ip.startsWith("[")) {
    ip = ip.slice(1, ip.indexOf("]"));
  } else if (/^\d{1,3}(?:\.\d{1,3}){3}:\d+$/.test(ip)) {
    ip = ip.slice(0, ip.lastIndexOf(":"));
  }
  if (ip.startsWith("::ffff:")) ip = ip.slice(7);
  return isIP(ip) ? ip : null;
}

export function requestIp(request: Request) {
  for (const header of ["cf-connecting-ip", "x-forwarded-for", "x-real-ip"]) {
    const ip = cleanIp(request.headers.get(header) ?? "");
    if (ip) return ip;
  }
  return null;
}

function isPrivateIp(ip: string) {
  if (ip.includes(":")) {
    const value = ip.toLowerCase();
    return value === "::1" || value.startsWith("fe8") ||
      value.startsWith("fe9") || value.startsWith("fea") ||
      value.startsWith("feb") || value.startsWith("fc") ||
      value.startsWith("fd");
  }

  const parts = ip.split(".").map(Number);
  const [a, b] = parts;
  return a === 0 || a === 10 || a === 127 ||
    (a === 100 && b >= 64 && b <= 127) ||
    (a === 169 && b === 254) ||
    (a === 172 && b >= 16 && b <= 31) ||
    (a === 192 && b === 168) ||
    a >= 224;
}

function nullableText(value: unknown, maxLength: number) {
  const text = String(value ?? "").trim();
  return text ? text.slice(0, maxLength) : null;
}

export async function lookupIpLocation(ip: string): Promise<IpLocation | null> {
  if (isPrivateIp(ip)) return null;

  const baseUrl =
    process.env.IP_GEOLOCATION_URL?.trim().replace(/\/+$/, "") ||
    "https://ipwho.is";
  try {
    const response = await fetch(
      `${baseUrl}/${encodeURIComponent(ip)}?fields=success,country,country_code,region,city`,
      {
        cache: "no-store",
        signal: AbortSignal.timeout(2500),
      },
    );
    if (!response.ok) return null;
    const data = await response.json() as {
      success?: boolean;
      country?: unknown;
      country_code?: unknown;
      region?: unknown;
      city?: unknown;
    };
    if (data.success === false) return null;
    return {
      country: nullableText(data.country, 120),
      countryCode: nullableText(data.country_code, 8),
      region: nullableText(data.region, 120),
      city: nullableText(data.city, 120),
    };
  } catch {
    // Token registration must still succeed when the optional geo service is
    // unavailable or rate-limited.
    return null;
  }
}
