"use client";

import { useEffect } from "react";
import * as Sentry from "@sentry/nextjs";

// Renders when the root layout itself throws. It replaces the entire document,
// so it must supply its own <html>/<body> and cannot rely on global styles,
// providers, or i18n being available — keep it self-contained and in English.
export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    Sentry.captureException(error, {
      tags: { boundary: "global" },
      extra: { digest: error.digest },
    });
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  return (
    <html lang="en">
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          flexDirection: "column",
          alignItems: "center",
          justifyContent: "center",
          gap: "1rem",
          padding: "1.5rem",
          textAlign: "center",
          fontFamily:
            "ui-sans-serif, system-ui, -apple-system, Segoe UI, Roboto, Helvetica, Arial, sans-serif",
          background: "#0d1f1e",
          color: "#f4f4f5",
        }}
      >
        <h1 style={{ fontSize: "1.5rem", fontWeight: 700, margin: 0 }}>Something went wrong</h1>
        <p style={{ maxWidth: "28rem", color: "#a1a1aa", margin: 0 }}>
          The app ran into an unexpected error. Please try reloading.
        </p>
        <button
          onClick={reset}
          style={{
            cursor: "pointer",
            borderRadius: "0.5rem",
            border: "none",
            padding: "0.5rem 1.25rem",
            fontSize: "0.875rem",
            fontWeight: 600,
            background: "#34d399",
            color: "#0d1f1e",
          }}
        >
          Reload
        </button>
      </body>
    </html>
  );
}
