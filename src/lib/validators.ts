import { z } from "zod";
import {
  ACCOUNT_TYPES,
  ACCOUNT_CATEGORIES,
  HOLDING_ASSET_TYPES,
  HOLDING_TRANSACTION_TYPES,
  CASH_TRANSACTION_TYPES,
  OPTION_TYPES,
  GOAL_SCOPES,
} from "./enums";

const OCC_SHAPE = /^[A-Z][A-Z0-9.\-]{0,5}\d{6}[CP]\d{8}$/;

export const createAccountSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  type: z.enum(ACCOUNT_TYPES),
  category: z.enum(ACCOUNT_CATEGORIES),
  currency: z.string().length(3),
  cashBalance: z.number().default(0),
});

export const updateAccountSchema = createAccountSchema
  .extend({
    isActive: z.boolean(),
    isPinned: z.boolean(),
  })
  .partial();

export const reorderAccountsSchema = z.object({
  type: z.enum(ACCOUNT_TYPES),
  pinnedIds: z.array(z.string().min(1)),
  unpinnedIds: z.array(z.string().min(1)),
});

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
  // 0 is allowed only to close an OPTION position (preserves the transaction
  // audit trail, which a DELETE would cascade away). The PATCH route rejects
  // quantity 0 for non-option holdings, where the asset type is known.
  quantity: z.number().nonnegative().optional(),
  // OPTION is deliberately excluded: converting a holding to OPTION via PATCH
  // would produce a row without the OCC fields (underlyingSymbol, optionType,
  // strike, expiration). Options can only be created via POST, which derives
  // those fields server-side from the OCC symbol. The PATCH route also rejects
  // assetType changes on existing OPTION holdings.
  assetType: z.enum(NON_OPTION_ASSET_TYPES).optional(),
});

export const deleteHoldingSchema = z.object({
  id: z.string().min(1, "Holding ID required"),
});

export const updateSettingsSchema = z.object({
  baseCurrency: z.string().length(3).optional(),
  locale: z.enum(["en-US", "zh-TW"]).optional(),
});

// `type` is optional on update, so a discriminated union doesn't fit here —
// per-type quantity rules are enforced via superRefine (mirroring
// updateCashTransactionSchema below), and the PATCH route re-checks the
// merged (existing + patch) values via getHoldingTransactionQuantityError.
export const updateTransactionSchema = z
  .object({
    id: z.string(),
    quantity: z.number().optional(),
    type: z.enum(HOLDING_TRANSACTION_TYPES).optional(),
    note: z.string().optional().nullable(),
    createdAt: z.iso.datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.quantity === undefined) return;
    if ((data.type === "BUY" || data.type === "SELL") && data.quantity <= 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Quantity must be positive",
      });
    }
    if (data.type === "EDIT" && data.quantity === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["quantity"],
        message: "Adjustment quantity cannot be zero",
      });
    }
  });

const positiveCashAmount = z.number().positive("Amount must be positive");
const nonZeroCashAdjustment = z.number().refine((amount) => amount !== 0, {
  message: "Adjustment amount cannot be zero",
});
const cashNoteField = z.string().optional().nullable();

export const createCashTransactionSchema = z.discriminatedUnion("type", [
  z.object({
    type: z.literal("DEPOSIT"),
    amount: positiveCashAmount,
    note: cashNoteField,
  }),
  z.object({
    type: z.literal("WITHDRAWAL"),
    amount: positiveCashAmount,
    note: cashNoteField,
  }),
  z.object({
    type: z.literal("EDIT"),
    amount: nonZeroCashAdjustment,
    note: cashNoteField,
  }),
]);

export const updateCashTransactionSchema = z
  .object({
    id: z.string(),
    type: z.enum(CASH_TRANSACTION_TYPES).optional(),
    amount: z.number().optional(),
    note: cashNoteField,
    createdAt: z.iso.datetime().optional(),
  })
  .superRefine((data, ctx) => {
    if (data.type === "DEPOSIT" || data.type === "WITHDRAWAL") {
      if (data.amount !== undefined && data.amount <= 0) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["amount"],
          message: "Amount must be positive",
        });
      }
    }
    if (data.type === "EDIT" && data.amount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["amount"],
        message: "Adjustment amount cannot be zero",
      });
    }
  });

export const createGoalSchema = z.object({
  name: z.string().min(1, "Name is required").max(100),
  targetAmount: z.number().positive("Target must be positive"),
  targetCurrency: z.string().length(3).default("USD"),
  targetDate: z.iso.date("Must be a valid YYYY-MM-DD date").optional().nullable(),
  scope: z.enum(GOAL_SCOPES),
  scopeRefId: z.string().min(1).optional().nullable(),
});

export const updateGoalSchema = createGoalSchema.partial();

export const reorderGoalsSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

const stockWatchItemFields = {
  symbol: z
    .string()
    .min(1, "Symbol is required")
    .max(32)
    .transform((s) => s.toUpperCase()),
  name: z.string().min(1, "Name is required").max(120),
  exchange: z.string().max(80).default(""),
  currency: z.string().length(3).default("USD"),
  recordPrice: z.number().positive("Record price must be positive"),
  recordDate: z.iso.date("Must be a valid YYYY-MM-DD date"),
  note: z.string().max(2000).optional().nullable(),
};

export const createStockWatchItemSchema = z.object(stockWatchItemFields);

export const updateStockWatchItemSchema = z.object({
  name: stockWatchItemFields.name.optional(),
  exchange: stockWatchItemFields.exchange.optional(),
  currency: stockWatchItemFields.currency.optional(),
  recordPrice: stockWatchItemFields.recordPrice.optional(),
  recordDate: stockWatchItemFields.recordDate.optional(),
  note: stockWatchItemFields.note,
});

export const reorderStocksSchema = z.object({
  orderedIds: z.array(z.string().min(1)),
});

const decimalSchema = z.union([z.string(), z.number()]);

const MAX_IMPORT_ACCOUNTS = 200;
const MAX_IMPORT_HOLDINGS_PER_ACCOUNT = 2_000;
const MAX_IMPORT_TRANSACTIONS_PER_HOLDING = 10_000;
const MAX_IMPORT_CASH_TRANSACTIONS_PER_ACCOUNT = 10_000;
const MAX_IMPORT_SNAPSHOTS = 10_000;
const MAX_IMPORT_GOALS = 500;

// Exports are produced by NextResponse.json (Dates → full ISO 8601 strings),
// so round-trip imports always carry valid ISO datetimes. Rejecting anything
// else turns a write-time Prisma 500 into a 400 with a field path.
const importTimestamp = z.iso.datetime().optional();

export const dataImportSchema = z.object({
  version: z.string(),
  settings: z
    .object({
      baseCurrency: z.string().length(3),
      locale: z.string(),
    })
    .optional()
    .nullable(),
  accounts: z
    .array(
      z.object({
        id: z.string().optional(),
        name: z.string().min(1),
        type: z.enum(ACCOUNT_TYPES),
        category: z.enum(ACCOUNT_CATEGORIES),
        currency: z.string().length(3),
        cashBalance: decimalSchema,
        isActive: z.boolean().default(true),
        isPinned: z.boolean().default(false),
        sortOrder: z.number().int().default(0),
        createdAt: importTimestamp,
        updatedAt: importTimestamp,
        holdings: z
          .array(
            z.object({
              symbol: z.string().min(1),
              name: z.string().min(1),
              quantity: decimalSchema,
              currency: z.string().length(3),
              assetType: z.enum(HOLDING_ASSET_TYPES),
              createdAt: importTimestamp,
              updatedAt: importTimestamp,
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
                    createdAt: importTimestamp,
                  }),
                )
                .max(MAX_IMPORT_TRANSACTIONS_PER_HOLDING)
                .optional(),
            }),
          )
          .max(MAX_IMPORT_HOLDINGS_PER_ACCOUNT)
          .optional(),
        cashTransactions: z
          .array(
            z.object({
              type: z.enum(CASH_TRANSACTION_TYPES),
              amount: decimalSchema,
              note: z.string().optional().nullable(),
              createdAt: importTimestamp,
            }),
          )
          .max(MAX_IMPORT_CASH_TRANSACTIONS_PER_ACCOUNT)
          .optional(),
      }),
    )
    .max(MAX_IMPORT_ACCOUNTS),
  snapshots: z
    .array(
      z.object({
        date: z.string(),
        totalAssets: decimalSchema,
        totalLiabilities: decimalSchema,
        netWorth: decimalSchema,
        baseCurrency: z.string().length(3),
        breakdown: z.record(z.string(), z.unknown()).optional().nullable(),
        createdAt: importTimestamp,
      }),
    )
    .max(MAX_IMPORT_SNAPSHOTS)
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
        sortOrder: z.number().int().default(0),
        createdAt: importTimestamp,
        updatedAt: importTimestamp,
      }),
    )
    .max(MAX_IMPORT_GOALS)
    .optional(),
});
