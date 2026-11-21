import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

const MOBILE_TOUCH_TARGET = [
  "max-md:min-h-11",
  "max-md:min-w-11",
  "pointer-coarse:min-h-11",
  "pointer-coarse:min-w-11",
] as const;

describe("calendar mobile touch targets", () => {
  it("expands a compact button when mobileTouch is enabled", () => {
    const classes = buttonVariants({ size: "icon-xs", mobileTouch: true });

    for (const className of MOBILE_TOUCH_TARGET) {
      expect(classes.split(" ")).toContain(className);
    }
  });

  it("defaults to touch sizing for standard buttons with a compact opt-out", () => {
    const standard = buttonVariants().split(" ");
    const compact = buttonVariants({ size: "xs" }).split(" ");
    const optedOut = buttonVariants({ mobileTouch: false }).split(" ");

    for (const className of MOBILE_TOUCH_TARGET) {
      expect(standard).toContain(className);
      expect(compact).not.toContain(className);
      expect(optedOut).not.toContain(className);
    }
  });

  it.each([
    ["toolbar", "src/components/calendar/calendar-view.tsx", 6],
    ["agenda", "src/components/calendar/calendar-day-agenda.tsx", 4],
  ])("applies the mobile target to every named %s action", (_, relativePath, expectedCount) => {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    // Links styled as buttons use buttonVariants() directly instead of <Button>.
    const actionCount = source.match(/<Button\b|buttonVariants\(/g)?.length ?? 0;
    const mobileTouchCount = source.match(/\bmobileTouch\b/g)?.length ?? 0;

    expect(actionCount).toBe(expectedCount);
    expect(mobileTouchCount).toBe(actionCount);
  });

  it.each(["AlertDialogCancel", "AlertDialogAction"])(
    "keeps the delete-confirmation %s touch-safe on mobile and compact on desktop",
    (componentName) => {
      const source = readFileSync(
        join(process.cwd(), "src/components/calendar/calendar-day-agenda.tsx"),
        "utf8",
      );
      const props = source.match(new RegExp(`<${componentName}\\b([\\s\\S]*?)>`))?.[1];

      expect(props).toContain("min-h-11");
      expect(props).toContain("md:min-h-0");
    },
  );

  it("keeps calendar form category options touch-safe on mobile and compact on desktop", () => {
    const source = readFileSync(
      join(process.cwd(), "src/components/calendar/calendar-entry-form.tsx"),
      "utf8",
    );
    const optionProps = source.match(
      /<SelectItem\s+key=\{value\}\s+value=\{value\}([\s\S]*?)>/,
    )?.[1];

    expect(optionProps).toContain("min-h-11");
    expect(optionProps).toContain("md:min-h-0");
  });
});
