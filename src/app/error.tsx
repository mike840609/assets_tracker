"use client" // Error boundaries must be Client Components

import { useEffect } from "react"
import { AlertTriangle, RefreshCw, Home } from "lucide-react"
import Link from "next/link"

export default function ErrorPage({
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
    <div className="flex min-h-[80vh] w-full items-center justify-center relative overflow-hidden">
      {/* Ambient background */}
      <div className="absolute top-[-10%] left-[-10%] w-[50%] h-[50%] rounded-full bg-destructive/8 blur-3xl pointer-events-none -z-10 animate-pulse" />
      <div className="absolute bottom-[-10%] right-[-5%] w-[40%] h-[40%] rounded-full bg-chart-4/8 blur-3xl pointer-events-none -z-10 animate-pulse" style={{ animationDelay: "2s" }} />

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-col items-center justify-center space-y-6 p-10 bg-card/80 backdrop-blur-xl border border-border/50 shadow-[0_8px_32px_-8px_rgba(0,0,0,0.12)] dark:shadow-[0_8px_32px_-8px_rgba(0,0,0,0.5)] rounded-3xl">
        {/* Icon */}
        <div
          className="w-16 h-16 rounded-xl flex items-center justify-center shadow-lg"
          style={{ background: "linear-gradient(135deg, #f97316 0%, #dc2626 100%)" }}
        >
          <AlertTriangle className="w-7 h-7 text-white" strokeWidth={2} />
        </div>

        {/* Copy */}
        <div className="flex flex-col space-y-2 text-center">
          <h2 className="text-2xl font-extrabold tracking-tight bg-gradient-to-r from-foreground to-muted-foreground bg-clip-text text-transparent">
            Something went wrong
          </h2>
          <p className="text-sm text-muted-foreground font-medium leading-relaxed">
            An unexpected error occurred. You can try again or return to the dashboard.
          </p>
          {error.digest && (
            <p className="text-xs text-muted-foreground/60 font-mono mt-1">
              Error ID: {error.digest}
            </p>
          )}
        </div>

        {/* Actions */}
        <div className="flex flex-col gap-3 w-full pt-2">
          <button
            onClick={() => unstable_retry()}
            className="w-full h-12 text-[15px] font-medium tracking-wide bg-primary text-primary-foreground hover:bg-primary/90 shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl flex items-center justify-center gap-2.5"
          >
            <RefreshCw className="w-4 h-4" />
            Try Again
          </button>
          <Link
            href="/"
            className="w-full h-12 text-[15px] font-medium tracking-wide bg-background text-foreground hover:bg-secondary border border-border shadow-sm hover:shadow-md transition-all hover:-translate-y-0.5 rounded-xl flex items-center justify-center gap-2.5"
          >
            <Home className="w-4 h-4" />
            Back to Dashboard
          </Link>
        </div>
      </div>
    </div>
  )
}
