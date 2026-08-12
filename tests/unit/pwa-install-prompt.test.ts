import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const source = readFileSync("src/components/layout/pwa-install-prompt.tsx", "utf8");

describe("PwaInstallPrompt toast wiring", () => {
  it("republishes until the lazily-mounted Toaster has rendered the toast", () => {
    // <Toaster> is a dynamic() import that can subscribe after
    // beforeinstallprompt fires, and Sonner never replays a dropped toast —
    // without this the install toast is silently discarded.
    expect(source).toContain("publishUntilRendered({");
    expect(source).toContain("`[data-sonner-toast].${TOAST_CLASS}`");
    expect(source).toContain("isCancelled: () => settled");
  });

  it("keeps a stable toast id so appinstalled can dismiss a live toast", () => {
    expect(source).toContain("id: TOAST_ID");
    expect(source).toContain("toast.dismiss(TOAST_ID)");
  });

  it("does not persist dismissal when the user opened the install prompt", () => {
    expect(source).toContain("if (installPromptStarted) return;");
  });

  it("scopes its action-button styling with a class, since globals.css wins on !important", () => {
    const css = readFileSync("src/app/globals.css", "utf8");

    expect(source).toContain('const TOAST_CLASS = "pwa-install-prompt"');
    expect(source).toContain("className: TOAST_CLASS");
    // Inline actionButtonStyle can never beat the !important shared rule.
    expect(source).not.toContain("actionButtonStyle");

    // Android-only toast, so the Install action must stay a thumb-sized target.
    const start = css.indexOf(".pwa-install-prompt [data-action]");
    const scoped = css.slice(start, css.indexOf("}", start));
    expect(scoped).toContain("min-height: 44px !important");
    expect(scoped).toContain("background: var(--primary) !important");
  });
});
