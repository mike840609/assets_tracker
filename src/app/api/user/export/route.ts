import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { failure } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

export const POST = withAuth(async (_req, _ctx, userId) => {
  try {
    const data = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        appSettings: true,
        appAccounts: {
          include: {
            holdings: { include: { transactions: true } },
            cashTransactions: true,
          },
        },
        snapshots: true,
      },
    });

    if (!data) return failure("User not found", 404);

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      settings: data.appSettings,
      accounts: data.appAccounts,
      snapshots: data.snapshots,
    };

    // Return as a raw JSON file download
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="gdpr-export-${new Date().toISOString().split("T")[0]}.json"`,
        "Content-Type": "application/json",
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return failure("Failed to export data", 500);
  }
});
