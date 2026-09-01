import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const enMessages = JSON.parse(readFileSync("messages/en-US.json", "utf8"));
const zhMessages = JSON.parse(readFileSync("messages/zh-TW.json", "utf8"));

describe("deleted-account disclosure on /analysis", () => {
  it("renders a muted note in the composition section, gated on the range flag", () => {
    const source = readFileSync("src/components/analysis/analysis-view.tsx", "utf8");

    expect(source).toContain("{series.hasUnattributedAccounts && (");
    expect(source).toContain('{t("unattributedAccountsNote")}');
    // Muted body text, no new colour token (DESIGN.md).
    expect(source).toContain('className="mt-1 max-w-prose text-xs text-muted-foreground"');
  });

  it("ships the note in both locales", () => {
    expect(typeof enMessages.analysis.unattributedAccountsNote).toBe("string");
    expect(enMessages.analysis.unattributedAccountsNote.length).toBeGreaterThan(0);
    expect(typeof zhMessages.analysis.unattributedAccountsNote).toBe("string");
    expect(zhMessages.analysis.unattributedAccountsNote.length).toBeGreaterThan(0);
    expect(zhMessages.analysis.unattributedAccountsNote).not.toBe(
      enMessages.analysis.unattributedAccountsNote,
    );
  });

  it("keeps the analysis namespace on the client boundary", () => {
    const source = readFileSync("src/app/(main)/analysis/page.tsx", "utf8");
    expect(source).toContain('"analysis"');
    expect(source).toContain("pickMessages(messages, CLIENT_NAMESPACES)");
  });
});
