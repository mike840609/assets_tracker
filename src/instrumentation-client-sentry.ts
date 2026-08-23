import * as Sentry from "@sentry/nextjs";
import {
  beforeSend,
  beforeSendSpan,
  beforeSendTransaction,
  getSentryDist,
  getSentryEnvironment,
  getSentryRelease,
  getSentryTags,
} from "@/lib/sentry-config";

const dsn = process.env.NEXT_PUBLIC_SENTRY_DSN;

if (dsn) {
  Sentry.init({
    dsn,
    tracesSampleRate: Number(process.env.NEXT_PUBLIC_SENTRY_TRACES_SAMPLE_RATE ?? 0),
    environment: getSentryEnvironment(),
    release: getSentryRelease(),
    dist: getSentryDist(),
    initialScope: { tags: getSentryTags("browser") },
    beforeSend,
    beforeSendTransaction,
    beforeSendSpan,
    traceLifecycle: "stream",
    integrations: [Sentry.spanStreamingIntegration()],
    enabled: true,
  });
}

export const onRouterTransitionStart = Sentry.captureRouterTransitionStart;
export const captureException = Sentry.captureException;
