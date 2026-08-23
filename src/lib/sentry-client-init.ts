import { init as sentryInit, spanStreamingIntegration } from "@sentry/nextjs";
import {
  beforeSend,
  beforeSendSpan,
  beforeSendTransaction,
  getSentryDist,
  getSentryEnvironment,
  getSentryRelease,
  getSentryTags,
} from "@/lib/sentry-config";

type SpanStreamingIntegration = typeof spanStreamingIntegration;

type SentryClientInitOptions = {
  dsn: string;
  tracesSampleRate: number;
  spanStreamingIntegration: SpanStreamingIntegration;
};

export function initializeSentryClient(options: SentryClientInitOptions): void {
  sentryInit({
    dsn: options.dsn,
    tracesSampleRate: options.tracesSampleRate,
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    dist: getSentryDist(),
    initialScope: { tags: getSentryTags("browser") },
    beforeSend,
    beforeSendTransaction,
    beforeSendSpan,
    traceLifecycle: "stream",
    integrations: [options.spanStreamingIntegration()],
    enabled: true,
  });
}
