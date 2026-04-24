import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { dataImportSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

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
    console.error("Export error:", error);
    return failure("Failed to export data", 500);
  }
});

export const POST = withAuth(async (request, _ctx, userId) => {
  try {
    const body = await request.json();
    const parsed = dataImportSchema.safeParse(body);

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.format());
      return validationError(parsed.error);
    }

    const importData = parsed.data;

    await prisma.$transaction(async (tx) => {
      // 1. Upsert settings if present
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

      // 2. Load existing accounts once so the loop doesn't re-query
      const existingAccounts = await tx.account.findMany({
        where: { userId },
        select: {
          id: true,
          name: true,
          currency: true,
          holdings: { select: { id: true, symbol: true } },
        },
      });
      const accountMap = new Map(
        existingAccounts.map((a) => [`${a.name}::${a.currency}`, a])
      );

      // 3. Merge accounts, holdings, and transactions
      for (const acc of importData.accounts) {
        const key = `${acc.name}::${acc.currency}`;
        const existing = accountMap.get(key);
        const isNewAccount = !existing;
        let accountId: string;

        if (isNewAccount) {
          const created = await tx.account.create({
            data: {
              userId,
              name: acc.name,
              type: acc.type,
              category: acc.category,
              currency: acc.currency,
              cashBalance: acc.cashBalance,
              isActive: acc.isActive,
              ...(acc.createdAt ? { createdAt: new Date(acc.createdAt) } : {}),
            },
          });
          accountId = created.id;
        } else {
          // Update mutable fields on existing account; preserve name/currency
          await tx.account.update({
            where: { id: existing.id },
            data: {
              type: acc.type,
              category: acc.category,
              cashBalance: acc.cashBalance,
              isActive: acc.isActive,
            },
          });
          accountId = existing.id;
        }

        // Holdings
        if (Array.isArray(acc.holdings)) {
          const existingHoldingMap = new Map(
            (existing?.holdings ?? []).map((h) => [h.symbol, h])
          );

          for (const h of acc.holdings) {
            const existingHolding = existingHoldingMap.get(h.symbol);

            if (!existingHolding) {
              // New holding — create with its full transaction history
              const newHolding = await tx.holding.create({
                data: {
                  accountId,
                  symbol: h.symbol,
                  name: h.name,
                  quantity: h.quantity,
                  currency: h.currency,
                  assetType: h.assetType,
                  ...(h.createdAt ? { createdAt: new Date(h.createdAt) } : {}),
                },
              });

              if (Array.isArray(h.transactions) && h.transactions.length > 0) {
                // eslint-disable-next-line @typescript-eslint/no-explicit-any
                await tx.holdingTransaction.createMany({
                  data: h.transactions.map((t: any) => ({
                    holdingId: newHolding.id,
                    type: t.type,
                    quantity: t.quantity,
                    note: t.note ?? null,
                    ...(t.createdAt ? { createdAt: new Date(t.createdAt) } : {}),
                  })),
                });
              }
            } else {
              // Existing holding — update quantity/metadata only.
              // Transactions are intentionally left untouched to avoid duplicates.
              await tx.holding.update({
                where: { id: existingHolding.id },
                data: {
                  name: h.name,
                  quantity: h.quantity,
                  currency: h.currency,
                  assetType: h.assetType,
                },
              });
            }
          }
        }

        // Cash transactions — only inserted for new accounts; adding them to
        // existing accounts would duplicate every transaction on re-import.
        if (
          isNewAccount &&
          Array.isArray(acc.cashTransactions) &&
          acc.cashTransactions.length > 0
        ) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.cashTransaction.createMany({
            data: acc.cashTransactions.map((t: any) => ({
              accountId,
              type: t.type,
              amount: t.amount,
              note: t.note ?? null,
              ...(t.createdAt ? { createdAt: new Date(t.createdAt) } : {}),
            })),
          });
        }
      }

      // 4. Upsert snapshots by (userId, date, baseCurrency)
      if (Array.isArray(importData.snapshots) && importData.snapshots.length > 0) {
        for (const s of importData.snapshots) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any
          await tx.netWorthSnapshot.upsert({
            where: {
              userId_date_baseCurrency: {
                userId,
                date: new Date(s.date),
                baseCurrency: s.baseCurrency,
              },
            },
            update: {
              totalAssets: s.totalAssets,
              totalLiabilities: s.totalLiabilities,
              netWorth: s.netWorth,
              breakdown: (s as any).breakdown ?? null,
            },
            create: {
              userId,
              date: new Date(s.date),
              totalAssets: s.totalAssets,
              totalLiabilities: s.totalLiabilities,
              netWorth: s.netWorth,
              baseCurrency: s.baseCurrency,
              breakdown: (s as any).breakdown ?? null,
              ...(s.createdAt ? { createdAt: new Date(s.createdAt) } : {}),
            },
          });
        }
      }
    }, { timeout: 30000 });

    return ok({ ok: true });
  } catch (error) {
    console.error("Import error:", error);
    return failure("Failed to import data", 500);
  }
});
