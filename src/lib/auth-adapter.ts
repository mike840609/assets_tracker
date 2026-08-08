import "server-only";
import { PrismaAdapter } from "@auth/prisma-adapter";
import { prisma } from "./prisma";

type ProviderAccountId = { provider: string; providerAccountId: string };

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AnyRecord = Record<string, unknown> & { [key: string]: any };

export const customPrismaAdapter = {
  ...PrismaAdapter(prisma),
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  createUser: async (data: any) => {
    return prisma.$transaction(async (tx) => {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const user = await tx.user.create({ data: data as any });
      await tx.setting.create({
        data: {
          userId: user.id,
          locale: "en-US",
          baseCurrency: "USD",
        },
      });
      return user;
    });
  },
  linkAccount: async (data: AnyRecord) => {
    const demoWorkspace = await prisma.demoWorkspace.findUnique({
      where: { userId: data.userId },
      select: { userId: true },
    });
    if (demoWorkspace) {
      throw new Error("auth: refusing to link an account to a Demo user");
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    return prisma.authAccount.create({ data: data as any }) as any;
  },
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
