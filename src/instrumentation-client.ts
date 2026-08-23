import type { captureRouterTransitionStart } from "@sentry/nextjs";

const sentryClient = process.env.NEXT_PUBLIC_SENTRY_DSN
  ? import("./instrumentation-client-sentry")
  : undefined;

export const onRouterTransitionStart: typeof captureRouterTransitionStart = (...args) => {
  void sentryClient?.then(({ onRouterTransitionStart }) => onRouterTransitionStart(...args));
};
