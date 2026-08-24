import * as sentryClient from "@/instrumentation-client-sentry";

export const onRouterTransitionStart = sentryClient.onRouterTransitionStart;
export const captureException = sentryClient.captureException;
