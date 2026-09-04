import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const landingPageSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/landing/page.tsx"),
  "utf8",
);

describe("landing metadata rendering", () => {
  it("keeps request-bound locale reads out of the metadata resume path", () => {
    expect(landingPageSource).toContain("export const metadata: Metadata");
    expect(landingPageSource).not.toContain("export async function generateMetadata");
    expect(landingPageSource).not.toContain('getTranslations("landing")');
    expect(landingPageSource).not.toContain("getLocale()");
  });
});
