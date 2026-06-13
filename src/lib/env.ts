import "server-only";
import { z } from "zod";

const envSchema = z
  .object({
    DATABASE_URL: z
      .string()
      .trim()
      .min(1, "is required")
      .refine(
        (value) => /^postgres(ql)?:\/\//.test(value),
        "must be a valid PostgreSQL connection string",
      ),
    AUTH_SECRET: z.string().trim().min(1, "is required"),
    AUTH_GOOGLE_ID: z.string().trim().min(1, "is required"),
    AUTH_GOOGLE_SECRET: z.string().trim().min(1, "is required"),
    CRON_SECRET: z.string().trim().min(1, "is required"),
    AUTH_REDIRECT_PROXY_URL: z.string().url("must be a valid URL").optional(),
    PREVIEW_AUTH_PASSWORD: z.string().trim().min(1, "must not be empty").optional(),
    PREVIEW_AUTH_DISABLED: z.string().trim().optional(),
    VERCEL_ENV: z.enum(["production", "preview", "development"]).optional(),
    // E19 — Sentry error reporting. All optional: when no DSN is set the
    // integration is a complete no-op (local dev / CI / build need no Sentry
    // account). SENTRY_DSN drives server + edge init; NEXT_PUBLIC_SENTRY_DSN is
    // the client-exposed equivalent the browser SDK reads. SENTRY_AUTH_TOKEN
    // only gates source-map upload at build time.
    SENTRY_DSN: z.string().trim().min(1, "must not be empty").optional(),
    NEXT_PUBLIC_SENTRY_DSN: z.string().trim().min(1, "must not be empty").optional(),
    SENTRY_AUTH_TOKEN: z.string().trim().min(1, "must not be empty").optional(),
    SENTRY_CAPTURE_WARNINGS: z.string().trim().optional(),
  })
  .superRefine((value, ctx) => {
    const previewAuthDisabled = ["1", "true", "yes", "on"].includes(
      (value.PREVIEW_AUTH_DISABLED ?? "").toLowerCase(),
    );
    if (value.VERCEL_ENV === "preview" && !previewAuthDisabled && !value.PREVIEW_AUTH_PASSWORD) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["PREVIEW_AUTH_PASSWORD"],
        message: 'is required when VERCEL_ENV is "preview"',
      });
    }
  });

const parsedEnv = envSchema.safeParse({
  DATABASE_URL: process.env.DATABASE_URL,
  AUTH_SECRET: process.env.AUTH_SECRET,
  AUTH_GOOGLE_ID: process.env.AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET: process.env.AUTH_GOOGLE_SECRET,
  CRON_SECRET: process.env.CRON_SECRET,
  AUTH_REDIRECT_PROXY_URL: process.env.AUTH_REDIRECT_PROXY_URL,
  PREVIEW_AUTH_PASSWORD: process.env.PREVIEW_AUTH_PASSWORD,
  PREVIEW_AUTH_DISABLED: process.env.PREVIEW_AUTH_DISABLED,
  VERCEL_ENV: process.env.VERCEL_ENV,
  SENTRY_DSN: process.env.SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN: process.env.NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_AUTH_TOKEN: process.env.SENTRY_AUTH_TOKEN,
  SENTRY_CAPTURE_WARNINGS: process.env.SENTRY_CAPTURE_WARNINGS,
});

if (!parsedEnv.success) {
  const issues = parsedEnv.error.issues
    .map((issue) => {
      const key = issue.path.join(".") || "(unknown)";
      return `- ${key}: ${issue.message}`;
    })
    .join("\n");

  throw new Error(`Invalid environment variables:\n${issues}`);
}

/** @public Documented entry point — prefer named exports below, but `env` is part of the API. */
export const env = parsedEnv.data;

/** @public AUTH_SECRET is read by NextAuth from process.env; exported here so the validated set stays complete. */
export const {
  DATABASE_URL,
  AUTH_SECRET,
  AUTH_GOOGLE_ID,
  AUTH_GOOGLE_SECRET,
  CRON_SECRET,
  AUTH_REDIRECT_PROXY_URL,
  PREVIEW_AUTH_PASSWORD,
  PREVIEW_AUTH_DISABLED,
  VERCEL_ENV,
  SENTRY_DSN,
  NEXT_PUBLIC_SENTRY_DSN,
  SENTRY_AUTH_TOKEN,
  SENTRY_CAPTURE_WARNINGS,
} = env;
