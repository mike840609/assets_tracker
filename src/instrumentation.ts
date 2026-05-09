export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    const { log } = await import("@/lib/logger");
    log.info("instrumentation.register", { env: process.env.NODE_ENV });
  }
}
