# Passwordless Local Preview Login

## Goal

Make local testing faster by allowing the preview user to sign in with one button and no password, while preserving password protection on hosted Vercel preview deployments.

## Behavior

- Local development, including an unset `VERCEL_ENV` or `VERCEL_ENV=development`, shows the preview login button without a password field and accepts the credentials sign-in without a password.
- A Vercel preview deployment, `VERCEL_ENV=preview`, continues to show the password field and validates `PREVIEW_AUTH_PASSWORD`.
- `PREVIEW_AUTH_DISABLED` remains an explicit override that makes a hosted preview passwordless when intentionally enabled.
- Production continues to omit the credentials provider and uses Google sign-in only.

## Implementation

Define one shared environment-derived boolean for whether preview authentication requires a password. Both the login page and the NextAuth credentials provider will use it, preventing the UI and server-side authorization rules from drifting.

The login form will submit a password only when one is required. No new configuration or UI component is needed.

## Security Boundary

Passwordless authentication is automatic only outside Vercel preview and production environments. Hosted previews remain protected by default. Production behavior is unchanged.

## Verification

- A unit test proves local development does not require a preview password.
- A unit test proves Vercel preview requires a password by default.
- A unit test proves `PREVIEW_AUTH_DISABLED` explicitly bypasses the hosted-preview password.
- Existing unit tests, lint, and type checking remain green.

