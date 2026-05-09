import { log } from "@/lib/logger";

export async function POST(request: Request) {
  try {
    // sendBeacon sends Content-Type: text/plain
    const text = await request.text();
    const metric = JSON.parse(text) as {
      name: string;
      value: number;
      rating: string;
      url: string;
    };
    log.warn("cwv.budget_exceeded", {
      metric: metric.name,
      value: metric.value,
      rating: metric.rating,
      url: metric.url,
    });
  } catch {
    // Non-fatal — never error on metrics collection
  }
  return new Response(null, { status: 204 });
}
