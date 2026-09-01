import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const cardSource = readFileSync("src/components/ui/card.tsx", "utf8");
const netWorthCardSource = readFileSync("src/components/dashboard/net-worth-card.tsx", "utf8");

describe("dashboard card styling", () => {
  it("uses a HeroUI-inspired surface, hairline border, and resting shadow", () => {
    expect(cardSource).toContain("border border-border/60");
    expect(cardSource).toContain("bg-card");
    expect(cardSource).toContain("shadow-sm");
    expect(cardSource).not.toContain("ring-1 ring-foreground/10");
  });

  it("keeps the net-worth hero gradient free of the old glass utility", () => {
    expect(netWorthCardSource).toContain("card-gradient");
    expect(netWorthCardSource).not.toContain("glass card-gradient");
  });
});
