/**
 * OCC option symbol parser/builder.
 *
 * Format (OCC-21): ROOT(1-6) + YYMMDD + (C|P) + STRIKE×1000 zero-padded to 8 digits
 *   e.g. AAPL250117C00150000  =  AAPL, 2025-01-17, Call, $150 strike
 *
 * Buy-side US equity options only — 100-share contract multiplier is hard-coded.
 * Mini contracts (root with trailing digit, e.g. MSFT7) are explicitly rejected.
 */

import type { SerializedHolding } from "@/lib/types";

export type OptionSide = "CALL" | "PUT";

export interface ParsedOption {
  underlying: string;
  expiration: Date;
  optionType: OptionSide;
  strike: number;
  contractMultiplier: 100;
  occSymbol: string;
}

export class OptionError extends Error {
  constructor(
    public code: string,
    message: string,
  ) {
    super(message);
    this.name = "OptionError";
  }
}

const OCC_REGEX = /^([A-Z][A-Z0-9.\-]{0,5})(\d{2})(\d{2})(\d{2})([CP])(\d{8})$/;

export function isOccSymbol(raw: string): boolean {
  return OCC_REGEX.test(raw.trim().toUpperCase());
}

export function tryParseOccSymbol(raw: string): ParsedOption | null {
  try {
    return parseOccSymbol(raw);
  } catch {
    return null;
  }
}

export function parseOccSymbol(raw: string): ParsedOption {
  const cleaned = raw.trim().toUpperCase();
  const match = OCC_REGEX.exec(cleaned);
  if (!match) {
    throw new OptionError("INVALID_FORMAT", `Invalid OCC option symbol: ${raw}`);
  }
  const [, root, yy, mm, dd, cp, strikeRaw] = match;

  if (/\d$/.test(root) && /[A-Z]/.test(root[0])) {
    const lettersOnly = root.replace(/\d+$/, "");
    if (lettersOnly.length >= 1 && lettersOnly !== root) {
      throw new OptionError(
        "MINI_NOT_SUPPORTED",
        "Mini-options (10-share contracts) are not supported",
      );
    }
  }

  const year = 2000 + parseInt(yy, 10);
  const month = parseInt(mm, 10);
  const day = parseInt(dd, 10);
  const expiration = new Date(Date.UTC(year, month - 1, day));
  if (
    expiration.getUTCFullYear() !== year ||
    expiration.getUTCMonth() !== month - 1 ||
    expiration.getUTCDate() !== day
  ) {
    throw new OptionError("INVALID_DATE", `Invalid expiration date in ${raw}`);
  }

  const now = new Date();
  const fiveYearsFromNow = new Date(now);
  fiveYearsFromNow.setUTCFullYear(now.getUTCFullYear() + 5);
  const thirtyDaysAgo = new Date(now);
  thirtyDaysAgo.setUTCDate(now.getUTCDate() - 30);
  if (expiration > fiveYearsFromNow) {
    throw new OptionError("EXPIRY_TOO_FAR", "Expiration is more than 5 years out");
  }
  if (expiration < thirtyDaysAgo) {
    throw new OptionError("EXPIRY_TOO_OLD", "Expiration is more than 30 days in the past");
  }

  const strikeThousandths = parseInt(strikeRaw, 10);
  if (strikeThousandths <= 0) {
    throw new OptionError("INVALID_STRIKE", "Strike must be positive");
  }
  const strike = strikeThousandths / 1000;

  return {
    underlying: root,
    expiration,
    optionType: cp === "C" ? "CALL" : "PUT",
    strike,
    contractMultiplier: 100,
    occSymbol: cleaned,
  };
}

export function buildOccSymbol(args: {
  underlying: string;
  expiration: Date;
  optionType: OptionSide;
  strike: number;
}): string {
  const root = args.underlying.trim().toUpperCase();
  if (!/^[A-Z][A-Z0-9.\-]{0,5}$/.test(root)) {
    throw new OptionError("INVALID_ROOT", `Invalid underlying root: ${args.underlying}`);
  }
  const yy = String(args.expiration.getUTCFullYear() % 100).padStart(2, "0");
  const mm = String(args.expiration.getUTCMonth() + 1).padStart(2, "0");
  const dd = String(args.expiration.getUTCDate()).padStart(2, "0");
  const cp = args.optionType === "CALL" ? "C" : "P";
  const strikeThousandths = Math.round(args.strike * 1000);
  if (strikeThousandths <= 0) {
    throw new OptionError("INVALID_STRIKE", "Strike must be positive");
  }
  const strike = String(strikeThousandths).padStart(8, "0");
  return `${root}${yy}${mm}${dd}${cp}${strike}`;
}

const MONTH_ABBR = [
  "Jan",
  "Feb",
  "Mar",
  "Apr",
  "May",
  "Jun",
  "Jul",
  "Aug",
  "Sep",
  "Oct",
  "Nov",
  "Dec",
];

export function formatOptionLabel(p: ParsedOption): string {
  const month = MONTH_ABBR[p.expiration.getUTCMonth()];
  const day = p.expiration.getUTCDate();
  const yy = String(p.expiration.getUTCFullYear() % 100).padStart(2, "0");
  const strike = formatStrike(p.strike);
  const side = p.optionType === "CALL" ? "Call" : "Put";
  return `${p.underlying} ${month} ${day} '${yy} $${strike} ${side}`;
}

export function formatOptionShort(p: ParsedOption): string {
  const m = p.expiration.getUTCMonth() + 1;
  const d = p.expiration.getUTCDate();
  const yy = String(p.expiration.getUTCFullYear() % 100).padStart(2, "0");
  const cp = p.optionType === "CALL" ? "C" : "P";
  return `${p.underlying} ${formatStrike(p.strike)}${cp} ${m}/${d}/${yy}`;
}

function formatStrike(strike: number): string {
  return Number.isInteger(strike) ? String(strike) : strike.toFixed(2).replace(/\.?0+$/, "");
}

/**
 * For UI rows. Falls back to the raw symbol if metadata is missing or
 * the holding isn't an option.
 */
export function getOptionDisplay(h: Pick<SerializedHolding, "symbol" | "assetType">): {
  short: string;
  long: string;
  occ: string;
} | null {
  if (h.assetType !== "OPTION") return null;
  const parsed = tryParseOccSymbol(h.symbol);
  if (!parsed) {
    return { short: h.symbol, long: h.symbol, occ: h.symbol };
  }
  return {
    short: formatOptionShort(parsed),
    long: formatOptionLabel(parsed),
    occ: parsed.occSymbol,
  };
}
