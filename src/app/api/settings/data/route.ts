import { NextResponse } from "next/server";
import { revalidateTag } from "next/cache";
import type { z } from "zod";
import { prisma } from "@/lib/prisma";
import { Prisma } from "@/generated/prisma/client";
import { refreshExchangeRates, resolveRate } from "@/lib/services/exchange-rate-service";
import { dataImportSchema } from "@/lib/validators";
import { ok, failure, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";
import { log } from "@/lib/logger";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

const MISSING_ACCOUNT_GOAL_MESSAGE =
  "Import backup contains an account-scoped goal that references a missing account.";
const MISSING_EXCHANGE_RATE_MESSAGE =
  "Import backup contains mixed-currency snapshots, but the required exchange rate could not be loaded.";
const MAX_IMPORT_BODY_BYTES = 4 * 1024 * 1024;

type ImportData = z.infer<typeof dataImportSchema>;
type ImportGoal = NonNullable<ImportData["goals"]>[number];
type ImportSnapshot = NonNullable<ImportData["snapshots"]>[number];

async function readImportJson(
  request: Request,
): Promise<{ ok: true; body: unknown } | { ok: false; response: Response }> {
  const contentLength = request.headers.get("content-length");
  if (contentLength) {
    const declaredBytes = Number(contentLength);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_IMPORT_BODY_BYTES) {
      return { ok: false, response: failure("Import backup is too large", 413) };
    }
  }

  if (!request.body) {
    return { ok: false, response: failure("Import backup must be valid JSON", 400) };
  }

  const reader = request.body.getReader();
  const decoder = new TextDecoder();
  let receivedBytes = 0;
  let text = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    receivedBytes += value.byteLength;
    if (receivedBytes > MAX_IMPORT_BODY_BYTES) {
      return { ok: false, response: failure("Import backup is too large", 413) };
    }
    text += decoder.decode(value, { stream: true });
  }
  text += decoder.decode();

  try {
    return { ok: true, body: JSON.parse(text) };
  } catch {
    return { ok: false, response: failure("Import backup must be valid JSON", 400) };
  }
}

function validateAccountGoalReferences(importData: ImportData) {
  const accountIds = new Set(
    importData.accounts
      .map((account) => account.id)
      .filter((id): id is string => typeof id === "string" && id.length > 0),
  );

  for (const goal of importData.goals ?? []) {
    if (goal.scope !== "ACCOUNT") continue;
    if (!goal.scopeRefId || !accountIds.has(goal.scopeRefId)) {
      return false;
    }
  }

  return true;
}

/** Thrown inside the import transaction so the whole import rolls back atomically. */
class GoalRemapError extends Error {}

function remapGoalScopeRefId(goal: ImportGoal, accountIdMap: Map<string, string>) {
  if (goal.scope !== "ACCOUNT") return goal.scopeRefId ?? null;
  const remapped = accountIdMap.get(goal.scopeRefId ?? "");
  if (!remapped) {
    throw new GoalRemapError(
      `Import failed: account-scoped goal "${goal.name}" references account id "${goal.scopeRefId ?? "(none)"}", which is not present in the imported accounts.`,
    );
  }
  return remapped;
}

function dedupeSnapshots(snapshots: ImportSnapshot[] | undefined, targetBaseCurrency: string) {
  const deduped = new Map<string, ImportSnapshot>();

  for (const snapshot of snapshots ?? []) {
    const date = new Date(snapshot.date);
    const key = date.toISOString().slice(0, 10);
    const existing = deduped.get(key);
    if (!existing || snapshot.baseCurrency === targetBaseCurrency) {
      deduped.set(key, snapshot);
    }
  }

  return Array.from(deduped.values());
}

function collectImportCurrencies(importData: ImportData, targetBaseCurrency: string) {
  const currencies = new Set<string>(["USD", targetBaseCurrency]);

  for (const account of importData.accounts) {
    currencies.add(account.currency);
    for (const holding of account.holdings ?? []) currencies.add(holding.currency);
  }

  for (const snapshot of importData.snapshots ?? []) {
    currencies.add(snapshot.baseCurrency);
    const breakdown = snapshot.breakdown;
    if (!breakdown || typeof breakdown !== "object" || Array.isArray(breakdown)) continue;

    for (const entry of Object.values(breakdown)) {
      if (!entry || typeof entry !== "object" || Array.isArray(entry)) continue;
      const currency = (entry as { currency?: unknown }).currency;
      if (typeof currency === "string" && currency.length === 3) currencies.add(currency);
    }
  }

  return currencies;
}

async function loadExchangeRateMap() {
  const rates = await prisma.exchangeRate.findMany({
    select: { fromCurrency: true, toCurrency: true, rate: true },
  });

  return new Map(
    rates.map((rate) => [`${rate.fromCurrency}_${rate.toCurrency}`, Number(rate.rate)]),
  );
}

async function getImportRateMap(importData: ImportData, targetBaseCurrency: string) {
  const currencies = collectImportCurrencies(importData, targetBaseCurrency);
  await Promise.all([...currencies].map((currency) => refreshExchangeRates(currency)));
  revalidateTag("exchange-rates", { expire: 0 });

  const rateMap = await loadExchangeRateMap();
  for (const currency of currencies) {
    if (!resolveRate(rateMap, currency, targetBaseCurrency)) return null;
  }

  return rateMap;
}

function remapSnapshotBreakdown(
  value: ImportSnapshot["breakdown"],
  accountIdMap: Map<string, string>,
): ImportSnapshot["breakdown"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const remapped: Record<string, unknown> = {};
  for (const [accountId, entry] of Object.entries(value)) {
    remapped[accountIdMap.get(accountId) ?? accountId] = entry;
  }

  return remapped;
}

function normalizeSnapshotBreakdown(
  value: ImportSnapshot["breakdown"],
): Prisma.NullableJsonNullValueInput | Prisma.InputJsonValue | undefined {
  if (value === undefined) return undefined;
  if (value === null) return Prisma.JsonNull;
  return value as Prisma.InputJsonValue;
}

function normalizeSnapshotBreakdownCurrency(
  value: ImportSnapshot["breakdown"],
  rateMap: Map<string, number>,
  targetBaseCurrency: string,
): ImportSnapshot["breakdown"] {
  if (!value || typeof value !== "object" || Array.isArray(value)) return value;

  const normalized: Record<string, unknown> = {};
  for (const [accountId, entry] of Object.entries(value)) {
    if (!entry || typeof entry !== "object" || Array.isArray(entry)) {
      normalized[accountId] = entry;
      continue;
    }

    const rawEntry = entry as { value?: unknown; currency?: unknown };
    const currency = typeof rawEntry.currency === "string" ? rawEntry.currency : "USD";
    const rate = resolveRate(rateMap, currency, targetBaseCurrency);
    const valueNumber =
      typeof rawEntry.value === "number" ? rawEntry.value : Number(rawEntry.value ?? 0);

    normalized[accountId] = {
      ...rawEntry,
      value: rate ? valueNumber * rate : rawEntry.value,
      currency: rate ? targetBaseCurrency : currency,
    };
  }

  return normalized;
}

function normalizeSnapshotAmount(
  value: string | number,
  fromCurrency: string,
  targetBaseCurrency: string,
  rateMap: Map<string, number>,
) {
  const rate = resolveRate(rateMap, fromCurrency, targetBaseCurrency) ?? 1;
  return Number(value) * rate;
}

function invalidateImportCaches(userId: string) {
  revalidateTag("accounts", { expire: 0 });
  revalidateTag(`accounts:${userId}`, { expire: 0 });
  revalidateTag("goals", { expire: 0 });
  revalidateTag(`goals:${userId}`, { expire: 0 });
  revalidateTag("settings", { expire: 0 });
  revalidateTag(`settings:${userId}`, { expire: 0 });
  revalidateTag("snapshots", { expire: 0 });
  revalidateTag("net-worth", { expire: 0 });
  revalidateTag(`net-worth:${userId}`, { expire: 0 });
  revalidateTag(`history:${userId}`, { expire: 0 });
}

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
        goals: true,
      },
    });

    if (!data) return failure("User not found", 404);

    const exportData = {
      version: "1.2",
      exportedAt: new Date().toISOString(),
      settings: data.appSettings,
      accounts: data.appAccounts,
      snapshots: data.snapshots,
      goals: data.goals,
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
    const limited = rateLimitCheckWithPrune(request, {
      limit: 5,
      prefix: "settings-import",
      key: userId,
    });
    if (limited) return limited;

    const json = await readImportJson(request);
    if (!json.ok) return json.response;

    const parsed = dataImportSchema.safeParse(json.body);

    if (!parsed.success) {
      log.error("import.validation", { issues: parsed.error.format() });
      return validationError(parsed.error);
    }

    const importData = parsed.data;
    if (!validateAccountGoalReferences(importData)) {
      return failure(MISSING_ACCOUNT_GOAL_MESSAGE, 400);
    }

    const targetBaseCurrency = importData.settings?.baseCurrency ?? "USD";
    const rateMap = await getImportRateMap(importData, targetBaseCurrency);
    if (!rateMap) {
      return failure(MISSING_EXCHANGE_RATE_MESSAGE, 400);
    }

    await prisma.$transaction(
      async (tx) => {
        const accountIdMap = new Map<string, string>();

        // 1. Delete existing data for the user (Cascades should handle holdings and transactions)
        await tx.account.deleteMany({ where: { userId } });
        await tx.netWorthSnapshot.deleteMany({ where: { userId } });
        await tx.goal.deleteMany({ where: { userId } });

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
              isPinned: acc.isPinned,
              sortOrder: acc.sortOrder,
              createdAt: acc.createdAt,
              updatedAt: acc.updatedAt,
            },
          });

          if (acc.id) accountIdMap.set(acc.id, newAccount.id);

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
                  underlyingSymbol: h.underlyingSymbol ?? null,
                  optionType: h.optionType ?? null,
                  strike: h.strike ?? null,
                  expiration: h.expiration ? new Date(h.expiration) : null,
                  contractMultiplier: h.contractMultiplier ?? null,
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
        const snapshots = dedupeSnapshots(importData.snapshots, targetBaseCurrency);
        if (snapshots.length > 0) {
          await tx.netWorthSnapshot.createMany({
            data: snapshots.map((s) => {
              return {
                userId,
                date: new Date(s.date),
                totalAssets: normalizeSnapshotAmount(
                  s.totalAssets,
                  s.baseCurrency,
                  targetBaseCurrency,
                  rateMap,
                ),
                totalLiabilities: normalizeSnapshotAmount(
                  s.totalLiabilities,
                  s.baseCurrency,
                  targetBaseCurrency,
                  rateMap,
                ),
                netWorth: normalizeSnapshotAmount(
                  s.netWorth,
                  s.baseCurrency,
                  targetBaseCurrency,
                  rateMap,
                ),
                baseCurrency: targetBaseCurrency,
                breakdown: normalizeSnapshotBreakdown(
                  normalizeSnapshotBreakdownCurrency(
                    remapSnapshotBreakdown(s.breakdown, accountIdMap),
                    rateMap,
                    targetBaseCurrency,
                  ),
                ),
                label: s.label?.trim() || null,
                note: s.note?.trim() || null,
                createdAt: s.createdAt,
              };
            }),
          });
        }

        // 5. Import goals
        if (Array.isArray(importData.goals) && importData.goals.length > 0) {
          await tx.goal.createMany({
            data: importData.goals.map((g) => ({
              userId,
              name: g.name,
              targetAmount: g.targetAmount,
              targetCurrency: g.targetCurrency,
              targetDate: g.targetDate ? new Date(g.targetDate) : null,
              scope: g.scope,
              scopeRefId: remapGoalScopeRefId(g, accountIdMap),
              sortOrder: g.sortOrder,
              ...(g.createdAt && { createdAt: new Date(g.createdAt) }),
              ...(g.updatedAt && { updatedAt: new Date(g.updatedAt) }),
            })),
          });
        }
      },
      { timeout: 30000 },
    );

    invalidateImportCaches(userId);

    const response = ok({ ok: true });
    if (importData.settings?.locale) {
      response.cookies.set("NEXT_LOCALE", importData.settings.locale, {
        path: "/",
        maxAge: 60 * 60 * 24 * 365,
        sameSite: "lax",
      });
    }

    return response;
  } catch (error) {
    log.error("import.failed", { error: String(error) });
    if (error instanceof GoalRemapError) {
      return failure(error.message, 400);
    }
    return failure("Failed to import data", 500);
  }
});
