"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { getMobileHubClientRedirectUrl } from "@/lib/mobile-hub-route";

/**
 * Standalone /stocks, /projections, and /calendar are desktop surfaces (sidebar entries).
 * On mobile those views live inside the "Plan" hub at /goals, so any mobile arrival at
 * a standalone route (in-app link, command palette, bookmark) is bounced into the hub
 * to keep one consistent mobile home.
 *
 * The proxy redirects normal mobile user agents before the page reaches the server
 * component. This client fallback still handles a desktop browser resized below the
 * breakpoint, where the server cannot know the viewport width from the request.
 */
export function MobileHubRedirect({ hash, search = "" }: { hash: `#${string}`; search?: string }) {
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    if (!isMobile) return;
    router.replace(
      getMobileHubClientRedirectUrl({
        currentSearch: window.location.search,
        fallbackSearch: search,
        hash,
      }),
    );
  }, [isMobile, hash, search, router]);

  return null;
}
