export const BASE_CURRENCY = "USD";
export const HISTORY_DAYS = 180;
export const PRICES = {
  AAPL: 229.65,
  NVDA: 178.4,
  TSLA: 315.75,
  "BTC-USD": 104500,
};
export const TWD_TO_USD = 0.032;

const DAY_MS = 24 * 60 * 60 * 1000;
const TAIWAN_OFFSET_MS = 8 * 60 * 60 * 1000;

const purchase = (quantity, unitPrice, daysAgo, note) => ({
  type: "BUY",
  quantity,
  unitPrice,
  daysAgo,
  note,
});

const cashTransaction = (type, amount, daysAgo, note) => ({
  type,
  amount,
  daysAgo,
  note,
});

export function createDemoAccounts(id) {
  return [
    {
      id: id(),
      name: "Cathay Bank",
      type: "ASSET",
      category: "BANK",
      currency: "TWD",
      cash: 385000,
      holdings: [],
      cashTransactions: [
        cashTransaction("DEPOSIT", 125000, 175, "Opening balance"),
        ...[155, 125, 95, 65, 35, 5].map((daysAgo) =>
          cashTransaction("DEPOSIT", 82000, daysAgo, "Monthly salary"),
        ),
        ...[145, 115, 85, 55, 25].map((daysAgo) =>
          cashTransaction("WITHDRAWAL", 26000, daysAgo, "Rent"),
        ),
        ...[135, 105, 75, 45, 15].map((daysAgo) =>
          cashTransaction("WITHDRAWAL", 16000, daysAgo, "Living expenses"),
        ),
        cashTransaction("WITHDRAWAL", 22000, 40, "Transfer to brokerage"),
      ],
    },
    {
      id: id(),
      name: "Fidelity Brokerage",
      type: "ASSET",
      category: "BROKERAGE",
      currency: "USD",
      cash: 4850,
      holdings: [
        {
          symbol: "AAPL",
          name: "Apple Inc.",
          assetType: "STOCK",
          quantity: 28,
          transactions: [
            purchase(10, 172.25, 160, "Initial Apple position"),
            purchase(8, 189.4, 105, "Added after earnings"),
            purchase(10, 213.6, 50, "Long-term allocation"),
          ],
        },
        {
          symbol: "NVDA",
          name: "NVIDIA Corporation",
          assetType: "STOCK",
          quantity: 42,
          transactions: [
            purchase(18, 116.2, 150, "Initial NVIDIA position"),
            purchase(14, 134.8, 95, "Added on pullback"),
            purchase(10, 151.5, 35, "AI growth allocation"),
          ],
        },
        {
          symbol: "TSLA",
          name: "Tesla, Inc.",
          assetType: "STOCK",
          quantity: 14,
          transactions: [
            purchase(6, 218.5, 140, "Initial Tesla position"),
            purchase(4, 262.25, 85, "Added to growth basket"),
            purchase(4, 294.75, 25, "Recent accumulation"),
          ],
        },
      ],
      cashTransactions: [],
    },
    {
      id: id(),
      name: "Cold Wallet",
      type: "ASSET",
      category: "CRYPTO_WALLET",
      currency: "USD",
      cash: 0,
      holdings: [
        {
          symbol: "BTC-USD",
          name: "Bitcoin",
          assetType: "CRYPTO",
          quantity: 0.12,
          transactions: [
            purchase(0.05, 62000, 165, "First cold-wallet transfer"),
            purchase(0.04, 74500, 115, "Monthly Bitcoin allocation"),
            purchase(0.03, 91000, 60, "Added on market strength"),
          ],
        },
      ],
      cashTransactions: [],
    },
    {
      id: id(),
      name: "Visa Credit Card",
      type: "LIABILITY",
      category: "CREDIT_CARD",
      currency: "USD",
      cash: 1860,
      holdings: [],
      cashTransactions: [],
    },
  ];
}

export function accountValue(account) {
  return (
    account.cash +
    account.holdings.reduce(
      (total, holding) => total + holding.quantity * PRICES[holding.symbol],
      0,
    )
  );
}

const toUsd = (account, value) => value * (account.currency === "TWD" ? TWD_TO_USD : 1);
const roundCurrency = (value) => Number(value.toFixed(2));

export function portfolioTotals(accounts) {
  const totalAssets = accounts
    .filter((account) => account.type === "ASSET")
    .reduce((total, account) => total + toUsd(account, accountValue(account)), 0);
  const totalLiabilities = accounts
    .filter((account) => account.type === "LIABILITY")
    .reduce((total, account) => total + toUsd(account, accountValue(account)), 0);

  return {
    totalAssets: roundCurrency(totalAssets),
    totalLiabilities: roundCurrency(totalLiabilities),
    netWorth: roundCurrency(totalAssets - totalLiabilities),
  };
}

function historicalFactor(account, progress, daysAgo) {
  if (daysAgo === 0) return 1;

  switch (account.category) {
    case "BANK":
      return 0.72 + 0.28 * progress + 0.008 * Math.sin(daysAgo / 11);
    case "BROKERAGE":
      return 0.63 + 0.37 * progress + 0.05 * Math.sin(daysAgo / 13);
    case "CRYPTO_WALLET":
      return 0.52 + 0.48 * progress + 0.12 * Math.sin(daysAgo / 8);
    case "CREDIT_CARD":
      return 0.75 + 0.15 * progress + 0.12 * (0.5 + 0.5 * Math.sin(daysAgo / 7));
    default:
      return 1;
  }
}

export function buildSnapshotHistory(accounts, now) {
  const taiwanNow = new Date(now.getTime() + TAIWAN_OFFSET_MS);
  const todayUtc = Date.UTC(
    taiwanNow.getUTCFullYear(),
    taiwanNow.getUTCMonth(),
    taiwanNow.getUTCDate(),
  );
  const snapshots = [];

  for (let daysAgo = HISTORY_DAYS - 1; daysAgo >= 0; daysAgo--) {
    const progress = (HISTORY_DAYS - 1 - daysAgo) / (HISTORY_DAYS - 1);
    const values = accounts.map((account) => ({
      account,
      value: roundCurrency(accountValue(account) * historicalFactor(account, progress, daysAgo)),
    }));
    const totalAssets = values
      .filter(({ account }) => account.type === "ASSET")
      .reduce((total, { account, value }) => total + toUsd(account, value), 0);
    const totalLiabilities = values
      .filter(({ account }) => account.type === "LIABILITY")
      .reduce((total, { account, value }) => total + toUsd(account, value), 0);

    snapshots.push({
      date: new Date(todayUtc - daysAgo * DAY_MS),
      totalAssets: roundCurrency(totalAssets),
      totalLiabilities: roundCurrency(totalLiabilities),
      netWorth: roundCurrency(totalAssets - totalLiabilities),
      breakdown: Object.fromEntries(
        values.map(({ account, value }) => [account.id, { value, currency: account.currency }]),
      ),
    });
  }

  return snapshots;
}
