"use client" // Error boundaries must be Client Components

import { useEffect } from "react"

/**
 * Global error boundary — last-resort fallback when the root layout itself
 * throws. Must define its own <html>/<body> since it replaces the root layout.
 *
 * Next.js 16 note: metadata/generateMetadata exports are NOT supported in
 * global-error. Use the React <title> component instead.
 */
export default function GlobalError({
  error,
  unstable_retry,
}: {
  error: Error & { digest?: string }
  unstable_retry: () => void
}) {
  useEffect(() => {
    console.error(error)
  }, [error])

  return (
    <html lang="en">
      <head>
        <title>Assets Tracker — Error</title>
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <style
          dangerouslySetInnerHTML={{
            __html: `
              *{margin:0;padding:0;box-sizing:border-box}
              body{
                min-height:100vh;display:flex;align-items:center;justify-content:center;
                font-family:system-ui,-apple-system,BlinkMacSystemFont,'Segoe UI',Roboto,sans-serif;
                background:#0d1117;color:#e6edf3;
              }
              .card{
                max-width:420px;width:90%;text-align:center;
                background:rgba(22,27,34,0.85);border:1px solid rgba(48,54,61,0.6);
                border-radius:24px;padding:48px 40px;
                box-shadow:0 8px 32px -8px rgba(0,0,0,0.5);
              }
              .icon{
                width:64px;height:64px;margin:0 auto 24px;border-radius:12px;
                display:flex;align-items:center;justify-content:center;
                background:linear-gradient(135deg,#f97316,#dc2626);
                box-shadow:0 4px 16px rgba(220,38,38,0.3);
              }
              .icon svg{width:28px;height:28px;color:#fff}
              h2{font-size:22px;font-weight:800;margin-bottom:8px;letter-spacing:-0.02em}
              p{font-size:14px;color:#8b949e;line-height:1.6;margin-bottom:4px}
              .digest{font-size:12px;color:rgba(139,148,158,0.5);font-family:monospace}
              .actions{display:flex;flex-direction:column;gap:12px;margin-top:28px}
              button,a{
                display:flex;align-items:center;justify-content:center;gap:8px;
                height:48px;border-radius:12px;font-size:15px;font-weight:500;
                cursor:pointer;border:none;text-decoration:none;transition:all .15s;
              }
              button{background:#34d399;color:#064e3b}
              button:hover{background:#6ee7b7;transform:translateY(-1px);box-shadow:0 4px 12px rgba(52,211,153,0.25)}
              a{background:transparent;color:#e6edf3;border:1px solid rgba(48,54,61,0.6)}
              a:hover{background:rgba(48,54,61,0.4);transform:translateY(-1px)}
            `,
          }}
        />
      </head>
      <body>
        <div className="card">
          <div className="icon">
            <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="m21.73 18-8-14a2 2 0 0 0-3.48 0l-8 14A2 2 0 0 0 4 21h16a2 2 0 0 0 1.73-3" />
              <path d="M12 9v4" />
              <path d="M12 17h.01" />
            </svg>
          </div>
          <h2>Something went wrong</h2>
          <p>A critical error occurred. Please try again or return to the home page.</p>
          {error.digest && <p className="digest">Error ID: {error.digest}</p>}
          <div className="actions">
            <button onClick={() => unstable_retry()}>
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M21 12a9 9 0 1 1-9-9c2.52 0 4.93 1 6.74 2.74L21 8" />
                <path d="M21 3v5h-5" />
              </svg>
              Try Again
            </button>
            <a href="/">
              <svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="m3 9 9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z" />
                <polyline points="9 22 9 12 15 12 15 22" />
              </svg>
              Back to Home
            </a>
          </div>
        </div>
      </body>
    </html>
  )
}
