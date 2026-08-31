"use client";

import { Check, Copy } from "lucide-react";
import { useState } from "react";

type LandingCopyButtonProps = {
  value: string;
  label: string;
  copiedLabel: string;
  failedLabel: string;
};

export function LandingCopyButton({
  value,
  label,
  copiedLabel,
  failedLabel,
}: LandingCopyButtonProps) {
  const [status, setStatus] = useState<"idle" | "copied" | "failed">("idle");
  const statusLabel = status === "copied" ? copiedLabel : status === "failed" ? failedLabel : label;

  async function copyCommand() {
    if (!navigator.clipboard) {
      setStatus("failed");
      return;
    }

    try {
      await navigator.clipboard.writeText(value);
      setStatus("copied");
    } catch {
      setStatus("failed");
    }
  }

  return (
    <button
      type="button"
      onClick={copyCommand}
      aria-label={statusLabel}
      title={statusLabel}
      className="inline-flex min-h-11 min-w-11 shrink-0 self-start items-center justify-center rounded-md border border-border/70 bg-background/40 p-0 text-xs font-medium text-foreground transition-colors hover:bg-secondary focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:min-h-0 md:w-8 md:min-w-0"
    >
      {status === "copied" ? (
        <Check className="h-3.5 w-3.5 animate-in zoom-in-75 duration-150" aria-hidden="true" />
      ) : (
        <Copy className="h-3.5 w-3.5" aria-hidden="true" />
      )}
      <span aria-live="polite" className="sr-only">
        {statusLabel}
      </span>
    </button>
  );
}
