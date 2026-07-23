import { readFileSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

import { buttonVariants } from "@/components/ui/button";

const MOBILE_TOUCH_TARGET = ["min-h-11", "min-w-11", "md:min-h-0", "md:min-w-0"] as const;

describe("calendar mobile touch targets", () => {
  it("provides an opt-in 44px mobile Button target with a desktop reset", () => {
    const classes = buttonVariants({ mobileTouch: true });

    for (const className of MOBILE_TOUCH_TARGET) {
      expect(classes.split(" ")).toContain(className);
    }
  });

  it.each([
    ["toolbar", "src/components/calendar/calendar-view.tsx"],
    ["agenda", "src/components/calendar/calendar-day-agenda.tsx"],
  ])("applies the mobile target to every named %s action", (_, relativePath) => {
    const source = readFileSync(join(process.cwd(), relativePath), "utf8");
    const actionCount = source.match(/<Button\b/g)?.length ?? 0;
    const mobileTouchCount = source.match(/\bmobileTouch\b/g)?.length ?? 0;

    expect(actionCount).toBe(4);
    expect(mobileTouchCount).toBe(actionCount);
  });

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
