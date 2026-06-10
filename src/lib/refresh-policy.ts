/**
 * Shared throttling policy for manual market-data refreshes.
 *
 * Isomorphic constants (no `server-only`): the server freshness gate and the
 * client cooldown both import from here so the two layers can't drift apart.
 */

/** Skip external price fetches for symbols cached more recently than this. */
export const PRICE_REFRESH_TTL_MS = 60 * 1000;

/**
 * Skip external FX fetches for base currencies refreshed more recently than
 * this. Upstream sources (frankfurter = ECB, open.er-api) update at most a
 * few times a day, so an hour is already generous.
 */
export const FX_REFRESH_TTL_MS = 60 * 60 * 1000;

/** Minimum client-side cooldown after any manual refresh attempt. */
export const CLIENT_REFRESH_COOLDOWN_MS = 15_000;
