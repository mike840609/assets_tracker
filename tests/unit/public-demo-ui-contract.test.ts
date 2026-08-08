import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const root = resolve(import.meta.dirname, "../..");
const read = (path: string) => readFileSync(resolve(root, path), "utf8");
const between = (source: string, start: string, end: string) => {
  const startIndex = source.indexOf(start);
  const endIndex = source.indexOf(end, startIndex);
  return source.slice(startIndex, endIndex);
};

describe("public Demo shell contract", () => {
  it("passes authoritative Demo state into Settings cards and client messages", () => {
    const settingsPage = read("src/app/(main)/settings/page.tsx");

    expect(settingsPage).toContain("const isDemo = session.user.isDemo;");
    expect(settingsPage).toContain("isDemo={isDemo}");
    expect(settingsPage).toContain("<DataManagement isDemo={isDemo} />");
    expect(settingsPage).toContain('"demo"');
  });

  it("replaces Demo security and backup controls without removing privacy mode", () => {
    const privacySecurity = read("src/components/settings/privacy-security.tsx");
    const demoBranch = between(privacySecurity, "{isDemo ? (", ") : (");

    expect(privacySecurity).toContain("isDemo ? (");
    expect(demoBranch).toContain('href="/login?from=demo"');
    expect(demoBranch).toContain('t("demo.exit")');
    expect(demoBranch).toContain('t("demo.signIn")');
    expect(demoBranch).toContain('t("demo.temporarySessionTitle")');
    expect(demoBranch).not.toContain("sessionDescriptionWithEmail");
    expect(demoBranch).not.toContain("exportBackupAction");
    expect(privacySecurity).toContain("FormalSessionAndBackupRows");
    expect(privacySecurity).toContain("PrivacySecurityProps");
    expect(privacySecurity).toContain("privacyMode, togglePrivacyMode");
    expect(privacySecurity.indexOf("privacyMode, togglePrivacyMode")).toBeLessThan(
      privacySecurity.indexOf("{isDemo ? ("),
    );
  });

  it("keeps Demo data management free of import controls and fetches", () => {
    const dataManagement = read("src/components/settings/data-management.tsx");
    const demoComponent = between(
      dataManagement,
      "function DemoDataManagement()",
      "function FormalDataManagement()",
    );

    expect(dataManagement).toContain("function DemoDataManagement()");
    expect(demoComponent).toContain('href="/login?from=demo"');
    expect(demoComponent).not.toContain('type="file"');
    expect(demoComponent).not.toContain("fetch(");
    expect(dataManagement).toContain("function FormalDataManagement()");
    expect(dataManagement).toContain('type="file"');
    expect(dataManagement).toContain('fetch("/api/settings/data"');
  });

  it("propagates Demo state to recurring rules while leaving rule editors mounted", () => {
    const accountPage = read("src/app/(main)/accounts/[id]/page.tsx");
    const accountDetail = read("src/components/accounts/account-detail.tsx");
    const recurringSection = read("src/components/accounts/recurring-section.tsx");

    expect(accountPage).toContain("isDemo={session.user.isDemo}");
    expect(accountDetail).toContain("isDemo?: boolean;");
    expect(accountDetail).toContain("isDemo={isDemo}");
    expect(recurringSection).toContain("isDemo?: boolean;");
    expect(recurringSection).toContain('t("demoPausedTitle")');
    expect(recurringSection).toContain('t("demoPausedDescription")');
    expect(recurringSection).toContain("<RecurringInvestments");
    expect(recurringSection).toContain("<RecurringCashTransactions");
  });

  it("provides Demo Settings and recurring explanations in both locales", () => {
    const en = JSON.parse(read("messages/en-US.json")) as {
      settings: { demo: Record<string, unknown> };
      dataManagement: Record<string, unknown>;
      recurring: Record<string, unknown>;
    };
    const zh = JSON.parse(read("messages/zh-TW.json")) as typeof en;

    expect(en.settings.demo.temporarySessionTitle).toBeDefined();
    expect(en.settings.demo.backupRequiresAccount).toBeDefined();
    expect(en.dataManagement.demoTitle).toBeDefined();
    expect(en.dataManagement.demoDescription).toBeDefined();
    expect(en.dataManagement.demoAction).toBeDefined();
    expect(en.recurring.demoPausedTitle).toBeDefined();
    expect(en.recurring.demoPausedDescription).toBeDefined();
    expect(zh.settings.demo.temporarySessionTitle).toBeDefined();
    expect(zh.settings.demo.backupRequiresAccount).toBeDefined();
    expect(zh.dataManagement.demoTitle).toBeDefined();
    expect(zh.dataManagement.demoDescription).toBeDefined();
    expect(zh.dataManagement.demoAction).toBeDefined();
    expect(zh.recurring.demoPausedTitle).toBeDefined();
    expect(zh.recurring.demoPausedDescription).toContain("可以編輯");
    expect(zh.recurring.demoPausedDescription).toContain("不會自動執行");
  });

  it("keeps reset, sign-in, confirmation, expiry, and stale-entity recovery in the banner", () => {
    const source = read("src/components/demo/demo-mode-banner.tsx");

    expect(source).toContain("AlertDialog");
    expect(source).toContain("resetPublicDemoAction");
    expect(source).toContain('href="/login?from=demo"');
    expect(source).toContain("exitPublicDemoAction");
    expect(source).toContain('aria-live="polite"');
    expect(source).toContain('router.replace("/demo/expired")');
    expect(source).toContain('router.replace("/")');
    expect(source).toContain("router.refresh()");
  });

  it("renders a deterministic placeholder before browser-local time is available", () => {
    const source = read("src/components/demo/demo-mode-banner.tsx");

    expect(source).toContain("useState<number | null>(null)");
    expect(source).toContain("const [mounted, setMounted] = useState(false)");
    expect(source).toContain("setNow(Date.now())");
    expect(source).toContain("mounted && now !== null");
    expect(source).toContain('t("banner.loading")');
    expect(source).not.toContain("useState(() => Date.now())");
  });

  it("provides each Demo shell message namespace in both locales", () => {
    const en = JSON.parse(read("messages/en-US.json")) as { demo: Record<string, unknown> };
    const zh = JSON.parse(read("messages/zh-TW.json")) as { demo: Record<string, unknown> };
    const expectedKeys = ["login", "banner", "reset", "expired", "apiErrors"];

    expect(Object.keys(en.demo).sort()).toEqual(Object.keys(zh.demo).sort());
    for (const key of expectedKeys) {
      expect(en.demo[key]).toBeDefined();
      expect(zh.demo[key]).toBeDefined();
    }
  });

  it("discloses the temporary public Demo lifecycle in both privacy locales", () => {
    const privacyPage = read("src/app/privacy/page.tsx");
    const en = JSON.parse(read("messages/en-US.json")) as {
      privacy: Record<string, string>;
    };
    const zh = JSON.parse(read("messages/zh-TW.json")) as typeof en;

    expect(privacyPage).toContain('title: t("section9Title")');
    expect(privacyPage).toContain('body: t("section9Body")');
    expect(privacyPage).toContain("[...Array(9)]");
    expect(en.privacy.section9Title).toBeDefined();
    expect(en.privacy.section9Body).toContain("asset-tracker-demo-visitor");
    expect(en.privacy.section9Body).toContain("24 hours");
    expect(en.privacy.section9Body).toContain("raw IP");
    expect(en.privacy.section9Body).toContain("formal account");
    expect(zh.privacy.section9Title).toBeDefined();
    expect(zh.privacy.section9Body).toContain("asset-tracker-demo-visitor");
    expect(zh.privacy.section9Body).toContain("24 小時");
    expect(zh.privacy.section9Body).toContain("原始 IP");
    expect(zh.privacy.section9Body).toContain("正式帳號");
  });
});
