import "server-only";
import { revalidateTag } from "next/cache";

function revalidate(tag: string) {
  revalidateTag(tag, "max");
}

export function invalidateAccountData(userId: string, options: { includeHistory?: boolean } = {}) {
  const { includeHistory = true } = options;
  revalidate(`accounts:${userId}`);
  revalidate(`net-worth:${userId}`);
  if (includeHistory) {
    revalidate(`history:${userId}`);
  }
}

export function invalidateGoalData(userId: string) {
  revalidate(`goals:${userId}`);
}

export function invalidateSettingsData(userId: string, options?: { affectsNetWorth?: boolean }) {
  revalidate(`settings:${userId}`);
  if (options?.affectsNetWorth) {
    revalidate(`net-worth:${userId}`);
  }
}

export function invalidateAllAccountsData() {
  revalidate("accounts");
}

export function invalidatePriceData() {
  revalidate("net-worth");
  revalidate("prices:crypto");
}

export function invalidateExchangeRateData() {
  revalidate("exchange-rates");
}

export function invalidateSnapshotData(userIds: string[]) {
  revalidate("snapshots");
  for (const userId of userIds) {
    revalidate(`history:${userId}`);
  }
}
