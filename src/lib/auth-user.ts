import "server-only";
import { prisma } from "@/lib/prisma";

export async function userExists(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true },
  });

  return Boolean(user);
}
