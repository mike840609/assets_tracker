import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface User {
    isDemo?: boolean;
    demoExpiresAt?: string;
  }

  interface Session {
    user: Omit<NonNullable<DefaultSession["user"]>, "isDemo" | "demoExpiresAt"> & {
      id: string;
      isDemo: boolean;
      demoExpiresAt: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    isDemo?: boolean;
    demoExpiresAt?: string;
  }
}
