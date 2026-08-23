import { describe, expect, it } from "vitest";
import { applyPullTransform, dampedPull } from "@/components/layout/pull-to-refresh";

function createElement() {
  return { style: {} } as unknown as HTMLElement;
}

describe("dampedPull", () => {
  it("returns 0 for negative delta", () => {
    expect(dampedPull(-10)).toBe(0);
  });

  it("returns half delta when below max", () => {
    expect(dampedPull(100)).toBe(50);
  });

  it("caps at MAX_PULL", () => {
    expect(dampedPull(500)).toBe(120);
  });
});

describe("applyPullTransform", () => {
  it("resets elements when idle", () => {
    const mainElement = createElement();
    const indicatorElement = createElement();

    applyPullTransform(mainElement, indicatorElement, 0, false);

    expect(mainElement.style.transform).toBe("");
    expect(indicatorElement.style.opacity).toBe("0");
    expect(indicatorElement.style.transform).toBe("translate(-50%, 0px)");
  });

  it("applies drag offset and indicator progress", () => {
    const mainElement = createElement();
    const indicatorElement = createElement();

    applyPullTransform(mainElement, indicatorElement, 50, false);

    expect(mainElement.style.transform).toBe("translateY(50px)");
    expect(indicatorElement.style.opacity).toBe(String(50 / 70));
    expect(indicatorElement.style.transform).toBe("translate(-50%, 6px)");
  });

  it("clamps main transform and shows the refreshing pose", () => {
    const mainElement = createElement();
    const indicatorElement = createElement();

    applyPullTransform(mainElement, indicatorElement, 200, true);

    expect(mainElement.style.transform).toBe("translateY(52px)");
    expect(indicatorElement.style.opacity).toBe("1");
    expect(indicatorElement.style.transform).toBe("translate(-50%, 8px)");
  });
});
