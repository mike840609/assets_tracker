import { PrismaClient } from "../src/generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";

const adapter = new PrismaPg(
  "postgres://postgres:postgres@localhost:51214/template1?sslmode=disable"
);
const prisma = new PrismaClient({ adapter });

async function main() {
  // Settings
  await prisma.setting.upsert({
    where: { id: "app_settings" },
    update: {},
    create: { id: "app_settings", baseCurrency: "USD" },
  });

  // Bank Account
  const checking = await prisma.account.create({
    data: {
      name: "Chase Checking",
      type: "ASSET",
      category: "BANK",
      currency: "USD",
      cashBalance: 15420.50,
    },
  });

  const savings = await prisma.account.create({
    data: {
      name: "Ally Savings",
      type: "ASSET",
      category: "BANK",
      currency: "USD",
      cashBalance: 45000.00,
    },
  });

  // Brokerage
  const brokerage = await prisma.account.create({
    data: {
      name: "Fidelity Brokerage",
      type: "ASSET",
      category: "BROKERAGE",
      currency: "USD",
      cashBalance: 2350.00,
    },
  });

  await prisma.holding.createMany({
    data: [
      { accountId: brokerage.id, symbol: "AAPL", name: "Apple Inc.", quantity: 50, assetType: "STOCK" },
      { accountId: brokerage.id, symbol: "MSFT", name: "Microsoft Corp.", quantity: 30, assetType: "STOCK" },
      { accountId: brokerage.id, symbol: "VOO", name: "Vanguard S&P 500 ETF", quantity: 20, assetType: "ETF" },
      { accountId: brokerage.id, symbol: "VTI", name: "Vanguard Total Stock Market ETF", quantity: 15, assetType: "ETF" },
    ],
  });

  // Crypto Wallet
  const crypto = await prisma.account.create({
    data: {
      name: "Coinbase",
      type: "ASSET",
      category: "CRYPTO_WALLET",
      currency: "USD",
      cashBalance: 500.00,
    },
  });

  await prisma.holding.createMany({
    data: [
      { accountId: crypto.id, symbol: "BTC", name: "Bitcoin", quantity: 0.75, assetType: "CRYPTO" },
      { accountId: crypto.id, symbol: "ETH", name: "Ethereum", quantity: 5.5, assetType: "CRYPTO" },
      { accountId: crypto.id, symbol: "SOL", name: "Solana", quantity: 100, assetType: "CRYPTO" },
    ],
  });

  // Property
  await prisma.account.create({
    data: {
      name: "Primary Home",
      type: "ASSET",
      category: "PROPERTY",
      currency: "USD",
      cashBalance: 450000.00,
    },
  });

  // EUR Bank Account (multi-currency)
  await prisma.account.create({
    data: {
      name: "N26 (Europe)",
      type: "ASSET",
      category: "BANK",
      currency: "EUR",
      cashBalance: 8500.00,
    },
  });

  // Credit Card (Liability)
  await prisma.account.create({
    data: {
      name: "Chase Sapphire",
      type: "LIABILITY",
      category: "CREDIT_CARD",
      currency: "USD",
      cashBalance: 3200.00,
    },
  });

  // Mortgage (Liability)
  await prisma.account.create({
    data: {
      name: "Home Mortgage",
      type: "LIABILITY",
      category: "MORTGAGE",
      currency: "USD",
      cashBalance: 320000.00,
    },
  });

  // Seed some price cache data
  await prisma.priceCache.createMany({
    data: [
      { symbol: "AAPL", price: 195.50, currency: "USD" },
      { symbol: "MSFT", price: 420.80, currency: "USD" },
      { symbol: "VOO", price: 485.20, currency: "USD" },
      { symbol: "VTI", price: 265.40, currency: "USD" },
      { symbol: "BTC", price: 67500.00, currency: "USD" },
      { symbol: "ETH", price: 3450.00, currency: "USD" },
      { symbol: "SOL", price: 145.80, currency: "USD" },
    ],
  });

  // Seed exchange rate
  await prisma.exchangeRate.create({
    data: {
      id: "USD_EUR",
      fromCurrency: "USD",
      toCurrency: "EUR",
      rate: 0.92,
    },
  });

  // Create some historical snapshots
  const now = new Date();
  const snapshotData = [
    { daysAgo: 30, netWorth: 230000, assets: 560000, liabilities: 330000 },
    { daysAgo: 25, netWorth: 235000, assets: 565000, liabilities: 330000 },
    { daysAgo: 20, netWorth: 228000, assets: 558000, liabilities: 330000 },
    { daysAgo: 15, netWorth: 240000, assets: 570000, liabilities: 330000 },
    { daysAgo: 10, netWorth: 245000, assets: 575000, liabilities: 330000 },
    { daysAgo: 5, netWorth: 250000, assets: 580000, liabilities: 330000 },
    { daysAgo: 1, netWorth: 255000, assets: 585000, liabilities: 330000 },
  ];

  for (const s of snapshotData) {
    const date = new Date(now);
    date.setDate(date.getDate() - s.daysAgo);
    date.setHours(0, 0, 0, 0);

    await prisma.netWorthSnapshot.create({
      data: {
        date,
        totalAssets: s.assets,
        totalLiabilities: s.liabilities,
        netWorth: s.netWorth,
        baseCurrency: "USD",
      },
    });
  }

  console.log("Seed data created successfully!");
}

main()
  .then(() => prisma.$disconnect())
  .catch((e) => {
    console.error(e);
    prisma.$disconnect();
    process.exit(1);
  });
