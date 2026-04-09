import { z } from "zod";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(["ASSET", "LIABILITY"]),
  category: z.enum([
    "BANK",
    "BROKERAGE",
    "CRYPTO_WALLET",
    "PROPERTY",
    "VEHICLE",
    "CREDIT_CARD",
    "LOAN",
    "MORTGAGE",
    "OTHER",
  ]),
  currency: z.string().length(3),
  cashBalance: z.number().default(0),
});

export const updateAccountSchema = createAccountSchema.partial();

export const createHoldingSchema = z.object({
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(20)
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1, "Name is required").max(100),
  quantity: z.number().positive("Quantity must be positive"),
  currency: z.string().length(3).default("USD"),
  assetType: z.enum(["STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER"]),
});

export const updateHoldingSchema = z.object({
  id: z.string(),
  symbol: z
    .string()
    .min(1)
    .max(20)
    .transform((s) => s.toUpperCase())
    .optional(),
  name: z.string().min(1).max(100).optional(),
  quantity: z.number().positive().optional(),
  assetType: z
    .enum(["STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER"])
    .optional(),
});

export const updateSettingsSchema = z.object({
  baseCurrency: z.string().length(3).optional(),
  locale: z.enum(["en-US", "zh-TW"]).optional(),
});

export const updateTransactionSchema = z.object({
  id: z.string(),
  quantity: z.number().optional(),
  type: z.enum(["BUY", "SELL", "EDIT"]).optional(),
  note: z.string().optional().nullable(),
  createdAt: z.string().optional(), // Using string for ISO dates
});

export const createCashTransactionSchema = z.object({
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "EDIT"]),
  amount: z.number(),
  note: z.string().optional().nullable(),
});

export const updateCashTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(["DEPOSIT", "WITHDRAWAL", "EDIT"]).optional(),
  amount: z.number().optional(),
  note: z.string().optional().nullable(),
  createdAt: z.string().optional(),
});

const decimalSchema = z.union([z.number(), z.string(), z.any()]);

export const dataImportSchema = z.object({
  version: z.string(),
  settings: z.object({
    baseCurrency: z.string().length(3),
    locale: z.string(),
  }).optional().nullable(),
  accounts: z.array(z.object({
    name: z.string().min(1),
    type: z.enum(["ASSET", "LIABILITY"]),
    category: z.enum([
      "BANK", "BROKERAGE", "CRYPTO_WALLET", "PROPERTY", "VEHICLE", 
      "CREDIT_CARD", "LOAN", "MORTGAGE", "OTHER"
    ]),
    currency: z.string().length(3),
    cashBalance: decimalSchema,
    isActive: z.boolean().default(true),
    createdAt: z.string().optional(),
    updatedAt: z.string().optional(),
    holdings: z.array(z.object({
      symbol: z.string().min(1),
      name: z.string().min(1),
      quantity: decimalSchema,
      currency: z.string().length(3),
      assetType: z.enum(["STOCK", "ETF", "CRYPTO", "MUTUAL_FUND", "BOND", "OTHER"]),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      transactions: z.array(z.object({
        type: z.enum(["BUY", "SELL", "EDIT"]),
        quantity: decimalSchema,
        note: z.string().optional().nullable(),
        createdAt: z.string().optional(),
      })).optional(),
    })).optional(),
    cashTransactions: z.array(z.object({
      type: z.enum(["DEPOSIT", "WITHDRAWAL", "EDIT"]),
      amount: decimalSchema,
      note: z.string().optional().nullable(),
      createdAt: z.string().optional(),
    })).optional(),
  })),
  snapshots: z.array(z.object({
    date: z.string(),
    totalAssets: decimalSchema,
    totalLiabilities: decimalSchema,
    netWorth: decimalSchema,
    baseCurrency: z.string().length(3),
    breakdown: z.any().optional().nullable(),
    createdAt: z.string().optional(),
  })).optional(),
});

export const createFeedbackSchema = z.object({
  type: z.enum(["BUG", "FEATURE_REQUEST", "SUGGESTION", "OTHER"]),
  message: z.string().min(10).max(1000),
});
