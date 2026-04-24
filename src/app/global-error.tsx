"use client"; // Error boundaries must be Client Components
// global-error.tsx must include its own <html> and <body> tags — it replaces
// the root layout when active. No next-intl provider is available here.

import { useEffect } from "react";
import "./globals.css";

export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string };
  unstable_retry: () => void;
}) {
  useEffect(() => {
    console.error("[global-error.tsx]", error);
  }, [error]);

  return (
    <html lang="en" className="h-full antialiased">
      <head>
        <title>Something went wrong — Assets Tracker</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
      </head>
      <body
        style={{
          margin: 0,
          minHeight: "100vh",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "oklch(0.14 0.030 200)",
          color: "oklch(0.96 0.010 190)",
          fontFamily:
            "system-ui, -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif",
          padding: "1rem",
        }}
      >
        <div
          style={{
            maxWidth: 420,
            width: "100%",
            borderRadius: "1.5rem",
            border: "1px solid oklch(0.30 0.038 200)",
            background: "oklch(0.19 0.035 200)",
            padding: "2.5rem",
            textAlign: "center",
            boxShadow: "0 8px 32px -8px rgba(0,0,0,0.5)",
          }}
        >
          {/* Icon */}
          <div
            style={{
              margin: "0 auto 1.5rem",
              width: 64,
              height: 64,
              borderRadius: "0.75rem",
              display: "flex",
              alignItems: "center",
              justifyContent: "center",
              background: "linear-gradient(135deg, #f87171 0%, #7f1d1d 100%)",
              fontSize: "2rem",
            }}
            aria-hidden="true"
          >
            ⚠️
          </div>

          {/* Copy */}
          <h1
            style={{
              margin: "0 0 0.5rem",
              fontSize: "1.375rem",
              fontWeight: 800,
              letterSpacing: "-0.02em",
            }}
          >
            Something went wrong
          </h1>
          <p
            style={{
              margin: "0 0 1.5rem",
              fontSize: "0.875rem",
              color: "oklch(0.70 0.020 195)",
              lineHeight: 1.6,
            }}
          >
            A critical error occurred. Our team has been notified.
            <br />
            Please try again or return to the home page.
          </p>
          {error.digest && (
            <p
              style={{
                marginBottom: "1.5rem",
                fontSize: "0.75rem",
                fontFamily: "monospace",
                color: "oklch(0.55 0.020 195)",
              }}
            >
              Ref: {error.digest}
            </p>
          )}

          {/* Actions */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem" }}>
            <button
              id="global-error-retry-btn"
              onClick={() => unstable_retry()}
              style={{
                padding: "0.75rem 1.5rem",
                borderRadius: "0.75rem",
                background: "oklch(0.80 0.17 170)",
                color: "oklch(0.12 0.03 170)",
                border: "none",
                fontWeight: 700,
                fontSize: "0.875rem",
                cursor: "pointer",
                transition: "opacity 0.15s",
              }}
            >
              Try again
            </button>
            <a
              id="global-error-home-link"
              href="/"
              style={{
                fontSize: "0.875rem",
                color: "oklch(0.70 0.020 195)",
                textDecoration: "underline",
              }}
            >
              Return to home
            </a>
          </div>
        </div>
      </body>
    </html>
  );
}
