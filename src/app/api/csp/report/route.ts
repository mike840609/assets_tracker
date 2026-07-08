import { log } from "@/lib/logger";
import { rateLimitCheckWithPrune } from "@/lib/rate-limit";

const MAX_CSP_REPORT_BYTES = 64 * 1024;

export async function POST(request: Request) {
  try {
    const limited = rateLimitCheckWithPrune(request, { limit: 30, prefix: "csp-report" });
    if (limited) return limited;

    const declaredBytes = Number(request.headers.get("content-length") ?? 0);
    if (Number.isFinite(declaredBytes) && declaredBytes > MAX_CSP_REPORT_BYTES) {
      return new Response(null, { status: 413 });
    }

    const text = await request.text();
    if (new TextEncoder().encode(text).byteLength > MAX_CSP_REPORT_BYTES) {
      return new Response(null, { status: 413 });
    }

    const report = JSON.parse(text) as unknown;
    log.warn("csp.violation", { report });
  } catch {
    log.warn("csp.report.invalid");
  }

  return new Response(null, { status: 204 });
}
