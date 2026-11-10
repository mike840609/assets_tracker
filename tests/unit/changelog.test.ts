import { describe, expect, it } from "vitest";
import packageJson from "../../package.json";
import { APP_VERSION, CHANGELOG, type ChangeEntry, type Release } from "@/lib/changelog";
import { SUPPORTED_LOCALES } from "@/i18n/config";

type LocalizedText = Release["summary"];

function expectAllLocales(text: LocalizedText, label: string) {
  if (typeof text !== "object" || text === null) return;

  for (const locale of SUPPORTED_LOCALES) {
    expect(text[locale], `Missing ${locale} text for ${label}`).toEqual(expect.any(String));
    expect(text[locale], `Empty ${locale} text for ${label}`).not.toBe("");
  }
}

describe("release metadata", () => {
  it("keeps the application, changelog, and package versions aligned", () => {
    expect(APP_VERSION).toBe(CHANGELOG[0].version);
    expect(packageJson.version).toBe(APP_VERSION);
  });

  it("localizes every summary and change into all supported locales", () => {
    for (const release of CHANGELOG) {
      expectAllLocales(release.summary, `${release.version} summary`);

      for (const [index, change] of release.changes.entries()) {
        expectAllLocales(change.text, `${release.version} change ${index + 1}`);
      }
    }
  });

  it("keeps change types within the documented set", () => {
    const validTypes = new Set<ChangeEntry["type"]>(["added", "improved", "fixed"]);

    for (const release of CHANGELOG) {
      for (const change of release.changes) {
        expect(validTypes.has(change.type), `Unknown type in ${release.version}`).toBe(true);
      }
    }
  });
});
