import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dataImportSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { log } from "@/lib/logger";

export const GET = withAuth(async (_req, _ctx, userId) => {
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

    // Return as a raw JSON file download — NOT wrapped in ok() so the blob
    // content matches the dataImportSchema format for round-trip import.
    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="assets-tracker-backup-${new Date().toISOString().split("T")[0]}.json"`,
      },
    });
  } catch (error) {
    log.error("export.failed", { error: String(error) });
    return failure("Failed to export data", 500);
  }
});

export const POST = withAuth(async (request, _ctx, userId) => {
  try {
    const body = await request.json();
    const parsed = dataImportSchema.safeParse(body);

    if (!parsed.success) {
      log.error("import.validation", { issues: parsed.error.format() });
      return validationError(parsed.error);
    }

    const importData = parsed.data;

    await prisma.$transaction(
      async (tx) => {
        // 1. Delete existing data for the user (Cascades should handle holdings and transactions)
        await tx.account.deleteMany({ where: { userId } });
        await tx.netWorthSnapshot.deleteMany({ where: { userId } });

        // 2. Import settings if present
        if (importData.settings) {
          await tx.setting.upsert({
            where: { userId },
            update: {
              baseCurrency: importData.settings.baseCurrency,
              locale: importData.settings.locale,
            },
            create: {
              userId,
              baseCurrency: importData.settings.baseCurrency,
              locale: importData.settings.locale,
            },
          });
        }

        // 3. Import accounts & their relations
        for (const acc of importData.accounts) {
          const newAccount = await tx.account.create({
            data: {
              userId,
              name: acc.name,
              type: acc.type,
              category: acc.category,
              currency: acc.currency,
              cashBalance: acc.cashBalance,
              isActive: acc.isActive,
              createdAt: acc.createdAt,
              updatedAt: acc.updatedAt,
            },
          });

          // Holdings
          if (Array.isArray(acc.holdings)) {
            for (const h of acc.holdings) {
              const newHolding = await tx.holding.create({
                data: {
                  accountId: newAccount.id,
                  symbol: h.symbol,
                  name: h.name,
                  quantity: h.quantity,
                  currency: h.currency,
                  assetType: h.assetType,
                  createdAt: h.createdAt,
                  updatedAt: h.updatedAt,
                },
              });

              if (Array.isArray(h.transactions) && h.transactions.length > 0) {
                await tx.holdingTransaction.createMany({
                  // eslint-disable-next-line @typescript-eslint/no-explicit-any
                  data: h.transactions.map((t: any) => ({
                    holdingId: newHolding.id,
                    type: t.type,
                    quantity: t.quantity,
                    note: t.note,
                    createdAt: t.createdAt,
                  })),
                });
              }
            }
          }

          // Cash Transactions
          if (Array.isArray(acc.cashTransactions) && acc.cashTransactions.length > 0) {
            await tx.cashTransaction.createMany({
              // eslint-disable-next-line @typescript-eslint/no-explicit-any
              data: acc.cashTransactions.map((t: any) => ({
                accountId: newAccount.id,
                type: t.type,
                amount: t.amount,
                note: t.note,
                createdAt: t.createdAt,
              })),
            });
          }
        }

        // 4. Import snapshots
        if (Array.isArray(importData.snapshots) && importData.snapshots.length > 0) {
          await tx.netWorthSnapshot.createMany({
            // eslint-disable-next-line @typescript-eslint/no-explicit-any
            data: importData.snapshots.map((s: any) => ({
              userId,
              date: new Date(s.date),
              totalAssets: s.totalAssets,
              totalLiabilities: s.totalLiabilities,
              netWorth: s.netWorth,
              baseCurrency: s.baseCurrency,
              breakdown: s.breakdown,
              createdAt: s.createdAt,
            })),
          });
        }
      },
      { timeout: 30000 },
    );

    return ok({ ok: true });
  } catch (error) {
    log.error("import.failed", { error: String(error) });
    return failure(error instanceof Error ? error.message : "Failed to import data", 500);
  }
});
