"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatCurrency, formatNumber } from "@/lib/currencies";

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
  const [note, setNote] = useState("");
  const [saving, setSaving] = useState(false);

  async function handleSave() {
    if (balance.trim() === "") {
      setEditing(false);
      setNote("");
      return;
    }

    setSaving(true);
    try {
      await onSave(parseFloat(balance) || 0, note || undefined);
      setEditing(false);
      setBalance("");
      setNote("");
    } finally {
      setSaving(false);
    }
  }

  if (editing) {
    return (
      <div className="flex flex-col gap-2 mt-1">
        <div className="flex gap-2">
          <Input
            type="number"
            step="0.01"
            placeholder={formatNumber(currentBalance, 0)}
            value={balance}
            onChange={(e) => setBalance(e.target.value)}
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
      {formatCurrency(currentBalance, currency)}
    </p>
  );
}
