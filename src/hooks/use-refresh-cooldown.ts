"use client";

import { useEffect, useState } from "react";
import { getCooldownRemainingMs, REFRESH_COOLDOWN_EVENT } from "@/lib/refresh-client";

/**
 * Tracks the shared market-data refresh cooldown (see lib/refresh-client.ts)
 * so refresh buttons across the app disable in sync.
 */
export function useRefreshCooldown() {
  const [secondsLeft, setSecondsLeft] = useState(0);

  useEffect(() => {
    const sync = () => setSecondsLeft(Math.ceil(getCooldownRemainingMs() / 1000));
    sync();
    window.addEventListener(REFRESH_COOLDOWN_EVENT, sync);
    const interval = window.setInterval(sync, 1000);
    return () => {
      window.removeEventListener(REFRESH_COOLDOWN_EVENT, sync);
      window.clearInterval(interval);
    };
  }, []);

  return { coolingDown: secondsLeft > 0, secondsLeft };
}
