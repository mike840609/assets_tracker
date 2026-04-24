import { prisma } from "@/lib/prisma";
import { dataImportSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

export interface ImportPreview {
  accounts: {
    new: string[];
    updated: string[];
    unchanged: string[];
  };
  holdings: {
    new: number;
    updated: number;
    unchanged: number;
  };
  snapshots: {
    new: number;
    unchanged: number;
  };
  totalChanges: number;
}

export const POST = withAuth(async (request, _ctx, userId) => {
  try {
    const body = await request.json();
    const parsed = dataImportSchema.safeParse(body);
    if (!parsed.success) return validationError(parsed.error);

    const importData = parsed.data;

    const [existingAccounts, existingSnapshots] = await Promise.all([
      prisma.account.findMany({
        where: { userId },
        select: {
          name: true,
          currency: true,
          type: true,
          category: true,
          isActive: true,
          holdings: { select: { symbol: true, quantity: true } },
        },
      }),
      prisma.netWorthSnapshot.findMany({
        where: { userId },
        select: { date: true, baseCurrency: true },
      }),
    ]);

    const accountMap = new Map(
      existingAccounts.map((a) => [`${a.name}::${a.currency}`, a])
    );

    const accountDiff: ImportPreview["accounts"] = { new: [], updated: [], unchanged: [] };
    let holdingsNew = 0;
    let holdingsUpdated = 0;
    let holdingsUnchanged = 0;

    for (const importAcc of importData.accounts) {
      const key = `${importAcc.name}::${importAcc.currency}`;
      const existing = accountMap.get(key);

      if (!existing) {
        accountDiff.new.push(importAcc.name);
        holdingsNew += importAcc.holdings?.length ?? 0;
      } else {
        const isChanged =
          existing.type !== importAcc.type ||
          existing.category !== importAcc.category ||
          existing.isActive !== importAcc.isActive;

        if (isChanged) accountDiff.updated.push(importAcc.name);
        else accountDiff.unchanged.push(importAcc.name);

        const holdingMap = new Map(existing.holdings.map((h) => [h.symbol, h]));
        for (const h of importAcc.holdings ?? []) {
          const existH = holdingMap.get(h.symbol);
          if (!existH) {
            holdingsNew++;
          } else if (existH.quantity.toString() !== String(h.quantity)) {
            holdingsUpdated++;
          } else {
            holdingsUnchanged++;
          }
        }
      }
    }

    const snapshotSet = new Set(
      existingSnapshots.map(
        (s) => `${s.date.toISOString().split("T")[0]}::${s.baseCurrency}`
      )
    );
    let snapshotsNew = 0;
    let snapshotsUnchanged = 0;
    for (const s of importData.snapshots ?? []) {
      const key = `${new Date(s.date).toISOString().split("T")[0]}::${s.baseCurrency}`;
      if (snapshotSet.has(key)) snapshotsUnchanged++;
      else snapshotsNew++;
    }

    const totalChanges =
      accountDiff.new.length +
      accountDiff.updated.length +
      holdingsNew +
      holdingsUpdated +
      snapshotsNew;

    const preview: ImportPreview = {
      accounts: accountDiff,
      holdings: { new: holdingsNew, updated: holdingsUpdated, unchanged: holdingsUnchanged },
      snapshots: { new: snapshotsNew, unchanged: snapshotsUnchanged },
      totalChanges,
    };

    return ok(preview);
  } catch (error) {
    console.error("Import preview error:", error);
    return failure("Failed to compute import preview", 500);
  }
});
