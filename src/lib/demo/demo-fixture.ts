import type { Prisma } from "../../generated/prisma/client";
import type { dataImportSchema } from "../validators";
import type { z } from "zod";

export type DemoFixtureSource = z.infer<typeof dataImportSchema>;

export type PreparedDemoFixture = {
  settings: Prisma.SettingCreateManyInput;
  accounts: Prisma.AccountCreateManyInput[];
  holdings: Prisma.HoldingCreateManyInput[];
  holdingTransactions: Prisma.HoldingTransactionCreateManyInput[];
  cashTransactions: Prisma.CashTransactionCreateManyInput[];
  recurringCashTransactions: Prisma.RecurringCashTransactionCreateManyInput[];
  recurringInvestments: Prisma.RecurringInvestmentCreateManyInput[];
  snapshots: Prisma.NetWorthSnapshotCreateManyInput[];
  goals: Prisma.GoalCreateManyInput[];
  stockWatchItems: Prisma.StockWatchItemCreateManyInput[];
  calendarEntries: Prisma.CalendarEntryCreateManyInput[];
  rowCount: number;
};

const DAY_MS = 86_400_000;

function shiftIso<T extends string | null | undefined>(value: T, shiftMs: number): T {
  if (value == null) return value;
  return new Date(Date.parse(value) + shiftMs).toISOString() as T;
}

export function shiftDemoFixtureDates(
  source: DemoFixtureSource,
  taiwanDay: Date,
): DemoFixtureSource {
  const copy = structuredClone(source);
  const snapshots = copy.snapshots ?? [];
  if (snapshots.length === 0) throw new RangeError("Demo fixture requires snapshots");
  const lastSnapshotMs = Math.max(...snapshots.map((snapshot) => Date.parse(snapshot.date)));
  const shiftMs = Math.round((taiwanDay.getTime() - lastSnapshotMs) / DAY_MS) * DAY_MS;

  for (const account of copy.accounts) {
    account.createdAt = shiftIso(account.createdAt, shiftMs);
    account.updatedAt = shiftIso(account.updatedAt, shiftMs);
    for (const holding of account.holdings ?? []) {
      holding.expiration = shiftIso(holding.expiration, shiftMs);
      holding.createdAt = shiftIso(holding.createdAt, shiftMs);
      holding.updatedAt = shiftIso(holding.updatedAt, shiftMs);
      for (const transaction of holding.transactions ?? []) {
        transaction.createdAt = shiftIso(transaction.createdAt, shiftMs)!;
        transaction.occurrenceDate = shiftIso(transaction.occurrenceDate, shiftMs);
      }
    }
    for (const transaction of account.cashTransactions ?? []) {
      transaction.createdAt = shiftIso(transaction.createdAt, shiftMs)!;
      transaction.occurrenceDate = shiftIso(transaction.occurrenceDate, shiftMs);
      transaction.materializedAt = shiftIso(transaction.materializedAt, shiftMs);
    }
    for (const rule of account.recurringCashTransactions ?? []) {
      rule.startDate = shiftIso(rule.startDate, shiftMs)!;
      rule.endDate = shiftIso(rule.endDate, shiftMs);
      rule.nextRunDate = shiftIso(rule.nextRunDate, shiftMs)!;
      rule.createdAt = shiftIso(rule.createdAt, shiftMs);
      rule.updatedAt = shiftIso(rule.updatedAt, shiftMs);
    }
    for (const rule of account.recurringInvestments ?? []) {
      rule.startDate = shiftIso(rule.startDate, shiftMs)!;
      rule.endDate = shiftIso(rule.endDate, shiftMs);
      rule.nextRunDate = shiftIso(rule.nextRunDate, shiftMs)!;
      rule.createdAt = shiftIso(rule.createdAt, shiftMs);
      rule.updatedAt = shiftIso(rule.updatedAt, shiftMs);
    }
  }
  for (const snapshot of snapshots) {
    snapshot.date = shiftIso(snapshot.date, shiftMs)!;
    snapshot.createdAt = shiftIso(snapshot.createdAt, shiftMs);
  }
  for (const goal of copy.goals ?? []) {
    goal.targetDate = shiftIso(goal.targetDate, shiftMs);
    goal.createdAt = shiftIso(goal.createdAt, shiftMs);
    goal.updatedAt = shiftIso(goal.updatedAt, shiftMs);
  }
  for (const stock of copy.stockWatchItems ?? []) {
    stock.recordDate = shiftIso(stock.recordDate, shiftMs)!;
    stock.createdAt = shiftIso(stock.createdAt, shiftMs);
    stock.updatedAt = shiftIso(stock.updatedAt, shiftMs);
  }
  for (const entry of copy.calendarEntries ?? []) {
    entry.eventDate = shiftIso(entry.eventDate, shiftMs)!;
    entry.createdAt = shiftIso(entry.createdAt, shiftMs);
    entry.updatedAt = shiftIso(entry.updatedAt, shiftMs);
  }
  copy.snapshots = snapshots;
  return copy;
}

export function instantiateDemoFixture(
  source: DemoFixtureSource,
  options: {
    userId: string;
    locale: "en-US" | "zh-TW";
    now: Date;
    makeId: () => string;
  },
): PreparedDemoFixture {
  const instantiatedAt = options.now;
  const requiredId = (value: string | undefined, label: string) => {
    if (!value) throw new TypeError(`Demo fixture ${label} requires an id`);
    return value;
  };
  const requiredDate = (value: string | undefined, label: string) => {
    if (!value) throw new TypeError(`Demo fixture ${label} requires a date`);
    return new Date(value);
  };
  const accountIds = new Map(
    source.accounts.map((account, index) => [
      requiredId(account.id, `account ${index}`),
      options.makeId(),
    ]),
  );
  const holdings: PreparedDemoFixture["holdings"] = [];
  const holdingTransactions: PreparedDemoFixture["holdingTransactions"] = [];
  const cashTransactions: PreparedDemoFixture["cashTransactions"] = [];
  const recurringCashTransactions: PreparedDemoFixture["recurringCashTransactions"] = [];
  const recurringInvestments: PreparedDemoFixture["recurringInvestments"] = [];
  const recurringCashIds = new Map<string, string>();
  const recurringInvestmentIds = new Map<string, string>();
  const remapOptionalId = (
    sourceId: string | null | undefined,
    ids: Map<string, string>,
    label: string,
  ) => {
    if (!sourceId) return null;
    const remapped = ids.get(sourceId);
    if (!remapped) throw new TypeError(`Demo fixture ${label} has an invalid recurringId`);
    return remapped;
  };

  for (const account of source.accounts) {
    for (const rule of account.recurringCashTransactions ?? []) {
      if (rule.id) recurringCashIds.set(rule.id, options.makeId());
    }
    for (const rule of account.recurringInvestments ?? []) {
      if (rule.id) recurringInvestmentIds.set(rule.id, options.makeId());
    }
  }

  const accounts = source.accounts.map((account, accountIndex) => {
    const sourceAccountId = requiredId(account.id, `account ${accountIndex}`);
    const accountId = accountIds.get(sourceAccountId)!;
    for (const holding of account.holdings ?? []) {
      const holdingId = options.makeId();
      holdings.push({
        id: holdingId,
        accountId,
        symbol: holding.symbol,
        name: holding.name,
        quantity: holding.quantity,
        currency: holding.currency,
        assetType: holding.assetType,
        underlyingSymbol: holding.underlyingSymbol ?? null,
        optionType: holding.optionType ?? null,
        strike: holding.strike ?? null,
        expiration: holding.expiration ? new Date(holding.expiration) : null,
        contractMultiplier: holding.contractMultiplier ?? null,
        createdAt: holding.createdAt ? new Date(holding.createdAt) : instantiatedAt,
        updatedAt: holding.updatedAt ? new Date(holding.updatedAt) : instantiatedAt,
      });
      for (const transaction of holding.transactions ?? []) {
        holdingTransactions.push({
          id: options.makeId(),
          holdingId,
          type: transaction.type,
          quantity: transaction.quantity,
          unitPrice: transaction.unitPrice ?? null,
          note: transaction.note ?? null,
          createdAt: transaction.createdAt ? new Date(transaction.createdAt) : instantiatedAt,
          occurrenceDate: transaction.occurrenceDate ? new Date(transaction.occurrenceDate) : null,
          recurringId: remapOptionalId(
            transaction.recurringId,
            recurringInvestmentIds,
            "holding transaction",
          ),
        });
      }
    }
    for (const transaction of account.cashTransactions ?? []) {
      cashTransactions.push({
        id: options.makeId(),
        accountId,
        type: transaction.type,
        amount: transaction.amount,
        note: transaction.note ?? null,
        createdAt: transaction.createdAt ? new Date(transaction.createdAt) : instantiatedAt,
        occurrenceDate: transaction.occurrenceDate ? new Date(transaction.occurrenceDate) : null,
        recurringId: remapOptionalId(transaction.recurringId, recurringCashIds, "cash transaction"),
        materializedAt: transaction.materializedAt ? new Date(transaction.materializedAt) : null,
        materializedAtEstimated: transaction.materializedAtEstimated ?? false,
      });
    }
    for (const rule of account.recurringCashTransactions ?? []) {
      const ruleId = rule.id ? recurringCashIds.get(rule.id)! : options.makeId();
      recurringCashTransactions.push({
        id: ruleId,
        accountId,
        type: rule.type,
        amount: rule.amount,
        frequency: rule.frequency,
        note: rule.note ?? null,
        startDate: requiredDate(rule.startDate, `cash rule ${ruleId} startDate`),
        endDate: rule.endDate ? new Date(rule.endDate) : null,
        nextRunDate: requiredDate(rule.nextRunDate, `cash rule ${ruleId} nextRunDate`),
        isActive: rule.isActive,
        createdAt: rule.createdAt ? new Date(rule.createdAt) : instantiatedAt,
        updatedAt: rule.updatedAt ? new Date(rule.updatedAt) : instantiatedAt,
      });
    }
    for (const rule of account.recurringInvestments ?? []) {
      const ruleId = rule.id ? recurringInvestmentIds.get(rule.id)! : options.makeId();
      recurringInvestments.push({
        id: ruleId,
        accountId,
        symbol: rule.symbol,
        name: rule.name,
        assetType: rule.assetType,
        holdingCurrency: rule.holdingCurrency,
        amount: rule.amount,
        frequency: rule.frequency,
        note: rule.note ?? null,
        startDate: requiredDate(rule.startDate, `investment rule ${ruleId} startDate`),
        endDate: rule.endDate ? new Date(rule.endDate) : null,
        nextRunDate: requiredDate(rule.nextRunDate, `investment rule ${ruleId} nextRunDate`),
        isActive: rule.isActive,
        createdAt: rule.createdAt ? new Date(rule.createdAt) : instantiatedAt,
        updatedAt: rule.updatedAt ? new Date(rule.updatedAt) : instantiatedAt,
      });
    }
    return {
      id: accountId,
      userId: options.userId,
      name: account.name,
      type: account.type,
      category: account.category,
      currency: account.currency,
      cashBalance: account.cashBalance,
      isActive: account.isActive,
      isPinned: account.isPinned,
      sortOrder: account.sortOrder,
      createdAt: account.createdAt ? new Date(account.createdAt) : instantiatedAt,
      updatedAt: account.updatedAt ? new Date(account.updatedAt) : instantiatedAt,
    };
  });

  const remapBreakdown = (value: unknown) => {
    if (!value || typeof value !== "object" || Array.isArray(value)) return value;
    return Object.fromEntries(
      Object.entries(value).map(([accountId, entry]) => {
        const remapped = accountIds.get(accountId);
        if (!remapped) {
          throw new TypeError("Demo fixture snapshot has an invalid account breakdown key");
        }
        return [remapped, structuredClone(entry)];
      }),
    );
  };

  const remapGoalScope = (scope: string, sourceRef: string | null | undefined) => {
    if (scope !== "ACCOUNT") return sourceRef ?? null;
    const remapped = accountIds.get(sourceRef ?? "");
    if (!remapped) throw new TypeError("Demo fixture account goal has an invalid scopeRefId");
    return remapped;
  };

  const snapshots = (source.snapshots ?? []).map((snapshot) => ({
    id: options.makeId(),
    userId: options.userId,
    date: new Date(snapshot.date),
    totalAssets: snapshot.totalAssets,
    totalLiabilities: snapshot.totalLiabilities,
    netWorth: snapshot.netWorth,
    baseCurrency: snapshot.baseCurrency,
    ...(snapshot.breakdown == null
      ? {}
      : { breakdown: remapBreakdown(snapshot.breakdown) as Prisma.InputJsonValue }),
    label: snapshot.label ?? null,
    note: snapshot.note ?? null,
    createdAt: snapshot.createdAt ? new Date(snapshot.createdAt) : instantiatedAt,
  }));

  const goals = (source.goals ?? []).map((goal) => ({
    id: options.makeId(),
    userId: options.userId,
    name: goal.name,
    targetAmount: goal.targetAmount,
    targetCurrency: goal.targetCurrency,
    targetDate: goal.targetDate ? new Date(goal.targetDate) : null,
    scope: goal.scope,
    scopeRefId: remapGoalScope(goal.scope, goal.scopeRefId),
    sortOrder: goal.sortOrder,
    createdAt: goal.createdAt ? new Date(goal.createdAt) : instantiatedAt,
    updatedAt: goal.updatedAt ? new Date(goal.updatedAt) : instantiatedAt,
  }));

  const stockWatchItems = (source.stockWatchItems ?? []).map((stock) => ({
    id: options.makeId(),
    userId: options.userId,
    symbol: stock.symbol,
    name: stock.name,
    exchange: stock.exchange,
    currency: stock.currency,
    recordPrice: stock.recordPrice,
    recordDate: requiredDate(stock.recordDate, `watch item ${stock.symbol} recordDate`),
    note: stock.note ?? null,
    sortOrder: stock.sortOrder,
    createdAt: stock.createdAt ? new Date(stock.createdAt) : instantiatedAt,
    updatedAt: stock.updatedAt ? new Date(stock.updatedAt) : instantiatedAt,
  }));

  const calendarEntries = (source.calendarEntries ?? []).map((entry) => ({
    id: options.makeId(),
    userId: options.userId,
    title: entry.title,
    eventDate: new Date(`${entry.eventDate.slice(0, 10)}T00:00:00.000Z`),
    startTimeMinutes: entry.startTimeMinutes ?? null,
    timeZone: entry.timeZone ?? null,
    category: entry.category,
    description: entry.description ?? null,
    sourceUrl: entry.sourceUrl ?? null,
    createdAt: entry.createdAt ? new Date(entry.createdAt) : instantiatedAt,
    updatedAt: entry.updatedAt ? new Date(entry.updatedAt) : instantiatedAt,
  }));

  const prepared = {
    settings: {
      id: options.makeId(),
      userId: options.userId,
      baseCurrency: "USD",
      locale: options.locale,
    },
    accounts,
    holdings,
    holdingTransactions,
    cashTransactions,
    recurringCashTransactions,
    recurringInvestments,
    snapshots,
    goals,
    stockWatchItems,
    calendarEntries,
  };
  return {
    ...prepared,
    rowCount: Object.values(prepared).reduce(
      (sum, value) => sum + (Array.isArray(value) ? value.length : 1),
      0,
    ),
  };
}
