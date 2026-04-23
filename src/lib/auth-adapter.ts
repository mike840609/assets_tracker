import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

type ProviderAccountId = { provider: string; providerAccountId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, unknown> & { [key: string]: any };

export const customPrismaAdapter = {
  ...PrismaAdapter(prisma),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  linkAccount: (data: AnyRecord) => prisma.authAccount.create({ data: data as any }) as any,
  unlinkAccount: (provider_providerAccountId: ProviderAccountId) =>
    prisma.authAccount.delete({
      where: { provider_providerAccountId },
    }),
  getAccount: (providerAccountId: string, provider: string) =>
    prisma.authAccount.findUnique({
      where: { provider_providerAccountId: { providerAccountId, provider } },
    }),
  getUserByAccount: async (provider_providerAccountId: ProviderAccountId) => {
    const account = await prisma.authAccount.findUnique({
      where: { provider_providerAccountId },
      select: { user: true },
    });
    return account?.user ?? null;
  },
};
