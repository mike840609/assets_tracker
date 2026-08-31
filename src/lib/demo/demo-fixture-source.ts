import "server-only";

import { randomUUID } from "node:crypto";

import rawFixture from "./demo-data.json";
import { taiwanCalendarDay } from "@/lib/app-day";
import {
  instantiateDemoFixture,
  shiftDemoFixtureDates,
  type DemoFixtureSource,
  type PreparedDemoFixture,
} from "@/lib/demo/demo-fixture";

// tests/unit/demo-data.test.ts validates the repository artifact during CI.
// Avoid repeating the full Zod backup-import validation in every server cold start.
const canonicalSource = rawFixture as unknown as DemoFixtureSource;
const shiftedByDay = new Map<string, ReturnType<typeof shiftDemoFixtureDates>>();

export const DEMO_FALLBACK_PRICES = [
  { symbol: "2330.TW", price: 2290, currency: "TWD" },
  { symbol: "0050.TW", price: 100.15, currency: "TWD" },
  { symbol: "NVDA", price: 202.81, currency: "USD" },
  { symbol: "TSLA", price: 380.84, currency: "USD" },
  { symbol: "AAPL", price: 333.74, currency: "USD" },
  { symbol: "VOO", price: 683.17, currency: "USD" },
  { symbol: "GOOGL", price: 346.77, currency: "USD" },
] as const;

export const DEMO_FALLBACK_RATES = [
  { fromCurrency: "USD", toCurrency: "TWD", rate: 32.37 },
  { fromCurrency: "TWD", toCurrency: "USD", rate: 1 / 32.37 },
] as const;

export function getPreparedDemoFixture(options: {
  userId: string;
  locale: "en-US" | "zh-TW";
  now: Date;
  makeId?: () => string;
}): PreparedDemoFixture {
  const day = taiwanCalendarDay(options.now);
  const key = day.toISOString().slice(0, 10);
  let shifted = shiftedByDay.get(key);
  if (!shifted) {
    shifted = shiftDemoFixtureDates(canonicalSource, day);
    shiftedByDay.clear();
    shiftedByDay.set(key, shifted);
  }
  return instantiateDemoFixture(shifted, {
    userId: options.userId,
    locale: options.locale,
    now: options.now,
    makeId: options.makeId ?? randomUUID,
  });
}
