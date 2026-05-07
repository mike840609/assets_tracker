import { z } from "zod";
import {
  ACCOUNT_TYPES,
  ACCOUNT_CATEGORIES,
  HOLDING_ASSET_TYPES,
  HOLDING_TRANSACTION_TYPES,
  CASH_TRANSACTION_TYPES,
  OPTION_TYPES,
} from "./enums";

const OCC_SHAPE = /^[A-Z][A-Z0-9.\-]{0,5}\d{6}[CP]\d{8}$/;

export const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(ACCOUNT_TYPES),
  category: z.enum(ACCOUNT_CATEGORIES),
  currency: z.string().length(3),
  cashBalance: z.number().default(0),
});

export const updateAccountSchema = createAccountSchema.partial();

const NON_OPTION_ASSET_TYPES = HOLDING_ASSET_TYPES.filter((t) => t !== "OPTION") as Exclude<
  (typeof HOLDING_ASSET_TYPES)[number],
  "OPTION"
>[];

const baseHoldingFields = {
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(32)
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1, "Name is required").max(100),
  quantity: z.number().positive("Quantity must be positive"),
  currency: z.string().length(3).default("USD"),
};

const createNonOptionHoldingSchema = z.object({
  ...baseHoldingFields,
  assetType: z.enum(NON_OPTION_ASSET_TYPES),
});

const createOptionHoldingSchema = z
  .object({
    ...baseHoldingFields,
    assetType: z.literal("OPTION"),
    underlyingSymbol: z.string().min(1).max(8).optional(),
    optionType: z.enum(OPTION_TYPES).optional(),
    strike: z.number().positive().optional(),
    expiration: z
      .string()
      .regex(/^\d{4}-\d{2}-\d{2}/)
      .optional(),
    contractMultiplier: z.literal(100).default(100),
  })
  .refine((d) => OCC_SHAPE.test(d.symbol), {
    message: "Invalid OCC option symbol",
    path: ["symbol"],
  });

export const createHoldingSchema = z.discriminatedUnion("assetType", [
  createNonOptionHoldingSchema,
  createOptionHoldingSchema,
]);

export const updateHoldingSchema = z.object({
  id: z.string(),
  symbol: z
    .string()
    .min(1)
    .max(32)
    .transform((s) => s.toUpperCase())
    .optional(),
  name: z.string().min(1).max(100).optional(),
  quantity: z.number().nonnegative().optional(),
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

const decimalSchema = z.union([z.number(), z.string()]);

export const dataImportSchema = z.object({
  version: z.string(),
  settings: z
    .object({
      baseCurrency: z.string().length(3),
      locale: z.string(),
    })
    .optional()
    .nullable(),
  accounts: z.array(
    z.object({
      name: z.string().min(1),
      type: z.enum(ACCOUNT_TYPES),
      category: z.enum(ACCOUNT_CATEGORIES),
      currency: z.string().length(3),
      cashBalance: decimalSchema,
      isActive: z.boolean().default(true),
      createdAt: z.string().optional(),
      updatedAt: z.string().optional(),
      holdings: z
        .array(
          z.object({
            symbol: z.string().min(1),
            name: z.string().min(1),
            quantity: decimalSchema,
            currency: z.string().length(3),
            assetType: z.enum(HOLDING_ASSET_TYPES),
            createdAt: z.string().optional(),
            updatedAt: z.string().optional(),
            transactions: z
              .array(
                z.object({
                  type: z.enum(HOLDING_TRANSACTION_TYPES),
                  quantity: decimalSchema,
                  note: z.string().optional().nullable(),
                  createdAt: z.string().optional(),
                }),
              )
              .optional(),
          }),
        )
        .optional(),
      cashTransactions: z
        .array(
          z.object({
            type: z.enum(CASH_TRANSACTION_TYPES),
            amount: decimalSchema,
            note: z.string().optional().nullable(),
            createdAt: z.string().optional(),
          }),
        )
        .optional(),
    }),
  ),
  snapshots: z
    .array(
      z.object({
        date: z.string(),
        totalAssets: decimalSchema,
        totalLiabilities: decimalSchema,
        netWorth: decimalSchema,
        baseCurrency: z.string().length(3),
        breakdown: z
          .array(
            z.object({
              accountId: z.string(),
              value: decimalSchema,
              currency: z.string().length(3),
            }),
          )
          .optional()
          .nullable(),
        createdAt: z.string().optional(),
      }),
    )
    .optional(),
});
