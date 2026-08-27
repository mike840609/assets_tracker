"use client";

import { useEffect } from "react";

/**
 * Reaching /login means there is no session anymore. The service worker's
 * navigation cache holds fully rendered pages with real balances in them, so it
 * has to be dropped here — a server-action sign-out soft-navigates, which never
 * reaches the worker's own fetch handler.
 */
export function PurgeNavCache() {
  useEffect(() => {
    navigator.serviceWorker?.ready
      .then((registration) => registration.active?.postMessage("astt:purge-nav-cache"))
      .catch(() => {});
  }, []);

  return null;
}
