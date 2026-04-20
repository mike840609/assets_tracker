import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

export const customPrismaAdapter = {
  ...PrismaAdapter(prisma),
  linkAccount: (data: any) => prisma.authAccount.create({ data }) as any,
  unlinkAccount: (provider_providerAccountId: any) =>
    prisma.authAccount.delete({
      where: { provider_providerAccountId },
    }) as any,
  getAccount: (providerAccountId: string, provider: string) =>
    prisma.authAccount.findUnique({
      where: { provider_providerAccountId: { providerAccountId, provider } },
    }) as any,
  getUserByAccount: async (provider_providerAccountId: any) => {
    const account = await prisma.authAccount.findUnique({
      where: { provider_providerAccountId },
      select: { user: true },
    });
    return account?.user ?? null;
  },
};
