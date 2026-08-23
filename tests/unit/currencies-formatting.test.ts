import { describe, expect, it } from "vitest";
import { formatCurrency, formatPrice, formatQuantity, getCurrencySymbol } from "@/lib/currencies";

describe("currencies formatting", () => {
  describe("getCurrencySymbol", () => {
    it("returns correct symbols for known currencies", () => {
      expect(getCurrencySymbol("USD")).toBe("$");
      expect(getCurrencySymbol("EUR")).toBe("€");
      expect(getCurrencySymbol("TWD")).toBe("NT$");
      expect(getCurrencySymbol("UNKNOWN")).toBe("UNKNOWN");
    });
  });

  describe("formatCurrency", () => {
    it("defaults to 0 fraction digits for standard amounts (backward compatible)", () => {
      expect(formatCurrency(1250000, "USD")).toBe("$1,250,000");
      expect(formatCurrency(182.45, "USD")).toBe("$182");
      expect(formatCurrency(0, "USD")).toBe("$0");
      expect(formatCurrency(-5000, "USD")).toBe("-$5,000");
    });

    it("supports boolean compact flag (backward compatible)", () => {
      expect(formatCurrency(1000000, "USD", true)).toBe("$1M");
      expect(formatCurrency(1500000, "USD", { compact: true, maxDecimals: 1 })).toBe("$1.5M");
      expect(formatCurrency(500, "USD", true)).toBe("$500");
    });

    it("supports explicit decimals option", () => {
      expect(formatCurrency(182.45, "USD", { decimals: 2 })).toBe("$182.45");
      expect(formatCurrency(182, "USD", { decimals: 2 })).toBe("$182.00");
      expect(formatCurrency(0.456, "USD", { minDecimals: 2, maxDecimals: 4 })).toBe("$0.456");
    });

    it("supports custom locale option", () => {
      const formatted = formatCurrency(1250.5, "USD", { decimals: 2, locale: "de-DE" });
      // In German locale: 1.250,50 $ or 1.250,50 USD
      expect(formatted).toMatch(/1\.250,50/);
    });

    it("falls back gracefully when Intl throws", () => {
      expect(formatCurrency(100, "INVALID_CURRENCY_CODE")).toBe("INVALID_CURRENCY_CODE 100");
    });
  });

  describe("formatPrice", () => {
    it("formats standard equity prices (>= 100) with 2 decimal places", () => {
      expect(formatPrice(182.45, "USD")).toBe("$182.45");
      expect(formatPrice(182, "USD")).toBe("$182.00");
      expect(formatPrice(1250.8, "USD")).toBe("$1,250.80");
    });

    it("formats mid-range prices (1 <= price < 100) with 2 to 4 decimal places", () => {
      expect(formatPrice(3.5, "USD")).toBe("$3.50");
      expect(formatPrice(3.4567, "USD")).toBe("$3.4567");
      expect(formatPrice(2.3, "USD")).toBe("$2.30");
    });

    it("formats micro prices / crypto / penny stocks (< 1) with up to 6 decimal places without truncation to 0", () => {
      expect(formatPrice(0.45, "USD")).toBe("$0.45");
      expect(formatPrice(0.0456, "USD")).toBe("$0.0456");
      expect(formatPrice(0.001234, "USD")).toBe("$0.001234");
    });

    it("handles zero, null, and undefined values cleanly", () => {
      expect(formatPrice(0, "USD")).toBe("$0.00");
      expect(formatPrice(null, "USD")).toBe("—");
      expect(formatPrice(undefined, "USD")).toBe("—");
    });

    it("formats non-USD currencies correctly", () => {
      expect(formatPrice(500.5, "TWD")).toBe("NT$500.50");
      expect(formatPrice(120.75, "EUR")).toBe("€120.75");
    });
  });

  describe("formatQuantity", () => {
    it("formats crypto quantities with up to 7 decimals and options with 0", () => {
      expect(formatQuantity(1.2345678, "CRYPTO")).toBe("1.2345678");
      expect(formatQuantity(5, "OPTION")).toBe("5");
      expect(formatQuantity(100.5, "STOCK")).toBe("100.50");
    });
  });
});
