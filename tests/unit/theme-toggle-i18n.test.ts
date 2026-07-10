import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const en = JSON.parse(readFileSync("messages/en-US.json", "utf8"));
const zh = JSON.parse(readFileSync("messages/zh-TW.json", "utf8"));

describe("theme toggle i18n", () => {
  it("defines localized labels for every theme option", () => {
    expect(en.common.theme.light).toBe("Light");
    expect(en.common.theme.dark).toBe("Dark");
    expect(en.common.theme.system).toBe("System");
    expect(zh.common.theme.light).toBe("淺色");
    expect(zh.common.theme.dark).toBe("深色");
    expect(zh.common.theme.system).toBe("系統");
  });

  it("does not keep theme option labels hardcoded in the component", () => {
    const source = readFileSync("src/components/layout/theme-toggle.tsx", "utf8");

    expect(source).not.toContain('label: "Light"');
    expect(source).not.toContain('label: "Dark"');
    expect(source).not.toContain('label: "System"');
  });
});
