import type { Messages } from "next-intl";

/**
 * Pick a subset of top-level namespaces from the full messages object.
 * Used to limit what gets serialized into the HTML for NextIntlClientProvider.
 */
export function pickMessages(
  messages: Messages,
  namespaces: string[]
): Messages {
  const picked: Record<string, unknown> = {};
  for (const ns of namespaces) {
    if (ns in messages) {
      picked[ns] = messages[ns];
    }
  }
  return picked as Messages;
}
