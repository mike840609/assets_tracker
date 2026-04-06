import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { auth } from "@/auth";
import { dataImportSchema } from "@/lib/validators";

export async function GET() {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const data = await prisma.user.findUnique({
      where: { id: userId },
      include: {
        appSettings: true,
        appAccounts: {
          include: {
            holdings: {
              include: {
                transactions: true,
              },
            },
            cashTransactions: true,
          },
        },
        snapshots: true,
      },
    });

    if (!data) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const exportData = {
      version: "1.0",
      exportedAt: new Date().toISOString(),
      settings: data.appSettings,
      accounts: data.appAccounts,
      snapshots: data.snapshots,
    };

    return NextResponse.json(exportData, {
      headers: {
        "Content-Disposition": `attachment; filename="asset-tracker-backup-${new Date().toISOString().split('T')[0]}.json"`,
      },
    });
  } catch (error) {
    console.error("Export error:", error);
    return NextResponse.json({ error: "Failed to export data" }, { status: 500 });
  }
}

export async function POST(request: Request) {
  const session = await auth();
  if (!session?.user?.id) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const userId = session.user.id;

  try {
    const body = await request.json();
    const parsed = dataImportSchema.safeParse(body);

    if (!parsed.success) {
      console.error("Validation error:", parsed.error.format());
      return NextResponse.json(
        { 
          error: "Invalid data format", 
          details: parsed.error.issues.map((e: any) => `${e.path.join('.')}: ${e.message}`).join(', ')
        }, 
        { status: 400 }
      );
    }

    const importData = parsed.data;

    await prisma.$transaction(async (tx) => {
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

            // Holding Transactions
            if (Array.isArray(h.transactions) && h.transactions.length > 0) {
              await tx.holdingTransaction.createMany({
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
    }, {
      timeout: 30000, // Increase timeout for potentially large imports
    });

    return NextResponse.json({ ok: true });
  } catch (error) {
    console.error("Import error:", error);
    return NextResponse.json(
      { error: error instanceof Error ? error.message : "Failed to import data" },
      { status: 500 }
    );
  }
}
