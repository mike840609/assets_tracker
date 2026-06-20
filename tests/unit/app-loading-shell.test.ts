import { createElement } from "react";
import { renderToStaticMarkup } from "react-dom/server";
import { describe, expect, it } from "vitest";
import { AppLoadingShell } from "@/components/layout/app-loading-shell";

describe("AppLoadingShell", () => {
  it("renders a private-data-free shell and preserves nested fallback content", () => {
    const html = renderToStaticMarkup(
      createElement(AppLoadingShell, null, createElement("span", null, "route fallback")),
    );

    expect(html).toContain('data-app-loading-shell="true"');
    expect(html).toContain('aria-hidden="true"');
    expect(html).toContain("route fallback");
    expect(html).not.toContain("net-worth-card");
  });
});
