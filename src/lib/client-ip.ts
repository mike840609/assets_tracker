/** Extract the best available client IP from trusted platform request headers. */
export function getClientIpFromHeaders(headers: Headers): string {
  const xff = headers.get("x-forwarded-for");
  if (xff) {
    const ip = xff
      .split(",")
      .map((part) => part.trim())
      .findLast(Boolean);
    if (ip) return ip;
  }

  const cfIp = headers.get("cf-connecting-ip")?.trim();
  if (cfIp) return cfIp;

  const realIp = headers.get("x-real-ip")?.trim();
  if (realIp) return realIp;

  return "unknown";
}

/** Extract the best available client IP from request headers. */
export function getClientIp(request: Request): string {
  return getClientIpFromHeaders(request.headers);
}
