import { getFullNormalizedHistory } from "@/lib/services/history-service";
import { snapshotsQuerySchema } from "@/lib/validators";
import { ok, validationError } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (request, _ctx, userId) => {
  const { searchParams } = new URL(request.url);
  const parsed = snapshotsQuerySchema.safeParse({
    from: searchParams.get("from") ?? undefined,
    to: searchParams.get("to") ?? undefined,
    currency: searchParams.get("currency") ?? undefined,
  });
  if (!parsed.success) return validationError(parsed.error);

  const { from, to, currency } = parsed.data;
  const options: { from?: Date; to?: Date } = {};
  if (from) options.from = from;
  if (to) options.to = to;

  const snapshots = await getFullNormalizedHistory(userId, currency, options);
  // Per-user data: `private` keeps it out of shared caches while letting the
  // browser reuse the response briefly (snapshots only change once a day).
  return ok(snapshots, {
    headers: {
      "Cache-Control": "private, max-age=60, stale-while-revalidate=300",
    },
  });
});
