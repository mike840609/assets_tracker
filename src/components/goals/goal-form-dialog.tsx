"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
} from "@/components/ui/drawer";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { ACCOUNT_CATEGORIES } from "@/lib/enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { SerializedAccount, SerializedGoal } from "@/lib/types";
import { toast } from "sonner";

type GoalScope = "NET_WORTH" | "ASSETS_ONLY" | "CATEGORY" | "ACCOUNT";

interface GoalFormDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  editGoal?: SerializedGoal;
  accounts: SerializedAccount[];
  defaultCurrency: string;
}

const SCOPE_OPTIONS: GoalScope[] = ["NET_WORTH", "ASSETS_ONLY", "CATEGORY", "ACCOUNT"];

function initialState(editGoal: SerializedGoal | undefined, defaultCurrency: string) {
  if (editGoal) {
    return {
      name: editGoal.name,
      targetAmount: new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(
        Number(editGoal.targetAmount),
      ),
      targetCurrency: editGoal.targetCurrency,
      targetDate: editGoal.targetDate ? editGoal.targetDate.slice(0, 10) : "",
      scope: editGoal.scope as GoalScope,
      scopeRefId: editGoal.scopeRefId ?? "",
    };
  }
  return {
    name: "",
    targetAmount: "",
    targetCurrency: defaultCurrency,
    targetDate: "",
    scope: "NET_WORTH" as GoalScope,
    scopeRefId: "",
  };
}

export function GoalFormDialog({
  open,
  onOpenChange,
  editGoal,
  accounts,
  defaultCurrency,
}: GoalFormDialogProps) {
  const router = useRouter();
  const t = useTranslations("goals");
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialState(editGoal, defaultCurrency));

  const name = form.name;
  const targetAmount = form.targetAmount;
  const targetCurrency = form.targetCurrency;
  const targetDate = form.targetDate;
  const scope = form.scope;
  const scopeRefId = form.scopeRefId;

  function setName(v: string) {
    setForm((f) => ({ ...f, name: v }));
  }
  function setTargetAmount(v: string) {
    setForm((f) => ({ ...f, targetAmount: v }));
  }
  function setTargetCurrency(v: string) {
    setForm((f) => ({ ...f, targetCurrency: v }));
  }
  function setTargetDate(v: string) {
    setForm((f) => ({ ...f, targetDate: v }));
  }
  function setScope(v: GoalScope) {
    setForm((f) => ({ ...f, scope: v, scopeRefId: "" }));
  }
  function setScopeRefId(v: string) {
    setForm((f) => ({ ...f, scopeRefId: v }));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setForm(initialState(editGoal, defaultCurrency));
    }
    onOpenChange(nextOpen);
  }

  const needsScopeRef = scope === "CATEGORY" || scope === "ACCOUNT";

  function handleTargetAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const raw = e.target.value.replace(/,/g, "");
    if (raw !== "" && !/^\d*\.?\d*$/.test(raw)) return;
    if (!raw) {
      setTargetAmount("");
      return;
    }
    const [intPart, decPart] = raw.split(".");
    const formattedInt = (intPart || "").replace(/\B(?=(\d{3})+(?!\d))/g, ",");
    setTargetAmount(decPart !== undefined ? `${formattedInt}.${decPart}` : formattedInt);
  }

  function handleTargetAmountBlur() {
    const val = targetAmount.replace(/,/g, "");
    if (!val) return;
    const parsed = parseFloat(val);
    if (isNaN(parsed) || parsed <= 0) return;
    setTargetAmount(new Intl.NumberFormat("en-US", { maximumFractionDigits: 2 }).format(parsed));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseFloat(targetAmount.replace(/,/g, ""));
    if (!name.trim() || isNaN(amount) || amount <= 0) return;
    if (needsScopeRef && !scopeRefId) return;

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        targetAmount: amount,
        targetCurrency,
        targetDate: targetDate || null,
        scope,
        scopeRefId: needsScopeRef ? scopeRefId : null,
      };

      const res = await fetch(editGoal ? `/api/goals/${editGoal.id}` : "/api/goals", {
        method: editGoal ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({}));
        throw new Error(err?.error?.message ?? "Failed");
      }

      toast.success(editGoal ? t("toast.updated") : t("toast.created"));
      onOpenChange(false);
      router.refresh();
    } catch (err) {
      toast.error(err instanceof Error ? err.message : t("toast.failed"));
    } finally {
      setSaving(false);
    }
  }

  const titleText = editGoal ? t("form.editTitle") : t("form.createTitle");

  const formFields = (
    <>
      {/* Name */}
      <div className="space-y-1.5">
        <Label htmlFor="goal-name">{t("form.name")}</Label>
        <Input
          id="goal-name"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder={t("form.namePlaceholder")}
          required
          maxLength={100}
        />
      </div>

      {/* Target Amount + Currency */}
      <div className="grid grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <Label htmlFor="goal-amount">{t("form.targetAmount")}</Label>
          <Input
            id="goal-amount"
            type="text"
            inputMode="decimal"
            value={targetAmount}
            onChange={handleTargetAmountChange}
            onBlur={handleTargetAmountBlur}
            placeholder="1,000,000"
            required
          />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-currency">{t("form.targetCurrency")}</Label>
          <Select value={targetCurrency} onValueChange={(v) => v && setTargetCurrency(v)}>
            <SelectTrigger id="goal-currency">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Target Date */}
      <div className="space-y-1.5">
        <Label htmlFor="goal-date">{t("form.targetDate")}</Label>
        <Input
          id="goal-date"
          type="date"
          value={targetDate}
          onChange={(e) => setTargetDate(e.target.value)}
          min={new Date().toISOString().slice(0, 10)}
        />
        <p className="text-xs text-muted-foreground">{t("form.targetDateHint")}</p>
      </div>

      {/* Scope */}
      <div className="space-y-1.5">
        <Label htmlFor="goal-scope">{t("form.scope")}</Label>
        <Select
          value={scope}
          onValueChange={(v) => {
            setScope(v as GoalScope);
            setScopeRefId("");
          }}
        >
          <SelectTrigger id="goal-scope">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            {SCOPE_OPTIONS.map((s) => (
              <SelectItem key={s} value={s}>
                {t(`scope.${s}`)}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Scope Ref — Category */}
      {scope === "CATEGORY" && (
        <div className="space-y-1.5">
          <Label htmlFor="goal-category">{t("form.category")}</Label>
          <Select value={scopeRefId} onValueChange={(v) => v && setScopeRefId(v)}>
            <SelectTrigger id="goal-category">
              <SelectValue placeholder={t("form.categoryPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {cat
                    .replace(/_/g, " ")
                    .toLowerCase()
                    .replace(/^\w/, (c) => c.toUpperCase())}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* Scope Ref — Account */}
      {scope === "ACCOUNT" && (
        <div className="space-y-1.5">
          <Label htmlFor="goal-account">{t("form.account")}</Label>
          <Select value={scopeRefId} onValueChange={(v) => v && setScopeRefId(v)}>
            <SelectTrigger id="goal-account">
              <SelectValue placeholder={t("form.accountPlaceholder")} />
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}
    </>
  );

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => handleOpenChange(o)}>
        <DrawerContent showCloseButton={false}>
          <DrawerHeader>
            <DrawerTitle>{titleText}</DrawerTitle>
          </DrawerHeader>
          <form onSubmit={handleSubmit} className="px-4 pb-4 space-y-4">
            {formFields}
            <div className="flex flex-col-reverse gap-2 pt-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => onOpenChange(false)}
                disabled={saving}
                className="w-full"
              >
                {t("form.cancel")}
              </Button>
              <Button
                type="submit"
                disabled={saving || (needsScopeRef && !scopeRefId)}
                className="w-full"
              >
                {saving ? t("form.saving") : editGoal ? t("form.save") : t("form.create")}
              </Button>
            </div>
          </form>
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => handleOpenChange(o)}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{titleText}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4 pt-2">
          {formFields}
          <div className="flex justify-end gap-2 pt-2">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={saving}
            >
              {t("form.cancel")}
            </Button>
            <Button type="submit" disabled={saving || (needsScopeRef && !scopeRefId)}>
              {saving ? t("form.saving") : editGoal ? t("form.save") : t("form.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
