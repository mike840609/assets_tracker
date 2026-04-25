import { prisma } from "@/lib/prisma";
import { failure, ok } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

export const DELETE = withAuth(async (_req, _ctx, userId) => {
  try {
    // Prisma's onDelete: Cascade handles the related tables 
    // (Account, Holding, Transactions, Settings, Snapshots, AuthAccount, Session)
    await prisma.user.delete({
      where: { id: userId },
    });

    return ok({ success: true });
  } catch (error) {
    console.error("Account deletion error:", error);
    return failure("Failed to delete account", 500);
  }
});
