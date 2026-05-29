import "server-only";
import type { SerializedAccountWithHoldings, SerializedHolding } from "@/lib/types";
import { resolveRate } from "@/lib/services/exchange-rate-service";

/**
 * Read-only demo fixture.
 *
 * Everything here is deterministic and offline — no live price/FX fetches — so
 * the "demo mode" overlay (see `src/lib/services/demo-service.ts`) can paint a
 * realistic, populated app for first-time users without writing a single row to
 * the database. Monetary values are authored in a canonical currency (USD or
 * TWD per account) and converted to the viewer's base currency at render time
 * via {@link resolveRate} + {@link DEMO_EXCHANGE_RATES}.
 *
 * All account/holding fields are already serialized (plain numbers + ISO date
 * strings) so they satisfy the Serialized* types directly and stream straight
 * to client components without going through the Decimal/Date serializers.
 */

/** Stable synthetic user id, used only for cache-key shapes; never persisted. */
export const DEMO_USER_ID = "demo-user";

/** ISO timestamp used for all fixture createdAt/updatedAt fields. */
const FIXED_TS = "2024-01-15T00:00:00.000Z";

// ---------------------------------------------------------------------------
// Static prices & exchange rates (deterministic, offline)
// ---------------------------------------------------------------------------

export const DEMO_PRICE_MAP: Record<string, { price: number; currency: string }> = {
  // US equities / ETFs (USD)
  AAPL: { price: 230, currency: "USD" },
  MSFT: { price: 430, currency: "USD" },
  NVDA: { price: 130, currency: "USD" },
  GOOGL: { price: 175, currency: "USD" },
  AMZN: { price: 200, currency: "USD" },
  TSLA: { price: 250, currency: "USD" },
  VOO: { price: 540, currency: "USD" },
  VTI: { price: 280, currency: "USD" },
  // Crypto (USD)
  BTC: { price: 95000, currency: "USD" },
  ETH: { price: 3400, currency: "USD" },
  SOL: { price: 190, currency: "USD" },
  // Taiwan equities (TWD)
  "2330.TW": { price: 1050, currency: "TWD" },
  "0050.TW": { price: 190, currency: "TWD" },
};

/**
 * Rates keyed "FROM_TO" where amount_in_FROM * rate = amount_in_TO.
 * Inverse pairs are derived by {@link resolveRate}, so only USD→X is stored.
 */
export const DEMO_EXCHANGE_RATES: Map<string, number> = new Map([
  ["USD_TWD", 32],
  ["USD_EUR", 0.92],
  ["USD_GBP", 0.79],
  ["USD_JPY", 150],
  ["USD_CAD", 1.36],
  ["USD_AUD", 1.52],
  ["USD_HKD", 7.8],
  ["USD_CNY", 7.2],
  ["USD_SGD", 1.34],
  ["USD_KRW", 1350],
  ["USD_INR", 83],
  ["USD_CHF", 0.88],
]);

// ---------------------------------------------------------------------------
// Accounts + holdings fixture
// ---------------------------------------------------------------------------

function holding(
  accountId: string,
  symbol: string,
  name: string,
  quantity: number,
  assetType: SerializedHolding["assetType"],
  currency: string,
): SerializedHolding {
  // Cast mirrors serializeHolding(): the Serialized<> mapping types option-only
  // fields (strike/expiration) as non-null, but they are genuinely null here.
  return {
    id: `demo-h-${accountId}-${symbol}`,
    accountId,
    symbol,
    name,
    quantity,
    currency,
    assetType,
    underlyingSymbol: null,
    optionType: null,
    strike: null,
    expiration: null,
    contractMultiplier: null,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
  } as unknown as SerializedHolding;
}

function account(
  id: string,
  name: string,
  type: "ASSET" | "LIABILITY",
  category: SerializedAccountWithHoldings["category"],
  currency: string,
  cashBalance: number,
  sortOrder: number,
  holdings: SerializedHolding[] = [],
  isPinned = false,
): SerializedAccountWithHoldings {
  return {
    id,
    userId: DEMO_USER_ID,
    name,
    type,
    category,
    currency,
    cashBalance,
    isActive: true,
    isPinned,
    sortOrder,
    createdAt: FIXED_TS,
    updatedAt: FIXED_TS,
    holdings,
  };
}

export const DEMO_ACCOUNTS: SerializedAccountWithHoldings[] = [
  account("demo-acct-savings", "High-Yield Savings", "ASSET", "BANK", "USD", 60000, 0, [], true),
  account("demo-acct-checking", "Everyday Checking", "ASSET", "BANK", "USD", 24500, 1),
  account("demo-acct-brokerage", "Brokerage", "ASSET", "BROKERAGE", "USD", 3200, 2, [
    holding("demo-acct-brokerage", "AAPL", "Apple Inc.", 50, "STOCK", "USD"),
    holding("demo-acct-brokerage", "MSFT", "Microsoft Corp.", 25, "STOCK", "USD"),
    holding("demo-acct-brokerage", "NVDA", "NVIDIA Corp.", 80, "STOCK", "USD"),
    holding("demo-acct-brokerage", "GOOGL", "Alphabet Inc.", 30, "STOCK", "USD"),
    holding("demo-acct-brokerage", "AMZN", "Amazon.com Inc.", 25, "STOCK", "USD"),
    holding("demo-acct-brokerage", "TSLA", "Tesla Inc.", 20, "STOCK", "USD"),
    holding("demo-acct-brokerage", "VOO", "Vanguard S&P 500 ETF", 30, "ETF", "USD"),
    holding("demo-acct-brokerage", "VTI", "Vanguard Total Market ETF", 40, "ETF", "USD"),
  ]),
  account("demo-acct-crypto", "Crypto Wallet", "ASSET", "CRYPTO_WALLET", "USD", 0, 3, [
    holding("demo-acct-crypto", "BTC", "Bitcoin", 0.5, "CRYPTO", "USD"),
    holding("demo-acct-crypto", "ETH", "Ethereum", 5, "CRYPTO", "USD"),
    holding("demo-acct-crypto", "SOL", "Solana", 40, "CRYPTO", "USD"),
  ]),
  account("demo-acct-tw", "TW Brokerage", "ASSET", "BROKERAGE", "TWD", 150000, 4, [
    holding("demo-acct-tw", "2330.TW", "TSMC", 200, "STOCK", "TWD"),
    holding("demo-acct-tw", "0050.TW", "Yuanta Taiwan 50 ETF", 500, "ETF", "TWD"),
  ]),
  account("demo-acct-property", "Primary Residence", "ASSET", "PROPERTY", "USD", 450000, 5),
  account("demo-acct-card", "Rewards Credit Card", "LIABILITY", "CREDIT_CARD", "USD", 4800, 6),
  account("demo-acct-mortgage", "Home Mortgage", "LIABILITY", "MORTGAGE", "USD", 320000, 7),
];

// ---------------------------------------------------------------------------
// Current per-account value (USD) — derived from the same prices/rates the
// dashboard uses, so the latest snapshot matches the net-worth card exactly.
// ---------------------------------------------------------------------------

/** Returns each account's current total value in USD (positive magnitude). */
function currentAccountValuesUSD(): Record<string, number> {
  const out: Record<string, number> = {};
  for (const acct of DEMO_ACCOUNTS) {
    const cashRate = resolveRate(DEMO_EXCHANGE_RATES, acct.currency, "USD") ?? 1;
    let valueUSD = acct.cashBalance * cashRate;
    for (const h of acct.holdings) {
      const px = DEMO_PRICE_MAP[h.symbol];
      if (!px) continue;
      const hRate = resolveRate(DEMO_EXCHANGE_RATES, px.currency, "USD") ?? 1;
      valueUSD += px.price * h.quantity * hRate;
    }
    out[acct.id] = valueUSD;
  }
  return out;
}

export const DEMO_ACCOUNT_META = DEMO_ACCOUNTS.map((a) => ({
  id: a.id,
  name: a.name,
  category: a.category,
  type: a.type,
}));

// ---------------------------------------------------------------------------
// Deterministic history generation
// ---------------------------------------------------------------------------

/** Tiny seeded LCG → stable pseudo-random sequence in [0, 1). */
function makeRng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

/** Number of daily history points generated (≈ 18 months). */
const HISTORY_DAYS: number = 540;

export interface DemoSnapshot {
  /** "YYYY-MM-DD" */
  date: string;
  /** ISO timestamp */
  createdAt: string;
  /** Net worth in USD. */
  netWorthUSD: number;
  totalAssetsUSD: number;
  totalLiabilitiesUSD: number;
  /** accountId → value in USD (positive magnitude, matching snapshot breakdown). */
  perAccountUSD: Record<string, number>;
}

/**
 * Build the full daily history (oldest → newest) ending today. The newest point
 * equals the current per-account values exactly, so the dashboard delta and the
 * history chart's last point agree. Deterministic given the seed; the only
 * non-constant input is "today", which keeps the demo perpetually fresh.
 */
function buildDemoHistory(): DemoSnapshot[] {
  const current = currentAccountValuesUSD();
  const snapshots: DemoSnapshot[] = [];

  // Per-account growth profile: how much smaller the value was at the start of
  // the window (startFrac), plus volatility amplitude. Liabilities amortize, so
  // they were *larger* in the past (startFrac > 1).
  const profile: Record<string, { startFrac: number; vol: number; seed: number }> = {
    "demo-acct-savings": { startFrac: 0.6, vol: 0.01, seed: 11 },
    "demo-acct-checking": { startFrac: 0.85, vol: 0.06, seed: 22 },
    "demo-acct-brokerage": { startFrac: 0.68, vol: 0.05, seed: 33 },
    "demo-acct-crypto": { startFrac: 0.45, vol: 0.14, seed: 44 },
    "demo-acct-tw": { startFrac: 0.72, vol: 0.05, seed: 55 },
    "demo-acct-property": { startFrac: 0.93, vol: 0.004, seed: 66 },
    "demo-acct-card": { startFrac: 1.15, vol: 0.18, seed: 77 },
    "demo-acct-mortgage": { startFrac: 1.08, vol: 0.001, seed: 88 },
  };

  const rngs: Record<string, () => number> = {};
  for (const acct of DEMO_ACCOUNTS) {
    rngs[acct.id] = makeRng(profile[acct.id]?.seed ?? 1);
  }

  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let i = 0; i < HISTORY_DAYS; i++) {
    const daysAgo = HISTORY_DAYS - 1 - i;
    const d = new Date(today);
    d.setDate(d.getDate() - daysAgo);
    const dateStr = d.toISOString().split("T")[0];
    const t = HISTORY_DAYS === 1 ? 1 : i / (HISTORY_DAYS - 1); // 0 → 1

    const perAccountUSD: Record<string, number> = {};
    let assets = 0;
    let liabilities = 0;

    for (const acct of DEMO_ACCOUNTS) {
      const p = profile[acct.id] ?? { startFrac: 0.8, vol: 0.04, seed: 1 };
      const isLast = i === HISTORY_DAYS - 1;
      let factor: number;
      if (isLast) {
        factor = 1; // newest point lands exactly on current values
      } else {
        const trend = p.startFrac + (1 - p.startFrac) * t;
        // Smooth wave + small jitter for organic-looking lines.
        const wave = Math.sin(t * Math.PI * 3 + p.seed) * p.vol * 0.5;
        const jitter = (rngs[acct.id]() - 0.5) * p.vol;
        factor = trend + wave + jitter;
      }
      const value = Math.max(0, current[acct.id] * factor);
      perAccountUSD[acct.id] = value;
      if (acct.type === "ASSET") assets += value;
      else liabilities += value;
    }

    snapshots.push({
      date: dateStr,
      createdAt: d.toISOString(),
      netWorthUSD: assets - liabilities,
      totalAssetsUSD: assets,
      totalLiabilitiesUSD: liabilities,
      perAccountUSD,
    });
  }

  return snapshots;
}

/** Memoized full history (per server process). */
let _history: DemoSnapshot[] | null = null;
let _historyDay: string | null = null;
export function getDemoHistory(): DemoSnapshot[] {
  const todayKey = new Date().toISOString().split("T")[0];
  if (!_history || _historyDay !== todayKey) {
    _history = buildDemoHistory();
    _historyDay = todayKey;
  }
  return _history;
}

// ---------------------------------------------------------------------------
// Monthly cash-flow fixture (net deposits in USD), distributed per account.
// ---------------------------------------------------------------------------

/**
 * Deterministic per-(account, month) net cash contributions in USD. Only the
 * "saver" accounts receive regular contributions; values are stable per month.
 */
export function getDemoAccountCashFlowUSD(): {
  accountId: string;
  monthKey: string;
  contributions: number;
}[] {
  const contributors: Record<string, { base: number; seed: number }> = {
    "demo-acct-savings": { base: 1500, seed: 101 },
    "demo-acct-brokerage": { base: 2000, seed: 202 },
    "demo-acct-crypto": { base: 400, seed: 303 },
  };

  // Walk the last 13 month keys ending this month.
  const now = new Date();
  const monthKeys: string[] = [];
  for (let m = 12; m >= 0; m--) {
    const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() - m, 1));
    monthKeys.push(`${d.getUTCFullYear()}-${String(d.getUTCMonth() + 1).padStart(2, "0")}`);
  }

  const out: { accountId: string; monthKey: string; contributions: number }[] = [];
  for (const [accountId, cfg] of Object.entries(contributors)) {
    const rng = makeRng(cfg.seed);
    for (const monthKey of monthKeys) {
      const jitter = (rng() - 0.3) * cfg.base * 0.8;
      const amount = Math.round(cfg.base + jitter);
      out.push({ accountId, monthKey, contributions: amount });
    }
  }
  return out;
}
