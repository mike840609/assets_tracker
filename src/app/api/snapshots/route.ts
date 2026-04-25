import { getFullNormalizedHistory } from "@/lib/services/history-service";
import { ok } from "@/lib/api-responses";
import { withAuth } from "@/lib/api-handler";

export const GET = withAuth(async (request, _ctx, userId) => {
  const { searchParams } = new URL(request.url);
  const from = searchParams.get("from");
  const to = searchParams.get("to");
  const baseCurrency = searchParams.get("currency") ?? "USD";

  const options: { from?: Date; to?: Date } = {};
  if (from) options.from = new Date(from);
  if (to) options.to = new Date(to);

  const snapshots = await getFullNormalizedHistory(userId, baseCurrency, options);
  return ok(snapshots);
});
