import "server-only";
import { z } from "zod";
import {
  ACCOUNT_TYPES,
  ACCOUNT_CATEGORIES,
  HOLDING_ASSET_TYPES,
  HOLDING_TRANSACTION_TYPES,
  CASH_TRANSACTION_TYPES,
} from "./enums";

export const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(ACCOUNT_TYPES),
  category: z.enum(ACCOUNT_CATEGORIES),
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
  assetType: z.enum(HOLDING_ASSET_TYPES),
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
  assetType: z.enum(HOLDING_ASSET_TYPES).optional(),
});

export const updateSettingsSchema = z.object({
  baseCurrency: z.string().length(3).optional(),
  locale: z.enum(["en-US", "zh-TW"]).optional(),
});

export const updateTransactionSchema = z.object({
  id: z.string(),
  quantity: z.number().optional(),
  type: z.enum(HOLDING_TRANSACTION_TYPES).optional(),
  note: z.string().optional().nullable(),
  createdAt: z.string().optional(), // Using string for ISO dates
});

export const createCashTransactionSchema = z.object({
  type: z.enum(CASH_TRANSACTION_TYPES),
  amount: z.number(),
  note: z.string().optional().nullable(),
});

export const updateCashTransactionSchema = z.object({
  id: z.string(),
  type: z.enum(CASH_TRANSACTION_TYPES).optional(),
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
    type: z.enum(ACCOUNT_TYPES),
    category: z.enum(ACCOUNT_CATEGORIES),
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
      assetType: z.enum(HOLDING_ASSET_TYPES),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      transactions: z.array(z.object({
        type: z.enum(HOLDING_TRANSACTION_TYPES),
        quantity: decimalSchema,
        note: z.string().optional().nullable(),
        createdAt: z.string().optional(),
      })).optional(),
    })).optional(),
    cashTransactions: z.array(z.object({
      type: z.enum(CASH_TRANSACTION_TYPES),
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
