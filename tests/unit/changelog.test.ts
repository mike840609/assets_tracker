import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION, CHANGELOG } from "@/lib/changelog";

describe("release metadata", () => {
  it("keeps the application, changelog, and package versions aligned", () => {
    expect(APP_VERSION).toBe(CHANGELOG[0].version);
    expect(packageJson.version).toBe(APP_VERSION);
  });
});
