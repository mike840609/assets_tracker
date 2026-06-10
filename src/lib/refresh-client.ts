"use client";

import { CLIENT_REFRESH_COOLDOWN_MS } from "@/lib/refresh-policy";

/**
 * Shared client-side entry point for the dashboard/settings "refresh market
 * data" action. Centralizes the two POSTs plus a module-level cooldown so
 * every refresh surface (button, pull-to-refresh, settings) shares one state.
 *
 * UX layer only — the server enforces its own freshness gate and per-user
 * rate limits regardless of what this module does.
 */

export type RefreshOutcome =
  | { status: "updated"; prices: number; rates: number }
  | { status: "fresh"; retryAfterSeconds: number }
  | { status: "cooldown"; retryAfterSeconds: number }
  | { status: "error" };

export const REFRESH_COOLDOWN_EVENT = "refresh:cooldown";

let cooldownUntil = 0;

export function getCooldownRemainingMs(): number {
  return Math.max(0, cooldownUntil - Date.now());
}

function setCooldown(untilMs: number) {
  if (untilMs <= cooldownUntil) return;
  cooldownUntil = untilMs;
  window.dispatchEvent(new CustomEvent(REFRESH_COOLDOWN_EVENT, { detail: { until: untilMs } }));
}

function parseRetryAfterSeconds(res: Response): number {
  const header = Number(res.headers.get("Retry-After"));
  return Number.isFinite(header) && header > 0
    ? Math.ceil(header)
    : Math.ceil(CLIENT_REFRESH_COOLDOWN_MS / 1000);
}

type RefreshPayload = {
  updated?: number;
  skippedFresh?: number | boolean;
  retryAfterSeconds?: number | null;
};

export async function refreshMarketData(): Promise<RefreshOutcome> {
  const remainingMs = getCooldownRemainingMs();
  if (remainingMs > 0) {
    return { status: "cooldown", retryAfterSeconds: Math.ceil(remainingMs / 1000) };
  }

  // Floor cooldown immediately so a double-fire (pull + button) can't send a
  // second pair of requests while the first is in flight.
  setCooldown(Date.now() + CLIENT_REFRESH_COOLDOWN_MS);

  try {
    const [priceRes, ratesRes] = await Promise.all([
      fetch("/api/prices/refresh", { method: "POST" }),
      fetch("/api/exchange-rates/refresh", { method: "POST" }),
    ]);

    if (priceRes.status === 429 || ratesRes.status === 429) {
      const limited = priceRes.status === 429 ? priceRes : ratesRes;
      const retryAfterSeconds = parseRetryAfterSeconds(limited);
      setCooldown(Date.now() + retryAfterSeconds * 1000);
      return { status: "cooldown", retryAfterSeconds };
    }
    if (!priceRes.ok || !ratesRes.ok) return { status: "error" };

    const [{ data: priceData }, { data: ratesData }] = (await Promise.all([
      priceRes.json(),
      ratesRes.json(),
    ])) as [{ data: RefreshPayload }, { data: RefreshPayload }];

    const pricesUpdated = priceData.updated ?? 0;
    const ratesUpdated = ratesData.updated ?? 0;
    const anySkipped = Boolean(priceData.skippedFresh) || Boolean(ratesData.skippedFresh);

    if (pricesUpdated === 0 && ratesUpdated === 0 && anySkipped) {
      // Earliest moment a retry would fetch *something* (prices have a much
      // shorter TTL than FX rates, so min — not max — is the honest hint).
      const hints = [priceData.retryAfterSeconds, ratesData.retryAfterSeconds].filter(
        (v): v is number => typeof v === "number" && v > 0,
      );
      const retryAfterSeconds = Math.max(
        hints.length > 0 ? Math.min(...hints) : 0,
        Math.ceil(CLIENT_REFRESH_COOLDOWN_MS / 1000),
      );
      setCooldown(Date.now() + retryAfterSeconds * 1000);
      return { status: "fresh", retryAfterSeconds };
    }

    window.dispatchEvent(new CustomEvent("prices:refreshed"));
    return { status: "updated", prices: pricesUpdated, rates: ratesUpdated };
  } catch {
    return { status: "error" };
  }
}
