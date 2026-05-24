"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

interface InlineBalanceEditorProps {
  currentBalance: number;
  currency: string;
  notePlaceholder: string;
  onSave: (newBalance: number, note?: string) => Promise<void>;
  mode?: "hero" | "inline";
  inlineLabel?: string;
}

export function InlineBalanceEditor({
  currentBalance,
  currency,
  notePlaceholder,
  onSave,
  mode = "hero",
  inlineLabel,
}: InlineBalanceEditorProps) {
  const t = useTranslations();
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { privacyMode } = usePrivacyMode();

  function handleBalanceChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    setError("");
    if (!raw) {
      setBalance("");
      return;
    }
    const [intPart, decPart] = raw.split(".");
    const formatted = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setBalance(decPart !== undefined ? `${formatted}.${decPart}` : formatted);
  }

  function handleBalanceBlur() {
    const val = balance.replace(/,/g, "");
    if (!val) {
      setError("");
      return;
    }
    const parsed = parseFloat(val);
    if (isNaN(parsed)) {
      setError(t("accountDetail.invalidAmount"));
      return;
    }
    setError("");
    setBalance(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed));
  }

  async function handleSave() {
    const val = balance.replace(/,/g, "");
    if (val.trim() === "") {
      setEditing(false);
      setNote("");
      setError("");
      return;
    }

    const parsed = parseFloat(val);
    if (isNaN(parsed)) {
      setError(t("accountDetail.invalidAmount"));
      return;
    }

    setSaving(true);
    try {
      await onSave(parsed, note || undefined);
      setEditing(false);
      setBalance("");
      setNote("");
      setError("");
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
          placeholder={notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 text-sm"
        />
        <div className="flex gap-2">
          <Button size="sm" className="flex-1" onClick={handleSave} disabled={saving}>
            {saving ? t("common.saving") : t("common.save")}
          </Button>
          <Button
            size="sm"
            variant="outline"
            className="flex-1"
            onClick={() => {
              setEditing(false);
              setNote("");
            }}
          >
            {t("common.cancel")}
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
        onClick={() => setEditing(true)}
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
      onClick={() => setEditing(true)}
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
