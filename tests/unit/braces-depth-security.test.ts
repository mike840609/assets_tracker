import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";

const appRequire = createRequire(import.meta.url);
const eslintConfig = appRequire.resolve("eslint-config-next");
const nextPlugin = appRequire.resolve("@next/eslint-plugin-next", {
  paths: [dirname(eslintConfig)],
});
const fastGlob = appRequire.resolve("fast-glob", { paths: [dirname(nextPlugin)] });
const micromatch = appRequire.resolve("micromatch", { paths: [dirname(fastGlob)] });
const bracesPath = appRequire.resolve("braces", { paths: [dirname(micromatch)] });
const braces = createRequire(bracesPath)(bracesPath) as (
  pattern: string,
  options?: { expand?: boolean },
) => string[];

describe("braces nesting depth protection", () => {
  it.each([false, true])(
    "rejects depth above the parser limit before recursive walking (expand=%s)",
    (expand) => {
      const depth = 101;
      const pattern = `${"{".repeat(depth)}x${"}".repeat(depth)}`;

      expect(pattern.length).toBeLessThan(10_000);
      expect(() => braces(pattern, { expand })).toThrow(/max brace nesting depth/i);
    },
  );

  it("accepts patterns at the depth limit", () => {
    const depth = 100;
    const pattern = `${"{".repeat(depth)}x${"}".repeat(depth)}`;

    expect(() => braces(pattern)).not.toThrow();
  });
});
