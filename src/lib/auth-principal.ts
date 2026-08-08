import "server-only";

import { isPublicDemoEnabled } from "@/lib/env";
import { prisma } from "@/lib/prisma";

export type AuthPrincipal =
  | { kind: "formal"; userId: string }
  | { kind: "demo"; userId: string; expiresAt: Date };

export type PrincipalResolution =
  | { status: "active"; principal: AuthPrincipal }
  | { status: "missing" }
  | { status: "demo-expired"; userId: string }
  | { status: "demo-disabled"; userId: string };

export async function resolvePrincipal(
  userId: string,
  now: Date = new Date(),
): Promise<PrincipalResolution> {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: {
      id: true,
      demoWorkspace: { select: { expiresAt: true } },
    },
  });

  if (!user) return { status: "missing" };
  if (!user.demoWorkspace) {
    return { status: "active", principal: { kind: "formal", userId } };
  }
  if (!isPublicDemoEnabled) return { status: "demo-disabled", userId };
  if (now >= user.demoWorkspace.expiresAt) return { status: "demo-expired", userId };

  return {
    status: "active",
    principal: {
      kind: "demo",
      userId,
      expiresAt: user.demoWorkspace.expiresAt,
    },
  };
}
