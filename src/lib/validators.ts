import { z } from "zod";
import {
  ACCOUNT_TYPES,
  ACCOUNT_CATEGORIES,
  HOLDING_ASSET_TYPES,
  HOLDING_TRANSACTION_TYPES,
  CASH_TRANSACTION_TYPES,
  OPTION_TYPES,
  GOAL_SCOPES,
  ALLOCATION_SCOPES,
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

export const createGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  targetAmount: z.number().positive("Target must be positive"),
  targetCurrency: z.string().length(3).default("USD"),
  targetDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/, "Must be YYYY-MM-DD")
    .optional()
    .nullable(),
  scope: z.enum(GOAL_SCOPES),
  scopeRefId: z.string().min(1).optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const createAllocationTargetSchema = z.object({
  scope: z.enum(ALLOCATION_SCOPES),
  key: z.string().min(1).max(64),
  targetPercent: z.number().min(0).max(100),
  driftThreshold: z.number().min(0).max(100).default(5),
});

export const updateAllocationTargetSchema = createAllocationTargetSchema.partial();

const decimalSchema = z.union([z.string(), z.number()]);

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
            underlyingSymbol: z.string().optional().nullable(),
            optionType: z.enum(OPTION_TYPES).optional().nullable(),
            strike: decimalSchema.optional().nullable(),
            expiration: z.string().optional().nullable(),
            contractMultiplier: z.number().int().optional().nullable(),
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
        breakdown: z.record(z.string(), z.unknown()).optional().nullable(),
        createdAt: z.string().optional(),
      }),
    )
    .optional(),
  goals: z
    .array(
      z.object({
        name: z.string().min(1),
        targetAmount: decimalSchema,
        targetCurrency: z.string().length(3),
        targetDate: z.string().optional().nullable(),
        scope: z.enum(GOAL_SCOPES),
        scopeRefId: z.string().optional().nullable(),
        createdAt: z.string().optional(),
        updatedAt: z.string().optional(),
      }),
    )
    .optional(),
});
