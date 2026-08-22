import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

describe("StockTrackerView responsive row mounting", () => {
  it("mounts only the viewport-specific StockRow layout", () => {
    const source = readFileSync("src/components/stocks/stock-tracker-view.tsx", "utf8");
    const rowStart = source.indexOf("function StockRow(");
    const rowEnd = source.indexOf("function ReorderStockItem", rowStart);
    const rowSource = source.slice(rowStart, rowEnd);

    expect(rowSource).toContain("const isMobile = useIsMobile();");
    expect(rowSource).toContain("isMobile ? (");
    expect(rowSource).toContain("isMobile ? null : (");
  });
});
