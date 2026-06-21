"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useIsMobile } from "@/hooks/use-is-mobile";

/**
 * Standalone /stocks and /projections are the desktop surfaces (sidebar entries).
 * On mobile those views live inside the "Plan" hub at /goals, so any mobile arrival
 * at the standalone route (in-app link, command palette, bookmark) is bounced into
 * the hub to keep one consistent mobile home.
 *
 * ponytail: a brief standalone render flashes before the post-hydration redirect on
 * direct mobile navigation (useIsMobile returns false on the server snapshot). That
 * path is rare; swap to a middleware UA check if it ever needs to be flash-free.
 */
export function MobileHubRedirect({ hash }: { hash: `#${string}` }) {
  const isMobile = useIsMobile();
  const router = useRouter();

  useEffect(() => {
    if (isMobile) router.replace(`/goals${hash}`);
  }, [isMobile, hash, router]);

  return null;
}
