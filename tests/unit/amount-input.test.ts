import { describe, it, expect } from "vitest";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";

describe("maskAmountInput", () => {
  it("groups the integer part with thousands separators", () => {
    expect(maskAmountInput("1234")).toBe("1,234");
    expect(maskAmountInput("1234567")).toBe("1,234,567");
  });

  it("preserves an in-progress trailing decimal point", () => {
    expect(maskAmountInput("1234.")).toBe("1,234.");
    expect(maskAmountInput("1234.5")).toBe("1,234.5");
  });

  it("strips existing grouping commas before re-masking", () => {
    expect(maskAmountInput("1,234,567")).toBe("1,234,567");
  });

  it("returns an empty string for empty input", () => {
    expect(maskAmountInput("")).toBe("");
  });

  it("returns null for non-numeric input so the keystroke can be ignored", () => {
    expect(maskAmountInput("12a")).toBeNull();
    expect(maskAmountInput("abc")).toBeNull();
    expect(maskAmountInput("1.2.3")).toBeNull();
  });
});

describe("parseAmountInput", () => {
  it("strips commas and parses to a number", () => {
    expect(parseAmountInput("1,234.5")).toBe(1234.5);
    expect(parseAmountInput("1,000,000")).toBe(1000000);
  });

  it("returns NaN for blank or invalid input", () => {
    expect(parseAmountInput("")).toBeNaN();
    expect(parseAmountInput("abc")).toBeNaN();
  });
});

describe("formatAmountInput", () => {
  it("defaults to 2 fraction digits with thousands grouping", () => {
    expect(formatAmountInput(1234.5)).toBe("1,234.5");
    expect(formatAmountInput(1234.567)).toBe("1,234.57");
  });

  it("respects a custom maxFractionDigits", () => {
    expect(formatAmountInput(1.123456789, 6)).toBe("1.123457");
    expect(formatAmountInput(1.123456789, 8)).toBe("1.12345679");
  });

  it("formats integers with zero fraction digits", () => {
    expect(formatAmountInput(1234, 0)).toBe("1,234");
    expect(formatAmountInput(1234.9, 0)).toBe("1,235");
  });

  it("round-trips with parseAmountInput", () => {
    expect(parseAmountInput(formatAmountInput(1234567.89, 2))).toBe(1234567.89);
  });
});
