import { describe, expect, it } from "vitest";
import { updateSettingsSchema } from "@/lib/validators";

describe("secondary currency settings", () => {
  it("accepts a selected currency or null to disable it", () => {
    expect(updateSettingsSchema.parse({ secondaryCurrency: "JPY" }).secondaryCurrency).toBe("JPY");
    expect(updateSettingsSchema.parse({ secondaryCurrency: null }).secondaryCurrency).toBeNull();
  });
});
