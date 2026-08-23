import { z } from "zod";
import { withAuth } from "@/lib/api-handler";
import { ok, validationError } from "@/lib/api-responses";
import { ANALYSIS_RANGE_LABELS, type RangeLabel } from "@/lib/analysis-range";
import { getOrCreateSettings } from "@/lib/services/settings-service";
import { getCachedAnalysisRangeSeries } from "@/lib/services/analysis-payload-service";

const rangeSchema = z.custom<RangeLabel>(
  (value) => typeof value === "string" && ANALYSIS_RANGE_LABELS.includes(value as RangeLabel),
  "Invalid range",
);

export const GET = withAuth(
  async (request, _ctx, userId) => {
    const parsed = rangeSchema.safeParse(new URL(request.url).searchParams.get("range"));
    if (!parsed.success) return validationError(parsed.error);

    const settings = await getOrCreateSettings(userId);
    const series = await getCachedAnalysisRangeSeries(userId, settings.baseCurrency, parsed.data);
    return ok(series);
  },
  { demo: "allow" },
);
