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
  baseCurrency: z.string().length(3),
});
