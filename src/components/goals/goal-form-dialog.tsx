"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
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
import { maskAmountInput, parseAmountInput, formatAmountInput } from "@/lib/amount-input";
import { ACCOUNT_CATEGORIES } from "@/lib/enums";
import { useIsMobile } from "@/hooks/use-is-mobile";
import type { SerializedAccount, SerializedGoal } from "@/lib/types";
import { toast } from "sonner";
import { assertOk, errorText } from "@/lib/api-error";

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
      targetAmount: formatAmountInput(Number(editGoal.targetAmount), 2),
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
  const tCommon = useTranslations("common");
  const tCategories = useTranslations("categories");
  const isMobile = useIsMobile();
  const [saving, setSaving] = useState(false);
  const [form, setForm] = useState(() => initialState(editGoal, defaultCurrency));
  type FieldError = "name" | "amount" | "scopeRef";
  const [errors, setErrors] = useState<Partial<Record<FieldError, string>>>({});
  const clearError = (field: FieldError) =>
    setErrors((e) => (e[field] ? { ...e, [field]: undefined } : e));

  const name = form.name;
  const targetAmount = form.targetAmount;
  const targetCurrency = form.targetCurrency;
  const targetDate = form.targetDate;
  const scope = form.scope;
  const scopeRefId = form.scopeRefId;

  function setName(v: string) {
    clearError("name");
    setForm((f) => ({ ...f, name: v }));
  }
  function setTargetAmount(v: string) {
    clearError("amount");
    setForm((f) => ({ ...f, targetAmount: v }));
  }
  function setTargetCurrency(v: string) {
    setForm((f) => ({ ...f, targetCurrency: v }));
  }
  function setTargetDate(v: string) {
    setForm((f) => ({ ...f, targetDate: v }));
  }
  function setScope(v: GoalScope) {
    clearError("scopeRef");
    setForm((f) => ({ ...f, scope: v, scopeRefId: "" }));
  }
  function setScopeRefId(v: string) {
    clearError("scopeRef");
    setForm((f) => ({ ...f, scopeRefId: v }));
  }

  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setForm(initialState(editGoal, defaultCurrency));
      setErrors({});
    }
    onOpenChange(nextOpen);
  }

  const needsScopeRef = scope === "CATEGORY" || scope === "ACCOUNT";

  function handleTargetAmountChange(e: React.ChangeEvent<HTMLInputElement>) {
    const next = maskAmountInput(e.target.value);
    if (next !== null) setTargetAmount(next);
  }

  function handleTargetAmountBlur() {
    const val = targetAmount.replace(/,/g, "");
    if (!val) return;
    const parsed = parseAmountInput(val);
    if (isNaN(parsed) || parsed <= 0) return;
    setTargetAmount(formatAmountInput(parsed, 2));
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const amount = parseAmountInput(targetAmount);
    const nextErrors: Partial<Record<FieldError, string>> = {};
    if (!name.trim()) nextErrors.name = t("form.nameRequired");
    if (isNaN(amount) || amount <= 0) nextErrors.amount = t("form.amountInvalid");
    if (needsScopeRef && !scopeRefId) nextErrors.scopeRef = t("form.scopeRefRequired");
    if (Object.keys(nextErrors).length > 0) {
      setErrors(nextErrors);
      return;
    }

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

      await assertOk(res, tCommon("sessionExpired"));

      toast.success(editGoal ? t("toast.updated") : t("toast.created"));
      onOpenChange(false);
      router.refresh();
    } catch (error) {
      toast.error(errorText(error, t("toast.failed")));
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
          aria-invalid={errors.name ? true : undefined}
          aria-describedby={errors.name ? "goal-name-error" : undefined}
        />
        {errors.name && (
          <p id="goal-name-error" role="alert" className="text-xs text-destructive">
            {errors.name}
          </p>
        )}
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
            aria-invalid={errors.amount ? true : undefined}
            aria-describedby={errors.amount ? "goal-amount-error" : undefined}
          />
          {errors.amount && (
            <p id="goal-amount-error" role="alert" className="text-xs text-destructive">
              {errors.amount}
            </p>
          )}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="goal-currency">{t("form.targetCurrency")}</Label>
          <Select value={targetCurrency} onValueChange={(v) => v && setTargetCurrency(v)}>
            <SelectTrigger id="goal-currency">
              <SelectValue>{targetCurrency}</SelectValue>
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
            <SelectValue>{t(`scope.${scope}`)}</SelectValue>
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
            <SelectTrigger
              id="goal-category"
              aria-invalid={errors.scopeRef ? true : undefined}
              aria-describedby={errors.scopeRef ? "goal-category-error" : undefined}
            >
              <SelectValue>
                {scopeRefId
                  ? tCategories(scopeRefId as Parameters<typeof tCategories>[0])
                  : t("form.categoryPlaceholder")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {ACCOUNT_CATEGORIES.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {tCategories(cat)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.scopeRef && (
            <p id="goal-category-error" role="alert" className="text-xs text-destructive">
              {errors.scopeRef}
            </p>
          )}
        </div>
      )}

      {/* Scope Ref — Account */}
      {scope === "ACCOUNT" && (
        <div className="space-y-1.5">
          <Label htmlFor="goal-account">{t("form.account")}</Label>
          <Select value={scopeRefId} onValueChange={(v) => v && setScopeRefId(v)}>
            <SelectTrigger
              id="goal-account"
              aria-invalid={errors.scopeRef ? true : undefined}
              aria-describedby={errors.scopeRef ? "goal-account-error" : undefined}
            >
              <SelectValue>
                {scopeRefId
                  ? (accounts.find((a) => a.id === scopeRefId)?.name ??
                    t("form.accountPlaceholder"))
                  : t("form.accountPlaceholder")}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {accounts.map((a) => (
                <SelectItem key={a.id} value={a.id}>
                  {a.name}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {errors.scopeRef && (
            <p id="goal-account-error" role="alert" className="text-xs text-destructive">
              {errors.scopeRef}
            </p>
          )}
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
