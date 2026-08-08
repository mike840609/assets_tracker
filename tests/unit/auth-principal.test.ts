import { beforeEach, describe, expect, it, vi } from "vitest";
import { resolvePrincipal } from "@/lib/auth-principal";

const now = new Date("2026-08-01T00:00:00.000Z");
const mocks = vi.hoisted(() => ({
  publicDemoEnabled: true,
  userFindUnique: vi.fn(),
}));

vi.mock("@/lib/env", () => ({
  get isPublicDemoEnabled() {
    return mocks.publicDemoEnabled;
  },
}));

vi.mock("@/lib/prisma", () => ({
  prisma: { user: { findUnique: mocks.userFindUnique } },
}));

describe("authoritative auth principal resolution", () => {
  beforeEach(() => {
    mocks.publicDemoEnabled = true;
    mocks.userFindUnique.mockReset();
  });

  it("returns missing when the session user no longer exists", async () => {
    mocks.userFindUnique.mockResolvedValue(null);

    await expect(resolvePrincipal("missing", now)).resolves.toEqual({ status: "missing" });
  });

  it("resolves a user without DemoWorkspace as formal", async () => {
    mocks.userFindUnique.mockResolvedValue({ id: "formal", demoWorkspace: null });

    await expect(resolvePrincipal("formal", now)).resolves.toEqual({
      status: "active",
      principal: { kind: "formal", userId: "formal" },
    });
  });

  it("resolves an unexpired DemoWorkspace as Demo using the database expiry", async () => {
    const expiresAt = new Date(now.getTime() + 1);
    mocks.userFindUnique.mockResolvedValue({
      id: "demo",
      demoWorkspace: { expiresAt },
    });

    await expect(resolvePrincipal("demo", now)).resolves.toEqual({
      status: "active",
      principal: { kind: "demo", userId: "demo", expiresAt },
    });
  });

  it("treats the exact expiry instant as expired", async () => {
    mocks.userFindUnique.mockResolvedValue({
      id: "demo",
      demoWorkspace: { expiresAt: now },
    });

    await expect(resolvePrincipal("demo", now)).resolves.toEqual({
      status: "demo-expired",
      userId: "demo",
    });
  });

  it("returns demo-disabled before authorizing an active Demo when the kill switch is off", async () => {
    mocks.publicDemoEnabled = false;
    mocks.userFindUnique.mockResolvedValue({
      id: "demo",
      demoWorkspace: { expiresAt: new Date(now.getTime() + 1) },
    });

    await expect(resolvePrincipal("demo", now)).resolves.toEqual({
      status: "demo-disabled",
      userId: "demo",
    });
  });
});
