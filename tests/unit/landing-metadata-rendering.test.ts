import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const landingPageSource = fs.readFileSync(
  path.join(process.cwd(), "src/app/landing/page.tsx"),
  "utf8",
);

describe("landing metadata rendering", () => {
  it("keeps request-bound locale reads out of the Next metadata resume path", () => {
    expect(landingPageSource).toContain("export const metadata: Metadata");
    expect(landingPageSource).not.toContain("export async function generateMetadata");
    expect(landingPageSource).toContain("async function LandingDocumentMetadata()");
    expect(landingPageSource).toContain('getTranslations("landing")');
    expect(landingPageSource).toContain("getLocale()");
    expect(landingPageSource).toContain("<title>{title}</title>");
    expect(landingPageSource).toContain('<meta name="description" content={description} />');
  });
});
