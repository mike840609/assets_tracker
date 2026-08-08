import { describe, expect, it } from "vitest";
import {
  DEMO_GLOBAL_LIMIT,
  DEMO_LIFETIME_MS,
  DEMO_MUTATION_LIFETIME_LIMIT,
  DEMO_MUTATION_WINDOW_LIMIT,
  DEMO_REFRESH_LIMIT,
  DEMO_RESET_LIMIT,
  DEMO_SOURCE_LIMIT,
  isValidDemoVisitorToken,
  resolvePublicDemoEnabled,
} from "@/lib/demo/demo-policy";

describe("public Demo policy", () => {
  it.each([undefined, "", "0", "false", "no", "off"])("defaults disabled for %s", (value) =>
    expect(resolvePublicDemoEnabled(value)).toBe(false),
  );

  it.each(["1", "true", "TRUE", "yes", "on"])("enables for %s", (value) => {
    expect(resolvePublicDemoEnabled(value)).toBe(true);
  });

  it("pins the approved resource limits", () => {
    expect(DEMO_LIFETIME_MS).toBe(86_400_000);
    expect(DEMO_SOURCE_LIMIT).toBe(5);
    expect(DEMO_GLOBAL_LIMIT).toBe(250);
    expect(DEMO_MUTATION_WINDOW_LIMIT).toBe(30);
    expect(DEMO_MUTATION_LIFETIME_LIMIT).toBe(250);
    expect(DEMO_RESET_LIMIT).toBe(3);
    expect(DEMO_REFRESH_LIMIT).toBe(3);
  });

  it("accepts only the two server-generated 256-bit visitor-token encodings", () => {
    expect(isValidDemoVisitorToken("a".repeat(64))).toBe(true);
    expect(isValidDemoVisitorToken("A".repeat(43))).toBe(true);
    expect(isValidDemoVisitorToken("")).toBe(false);
    expect(isValidDemoVisitorToken("predictable-token")).toBe(false);
  });
});
