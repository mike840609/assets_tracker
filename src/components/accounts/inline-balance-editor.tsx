"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/currencies";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

interface InlineBalanceEditorProps {
  currentBalance: number;
  currency: string;
  notePlaceholder?: string;
  onSave: (newBalance: number, note?: string) => Promise<void>;
}

export function InlineBalanceEditor({
  currentBalance,
  currency,
  notePlaceholder = "Note (e.g. Salary, Rent...)",
  onSave,
}: InlineBalanceEditorProps) {
  const [editing, setEditing] = useState(false);
  const [balance, setBalance] = useState("");
  const [error, setError] = useState("");
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);
  const { privacyMode } = usePrivacyMode();

  function handleBalanceBlur() {
    const val = balance.replace(/,/g, "");
    if (!val) {
      setError("");
      return;
    }
    const parsed = parseFloat(val);
    if (isNaN(parsed)) {
      setError("Invalid amount");
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
      setError("Invalid amount");
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
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex gap-2">
          <Input
            type="text"
            inputMode="decimal"
            placeholder={formatNumber(currentBalance, 0)}
            value={balance}
            onChange={(e) => {
              setBalance(e.target.value);
              setError("");
            }}
            onBlur={handleBalanceBlur}
            className="h-8 flex-1"
            autoFocus
          />
          <Button size="sm" onClick={handleSave} disabled={saving}>
            {saving ? "..." : "Save"}
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              setEditing(false);
              setNote("");
            }}
          >
            Cancel
          </Button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
        <Input
          placeholder={notePlaceholder}
          value={note}
          onChange={(e) => setNote(e.target.value)}
          className="h-8 text-sm"
        />
      </div>
    );
  }

  return (
    <p
      className="text-2xl font-bold mt-1 cursor-pointer hover:text-primary"
      onClick={() => setEditing(true)}
    >
      {privacyMode ? "***" : formatCurrency(currentBalance, currency)}
    </p>
  );
}
