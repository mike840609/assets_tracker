"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/currencies";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

/** Today as a local-timezone YYYY-MM-DD string (for the occurrence-date input). */
function localToday(): string {
  const now = new Date();
  return new Date(now.getTime() - now.getTimezoneOffset() * 60000).toISOString().slice(0, 10);
}

interface InlineBalanceEditorProps {
  currentBalance: number;
  currency: string;
  notePlaceholder?: string;
  onSave: (newBalance: number, note?: string, occurrenceDate?: string) => Promise<void>;
  mode?: "hero" | "inline";
  inlineLabel?: string;
}

export function InlineBalanceEditor({
  currentBalance,
  currency,
  notePlaceholder = "Note (e.g. Salary, Rent...)",
  onSave,
  mode = "hero",
  inlineLabel,
}: InlineBalanceEditorProps) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  // Calendar day the cash flow happened (#500) — defaults to today each time
  // the editor opens; the logged EDIT transaction is stamped with it.
  const [occurredOn, setOccurredOn] = useState(localToday);
  const [saving, setSaving] = useState(false);
  const { privacyMode } = usePrivacyMode();

  function resetEditor() {
    setEditing(false);
    setBalance("");
    setNote("");
    setError("");
    setOccurredOn(localToday());
  }

  function handleBalanceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next === null) return;
    setError("");
    setBalance(next);
  }

  function handleBalanceBlur() {
    const val = balance.replace(/,/g, "");
    if (!val) {
      setError("");
      return;
    }
    const parsed = parseAmountInput(val);
    if (isNaN(parsed)) {
      setError("Invalid amount");
      return;
    }
    setError("");
    setBalance(formatAmountInput(parsed, 2));
  }

  async function handleSave() {
    const val = balance.replace(/,/g, "");
    if (val.trim() === "") {
      resetEditor();
      return;
    }

    const parsed = parseAmountInput(val);
    if (isNaN(parsed)) {
      setError("Invalid amount");
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed, note || undefined, occurredOn || undefined);
      resetEditor();
    } catch {
      // onSave surfaces its own error toast; keep the editor open with the entered value.
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 mt-1 max-w-xs">
        <Input
          type="text"
          inputMode="decimal"
          placeholder={formatNumber(currentBalance, 0)}
          value={balance}
          onChange={handleBalanceChange}
          onBlur={handleBalanceBlur}
          className="h-8 w-full min-w-[160px]"
          autoFocus
        />
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Input
          type="date"
          aria-label={t("accountDetail.labelOccurredOn")}
          value={occurredOn}
          onChange={(e) => setOccurredOn(e.target.value)}
          className="h-11 md:h-8 text-sm"
        />
        <Input
          placeholder={notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? "..." : "Save"}
          </Button>
          <Button size="sm" variant="outline" className="flex-1" onClick={resetEditor}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  const displayValue = privacyMode ? "***" : formatCurrency(currentBalance, currency);
  const editLabel = t("common.edit");

  if (mode === "inline") {
    return (
      <button
        type="button"
        onClick={() => {
          setOccurredOn(localToday());
          setEditing(true);
        }}
        aria-label={`${inlineLabel ?? ""} ${displayValue}. ${editLabel}`.trim()}
        className="group inline-flex items-center gap-1.5 rounded-md px-1 -mx-1 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none transition-colors"
      >
        {inlineLabel && <span className="text-muted-foreground">{inlineLabel}</span>}
        <span aria-live="polite" className="tabular-nums font-medium text-foreground">
          {displayValue}
        </span>
        <Pencil
          aria-hidden
          className="h-3 w-3 text-muted-foreground/60 group-hover:text-foreground transition-colors"
        />
      </button>
    );
  }

  return (
    <button
      type="button"
      onClick={() => {
        setOccurredOn(localToday());
        setEditing(true);
      }}
      aria-label={`${displayValue}. ${editLabel}`}
      className="group inline-flex items-center gap-2 rounded-md px-1 -mx-1 hover:bg-accent/60 focus-visible:bg-accent/60 focus-visible:outline-none transition-colors text-left"
    >
      <span
        aria-live="polite"
        className="text-4xl font-bold tracking-tight tabular-nums text-foreground"
      >
        {displayValue}
      </span>
      <Pencil
        aria-hidden
        className="h-4 w-4 text-muted-foreground/60 group-hover:text-foreground transition-colors shrink-0"
      />
    </button>
  );
}
