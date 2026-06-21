import { getSession } from "@/lib/auth-session";
import { log } from "@/lib/logger";

// First-party avatar proxy.
//
// Google profile pictures are hosted on lh3.googleusercontent.com. Loading them
// directly as a third-party <img> is unreliable in the field: privacy browsers
// and ad blockers (Brave Shields, uBlock, etc.) block requests to Google-owned
// hosts as trackers, so the avatar silently fails ("provisional headers shown",
// no response) even though the image itself returns 200 server-side.
//
// Proxying through our own origin makes the browser issue a same-origin request
// to /api/avatar, which those blockers leave alone. The upstream URL is taken
// from the authenticated session — never from a client-supplied parameter — so
// this can't be abused as an open image proxy / SSRF vector.

// Only Google's avatar CDN is ever proxied. Anything else 404s.
const ALLOWED_HOSTS = new Set(["lh3.googleusercontent.com"]);

export async function GET(): Promise<Response> {
  const session = await getSession();
  const imageUrl = session?.user?.image;
  if (!imageUrl) return new Response(null, { status: 404 });

  let parsed: URL;
  try {
    parsed = new URL(imageUrl);
  } catch {
    return new Response(null, { status: 404 });
  }
  if (parsed.protocol !== "https:" || !ALLOWED_HOSTS.has(parsed.hostname)) {
    return new Response(null, { status: 404 });
  }

  try {
    // Omit the referrer so Google's CDN serves the image without origin leakage.
    const upstream = await fetch(parsed.toString(), {
      headers: { Accept: "image/*" },
      referrerPolicy: "no-referrer",
    });
    if (!upstream.ok || !upstream.body) {
      log.warn("Avatar proxy upstream failed", { status: upstream.status });
      return new Response(null, { status: 404 });
    }

    return new Response(upstream.body, {
      status: 200,
      headers: {
        "Content-Type": upstream.headers.get("content-type") ?? "image/jpeg",
        // Per-user image behind auth: cache privately, with a short TTL so a
        // changed Google photo is picked up within the hour.
        "Cache-Control": "private, max-age=3600",
      },
    });
  } catch (error) {
    log.error("Avatar proxy fetch error", {
      error: error instanceof Error ? error.message : String(error),
      __error: error,
    });
    return new Response(null, { status: 404 });
  }
}
