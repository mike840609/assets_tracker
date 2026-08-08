import type { ErrorEvent, EventHint, init as sentryInit } from "@sentry/nextjs";
import * as Sentry from "@sentry/nextjs";
import { describe, expect, it } from "vitest";
import * as sentryConfig from "@/lib/sentry-config";
import { beforeSend, beforeSendSpan } from "@/lib/sentry-config";

type SentryOptions = Parameters<typeof sentryInit>[0];
type TransactionEvent = Parameters<NonNullable<SentryOptions["beforeSendTransaction"]>>[0];
type TransportOptions = Parameters<typeof Sentry.createTransport>[0];

describe("Sentry privacy sanitization", () => {
  it("removes Demo forwarding identifiers and raw error text from the full event payload", () => {
    const rawIp = "203.0.113.77";
    const headerSentinel = "FORWARDING_HEADER_SENTINEL";
    const accountId = "acct-DEMO_ACCOUNT_SENTINEL";
    const transactionId = "txn-DEMO_TRANSACTION_SENTINEL";
    const demoId = "demo-DEMO_WORKSPACE_SENTINEL";
    const throwSentinel = "DEMO_THROW_SENTINEL";
    const rawUrl = `https://asset-tracker.example/demo/${demoId}/accounts/${accountId}/transactions/${transactionId}?token=DEMO_URL_QUERY_SENTINEL#fragment`;
    const event = {
      level: "error",
      message: `Demo message ${throwSentinel} ${rawUrl}`,
      logentry: {
        message: `Demo log ${throwSentinel} ${rawUrl}`,
        params: [throwSentinel],
      },
      exception: {
        values: [
          {
            type: "Error",
            value: `Demo exception ${throwSentinel} ${rawUrl}`,
          },
        ],
      },
      request: {
        url: rawUrl,
        query_string: "token=DEMO_URL_QUERY_SENTINEL",
        headers: {
          "x-forwarded-for": `${rawIp}, ${headerSentinel}`,
          "cf-connecting-ip": rawIp,
          "x-real-ip": rawIp,
          forwarded: `for=${rawIp}`,
          authorization: "Bearer DEMO_AUTH_SENTINEL",
          "x-safe": "safe-value",
        },
      },
      breadcrumbs: [
        {
          category: "app.warning",
          message: `Demo breadcrumb ${throwSentinel} ${rawUrl}`,
          data: { requestUrl: rawUrl, error: throwSentinel },
        },
      ],
      extra: {
        msg: `Demo extra ${throwSentinel}`,
        error: throwSentinel,
        requestUrl: rawUrl,
      },
      contexts: {
        demo: {
          clientIp: rawIp,
          workspaceId: demoId,
          lastError: throwSentinel,
        },
      },
      tags: {
        requestUrl: rawUrl,
        error: throwSentinel,
      },
      transaction: rawUrl,
      user: { id: demoId },
    } as unknown as ErrorEvent;

    const sanitized = beforeSend(event, {} as EventHint);

    expect(sanitized).not.toBeNull();
    const payload = JSON.stringify(sanitized);
    for (const sensitiveValue of [
      rawIp,
      headerSentinel,
      accountId,
      transactionId,
      demoId,
      throwSentinel,
      "DEMO_URL_QUERY_SENTINEL",
      "DEMO_AUTH_SENTINEL",
    ]) {
      expect(payload).not.toContain(sensitiveValue);
    }
    expect(sanitized?.request?.url).toBe(
      "https://asset-tracker.example/demo/:id/accounts/:id/transactions/:id",
    );
    expect(sanitized?.request?.headers).not.toHaveProperty("x-forwarded-for");
    expect(sanitized?.request?.headers).not.toHaveProperty("cf-connecting-ip");
    expect(sanitized?.request?.headers).not.toHaveProperty("x-real-ip");
    expect(sanitized?.request?.headers).not.toHaveProperty("forwarded");
    expect(sanitized?.message).toBe("[Filtered]");
    expect(sanitized?.logentry?.message).toBe("[Filtered]");
    expect(sanitized?.exception?.values?.[0]?.value).toBe("[Filtered]");
  });

  it("scrubs nested exception/context IP metadata and templates every dynamic API identifier", () => {
    const rawIp = "2001:db8:8::9";
    const accountId = "acct-NESTED_SENTINEL";
    const recurringId = "recurring-NESTED_SENTINEL";
    const rawUrl = `https://asset-tracker.example/api/accounts/${accountId}/recurring-cash-transactions/${recurringId}`;
    const event = {
      exception: {
        values: [
          {
            type: "Error",
            value: "safe outer text",
            mechanism: { data: { transportDetail: `request from ${rawIp}` } },
          },
        ],
      },
      request: {
        url: rawUrl,
        env: { REMOTE_ADDR: rawIp },
      },
      contexts: {
        transport: {
          headers: { "x-forwarded-for": rawIp },
          peer: rawIp,
        },
      },
    } as unknown as ErrorEvent;

    const sanitized = beforeSend(event, {} as EventHint);
    const payload = JSON.stringify(sanitized);

    expect(payload).not.toContain(rawIp);
    expect(payload).not.toContain(accountId);
    expect(payload).not.toContain(recurringId);
    expect(sanitized?.request?.url).toBe(
      "https://asset-tracker.example/api/accounts/:id/recurring-cash-transactions/:id",
    );
    expect(sanitized?.request?.env?.REMOTE_ADDR).toBe("[Filtered]");
    expect(sanitized?.contexts?.transport).not.toHaveProperty("headers.x-forwarded-for");
  });

  it("removes identifier records, formatted logs, and dynamic breadcrumb categories", () => {
    const accountId = "acct-RECORD_SENTINEL";
    const demoId = "demo-RECORD_SENTINEL";
    const transactionId = "txn-RECORD_SENTINEL";
    const event = {
      level: "error",
      logentry: {
        message: "safe message",
        formatted: `formatted ${accountId} ${transactionId}`,
      },
      request: {
        env: {
          ACCOUNT_ID: accountId,
          TRANSACTION_ID: transactionId,
          SAFE_ENV: "safe",
        },
      },
      tags: {
        accountId,
        demoId,
        transactionId,
        feature: "stocks",
      },
      breadcrumbs: [
        {
          category: `navigation.${demoId}.${accountId}`,
          data: {
            request: {
              headers: { "x-forwarded-for": "203.0.113.201" },
              transactionId,
            },
          },
        },
      ],
    } as unknown as ErrorEvent;

    const sanitized = beforeSend(event, {} as EventHint);
    const payload = JSON.stringify(sanitized);

    for (const sensitiveValue of [accountId, demoId, transactionId, "203.0.113.201"]) {
      expect(payload).not.toContain(sensitiveValue);
    }
    expect(sanitized?.logentry).toMatchObject({ formatted: "[Filtered]" });
    expect(sanitized?.breadcrumbs?.[0]?.category).toBe("[Filtered]");
    expect(sanitized?.tags).toMatchObject({
      account_hash: expect.stringMatching(/^hash:/),
      demo_hash: expect.stringMatching(/^hash:/),
      transaction_hash: expect.stringMatching(/^hash:/),
      feature: "stocks",
    });
    expect(sanitized?.request?.env).toMatchObject({
      ACCOUNT_hash: expect.stringMatching(/^hash:/),
      TRANSACTION_hash: expect.stringMatching(/^hash:/),
      SAFE_ENV: "safe",
    });
  });

  it("sanitizes transaction events and spans before trace transport", () => {
    const rawIp = "2001:db8:9::77";
    const accountId = "acct-TRACE_SENTINEL";
    const transactionId = "txn-TRACE_SENTINEL";
    const rawUrl = `https://asset-tracker.example/api/accounts/${accountId}/transactions/${transactionId}?token=TRACE_TOKEN_SENTINEL`;
    const transactionSanitizer = (
      sentryConfig as typeof sentryConfig & {
        beforeSendTransaction?: (
          event: TransactionEvent,
          hint: EventHint,
        ) => TransactionEvent | null;
      }
    ).beforeSendTransaction;

    expect(transactionSanitizer).toBeTypeOf("function");
    if (!transactionSanitizer) return;

    const transaction = {
      type: "transaction",
      transaction: `GET ${rawUrl}`,
      request: {
        url: rawUrl,
        headers: {
          "x-forwarded-for": rawIp,
          authorization: "Bearer TRACE_AUTH_SENTINEL",
        },
      },
      tags: { accountId, transactionId },
      contexts: {
        trace: {
          accountId,
          request: { url: rawUrl, remoteAddr: rawIp },
        },
      },
      spans: [
        {
          trace_id: "a".repeat(32),
          span_id: "b".repeat(16),
          start_timestamp: 1,
          timestamp: 2,
          description: `GET ${rawUrl}`,
          data: {
            "http.url": rawUrl,
            "http.request.header.x-forwarded-for": rawIp,
            accountId,
          },
          attributes: {
            "http.request.header.x-forwarded-for": rawIp,
            transactionId,
          },
        },
      ],
    } as unknown as TransactionEvent;
    const cleanTransaction = transactionSanitizer(transaction, {} as EventHint);
    const payload = JSON.stringify(cleanTransaction);

    for (const sensitiveValue of [
      rawIp,
      accountId,
      transactionId,
      "TRACE_TOKEN_SENTINEL",
      "TRACE_AUTH_SENTINEL",
    ]) {
      expect(payload).not.toContain(sensitiveValue);
    }
    expect(cleanTransaction?.request?.url).toBe(
      "https://asset-tracker.example/api/accounts/:id/transactions/:id",
    );
    expect(cleanTransaction?.spans?.[0]?.description).toBe("[Filtered]");
  });

  it("marks the streamed span sanitizer and scrubs standalone streamed span envelopes", async () => {
    const rawIp = "203.0.113.97";
    const accountId = "acct-STREAMED_SENTINEL";
    const transactionId = "txn-STREAMED_SENTINEL";
    const rawUrl = `https://asset-tracker.example/api/accounts/${accountId}/transactions/${transactionId}?token=STREAMED_TOKEN_SENTINEL`;
    const outboundPayloads: string[] = [];

    expect(Reflect.get(beforeSendSpan, "_streamed")).toBe(true);

    Sentry.init({
      dsn: "https://public@example.invalid/1",
      defaultIntegrations: false,
      tracesSampleRate: 1,
      traceLifecycle: "stream",
      beforeSendSpan,
      transport: (options: TransportOptions) =>
        Sentry.createTransport(options, (request) => {
          outboundPayloads.push(
            typeof request.body === "string"
              ? request.body
              : new TextDecoder().decode(request.body),
          );
          return Promise.resolve({ statusCode: 200 });
        }),
    });

    Sentry.startSpan(
      {
        name: `GET ${rawUrl}`,
        attributes: {
          "http.url": rawUrl,
          "client.ip": rawIp,
        },
        forceTransaction: true,
      },
      () => undefined,
    );

    await Sentry.flush(2_000);
    await Sentry.close(2_000);

    expect(outboundPayloads).toHaveLength(1);
    const payload = JSON.parse(outboundPayloads[0].trim().split("\n").at(-1) ?? "{}") as {
      items?: Array<{
        name?: string;
        attributes?: Record<string, { value?: string }>;
      }>;
    };
    const streamedSpan = payload.items?.[0];
    const serializedPayload = JSON.stringify(payload);

    expect(streamedSpan?.name).toBe("[Filtered]");
    expect(streamedSpan?.attributes?.["http.url"]?.value).toBe(
      "https://asset-tracker.example/api/accounts/:id/transactions/:id",
    );
    expect(streamedSpan?.attributes?.["client.ip"]?.value).toBe("[Filtered]");
    for (const sensitiveValue of [rawIp, accountId, transactionId, "STREAMED_TOKEN_SENTINEL"]) {
      expect(serializedPayload).not.toContain(sensitiveValue);
    }
  });
});
