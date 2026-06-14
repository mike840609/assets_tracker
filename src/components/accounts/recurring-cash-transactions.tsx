"use client";

import { useCallback, useEffect, useState } from "react";
import { useTranslations } from "next-intl";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import { Plus } from "lucide-react";
import { toast } from "sonner";
import { formatCurrency } from "@/lib/currencies";
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";
import { RECURRING_FREQUENCIES } from "@/lib/enums";
import type { SerializedRecurringCashTransaction } from "@/lib/types";
import { formatRunDate } from "./recurring-utils";
import { RecurringRowMenu } from "./recurring-row-menu";

type Rule = SerializedRecurringCashTransaction;

function todayDateOnly(): string {
  return new Date().toISOString().slice(0, 10);
}

export function RecurringCashTransactions({
  accountId,
  currency,
  refreshTrigger,
  onChange,
}: {
  accountId: string;
  currency: string;
  refreshTrigger?: number;
  onChange?: () => void;
}) {
  const t = useTranslations("recurringCash");
  const tCommon = useTranslations("common");

  const [rules, setRules] = useState<Rule[]>([]);
  const [loading, setLoading] = useState(true);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<Rule | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // Form state
  const [type, setType] = useState<"DEPOSIT" | "WITHDRAWAL">("DEPOSIT");
  const [amount, setAmount] = useState("");
  const [frequency, setFrequency] = useState<Rule["frequency"]>("MONTHLY");
  const [startDate, setStartDate] = useState(todayDateOnly());
  const [endDate, setEndDate] = useState("");
  const [note, setNote] = useState("");

  const load = useCallback(async () => {
    try {
      const res = await fetch(`/api/accounts/${accountId}/recurring-cash-transactions`);
      if (!res.ok) {
        setRules([]);
        return;
      }
      const json = (await res.json().catch(() => null)) as { data?: { rules: Rule[] } } | null;
      setRules(json?.data?.rules ?? []);
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    void load();
  }, [load]);

  useEffect(() => {
    if (refreshTrigger) void load();
  }, [refreshTrigger, load]);

  function resetForm() {
    setType("DEPOSIT");
    setAmount("");
    setFrequency("MONTHLY");
    setStartDate(todayDateOnly());
    setEndDate("");
    setNote("");
  }

  function openAdd() {
    setEditing(null);
    resetForm();
    setDialogOpen(true);
  }

  function openEdit(rule: Rule) {
    setEditing(rule);
    setType(rule.type);
    setAmount(formatAmountInput(rule.amount, 2));
    setFrequency(rule.frequency);
    setStartDate(rule.startDate);
    setEndDate(rule.endDate ?? "");
    setNote(rule.note ?? "");
    setDialogOpen(true);
  }

  function handleAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next !== null) setAmount(next);
  }

  function handleAmountBlur() {
    const raw = amount.replace(/,/g, "");
    if (!raw) return;
    const parsed = parseAmountInput(raw);
    if (!isNaN(parsed)) setAmount(formatAmountInput(parsed, 2));
  }

  async function handleSave() {
    const parsedAmount = parseAmountInput(amount.replace(/,/g, ""));
    if (isNaN(parsedAmount) || parsedAmount <= 0) {
      toast.error(t("createFailed"));
      return;
    }
    setSubmitting(true);
    const payload = {
      type,
      amount: parsedAmount,
      frequency,
      startDate,
      endDate: endDate || null,
      note: note || null,
    };
    try {
      const res = editing
        ? await fetch(`/api/accounts/${accountId}/recurring-cash-transactions/${editing.id}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          })
        : await fetch(`/api/accounts/${accountId}/recurring-cash-transactions`, {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(payload),
          });
      if (!res.ok) throw new Error();
      toast.success(editing ? t("updateSuccess") : t("createSuccess"));
      setDialogOpen(false);
      await load();
      onChange?.();
    } catch {
      toast.error(editing ? t("updateFailed") : t("createFailed"));
    } finally {
      setSubmitting(false);
    }
  }

  async function toggleActive(rule: Rule) {
    try {
      const res = await fetch(`/api/accounts/${accountId}/recurring-cash-transactions/${rule.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !rule.isActive }),
      });
      if (!res.ok) throw new Error();
      await load();
    } catch {
      toast.error(t("updateFailed"));
    }
  }

  async function handleDelete(rule: Rule) {
    if (!window.confirm(t("deleteConfirm"))) return;
    try {
      const res = await fetch(`/api/accounts/${accountId}/recurring-cash-transactions/${rule.id}`, {
        method: "DELETE",
      });
      if (!res.ok) throw new Error();
      toast.success(t("deleteSuccess"));
      await load();
      onChange?.();
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <section aria-label={t("sectionLabel")}>
      <div className="flex items-center justify-between gap-3 mb-3">
        <h4 className="text-sm font-medium">{t("sectionLabel")}</h4>
        <Button
          size="sm"
          variant="ghost"
          className="h-7 -mr-2 px-2 text-primary hover:text-primary"
          onClick={openAdd}
        >
          <Plus className="h-4 w-4 mr-1" />
          {t("add")}
        </Button>
      </div>

      {loading ? (
        <div className="h-10 rounded-xl bg-muted/40 animate-pulse" />
      ) : rules.length === 0 ? (
        <p className="text-sm text-muted-foreground">{t("empty")}</p>
      ) : (
        <ul className="rounded-xl border border-border/50 overflow-hidden divide-y divide-border/50">
          {rules.map((rule) => {
            const ended = rule.endDate !== null && rule.nextRunDate > rule.endDate;
            const inactive = !rule.isActive || ended;
            const signed = rule.type === "WITHDRAWAL" ? -rule.amount : rule.amount;
            return (
              <li
                key={rule.id}
                className={`flex items-center gap-3 px-3.5 py-3 bg-card ${inactive ? "opacity-55" : ""}`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-baseline gap-2 flex-wrap">
                    <span className="text-sm font-semibold tabular-nums">
                      {signed > 0 ? "+" : "−"}
                      {formatCurrency(Math.abs(signed), currency)}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {t(`freq${rule.frequency}` as Parameters<typeof t>[0])}
                    </span>
                    {ended ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
                        {t("ended")}
                      </Badge>
                    ) : !rule.isActive ? (
                      <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
                        {t("paused")}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5 truncate">
                    {!inactive ? t("nextRun", { date: formatRunDate(rule.nextRunDate) }) : null}
                    {rule.note ? `${!inactive ? " · " : ""}${rule.note}` : ""}
                  </p>
                </div>
                <RecurringRowMenu
                  ariaLabel={tCommon("actionsFor", {
                    name: t(`freq${rule.frequency}` as Parameters<typeof t>[0]),
                  })}
                  ended={ended}
                  isActive={rule.isActive}
                  labels={{
                    edit: tCommon("edit"),
                    pause: t("pause"),
                    resume: t("resume"),
                    delete: tCommon("delete"),
                  }}
                  onEdit={() => openEdit(rule)}
                  onToggle={() => void toggleActive(rule)}
                  onDelete={() => void handleDelete(rule)}
                />
              </li>
            );
          })}
        </ul>
      )}

      <Dialog open={dialogOpen} onOpenChange={(open) => !open && setDialogOpen(false)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing ? t("editTitle") : t("addTitle")}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-2">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rc-type">{t("labelType")}</Label>
                <Select value={type} onValueChange={(v) => v && setType(v as typeof type)}>
                  <SelectTrigger id="rc-type" className="w-full">
                    <SelectValue>
                      {t(type === "DEPOSIT" ? "typeDeposit" : "typeWithdrawal")}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="DEPOSIT">{t("typeDeposit")}</SelectItem>
                    <SelectItem value="WITHDRAWAL">{t("typeWithdrawal")}</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div className="space-y-2">
                <Label htmlFor="rc-amount">{t("labelAmount")}</Label>
                <div className="flex items-center gap-2">
                  <Input
                    id="rc-amount"
                    type="text"
                    inputMode="decimal"
                    value={amount}
                    onChange={handleAmountChange}
                    onBlur={handleAmountBlur}
                    className="min-w-0 flex-1"
                  />
                  <span className="text-xs text-muted-foreground shrink-0">{currency}</span>
                </div>
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc-frequency">{t("labelFrequency")}</Label>
              <Select
                value={frequency}
                onValueChange={(v) => v && setFrequency(v as Rule["frequency"])}
              >
                <SelectTrigger id="rc-frequency" className="w-full">
                  <SelectValue>{t(`freq${frequency}` as Parameters<typeof t>[0])}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {RECURRING_FREQUENCIES.map((f) => (
                    <SelectItem key={f} value={f}>
                      {t(`freq${f}` as Parameters<typeof t>[0])}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label htmlFor="rc-start">{t("labelStartDate")}</Label>
                <Input
                  id="rc-start"
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="rc-end">{t("labelEndDate")}</Label>
                <Input
                  id="rc-end"
                  type="date"
                  value={endDate}
                  min={startDate}
                  onChange={(e) => setEndDate(e.target.value)}
                />
              </div>
            </div>
            <div className="space-y-2">
              <Label htmlFor="rc-note">{t("labelNote")}</Label>
              <Input id="rc-note" value={note} onChange={(e) => setNote(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              {tCommon("cancel")}
            </Button>
            <Button onClick={handleSave} disabled={submitting}>
              {submitting ? tCommon("saving") : tCommon("save")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </section>
  );
}
