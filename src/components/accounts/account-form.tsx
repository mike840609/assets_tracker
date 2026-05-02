"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
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
import { CURRENCIES } from "@/lib/currencies";
import { toast } from "sonner";
import { useTranslations } from "next-intl";

const CATEGORY_KEYS = [
  "BANK",
  "BROKERAGE",
  "CRYPTO_WALLET",
  "PROPERTY",
  "VEHICLE",
  "CREDIT_CARD",
  "LOAN",
  "MORTGAGE",
  "OTHER",
] as const;

export function AccountForm({
  open,
  onClose,
  defaultCurrency = "USD",
}: {
  open: boolean;
  onClose: () => void;
  defaultCurrency?: string;
}) {
  const router = useRouter();
  const t = useTranslations();
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState("");
  const [type, setType] = useState<"ASSET" | "LIABILITY">("ASSET");
  const [category, setCategory] = useState("BANK");
  const [currency, setCurrency] = useState(defaultCurrency);
  const [cashBalance, setCashBalance] = useState("0");

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch("/api/accounts", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          name,
          type,
          category,
          currency,
          cashBalance: parseFloat(cashBalance) || 0,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.issues?.fieldErrors?.name?.[0] || t("accountForm.createFailed"));
      }

      toast.success(t("accountForm.created"));
      setName("");
      setCashBalance("0");
      onClose();
      router.refresh();
    } catch (error) {
      toast.error(error instanceof Error ? error.message : t("accountForm.createFailed"));
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto translate-x-0 translate-y-0 max-h-[90vh] overflow-y-auto rounded-t-2xl rounded-b-none border-t pb-[calc(env(safe-area-inset-bottom)+1rem)] data-[ending-style]:translate-y-full sm:top-1/2 sm:bottom-auto sm:max-w-lg sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-6">
        <DialogHeader>
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
          <DialogTitle>{t("accountForm.title")}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <Label>{t("accountForm.labelName")}</Label>
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder={t("accountForm.placeholderName")}
              required
            />
          </div>

          <div className="grid grid-cols-2 gap-4">
            <div className="space-y-2">
              <Label>{t("accountForm.labelType")}</Label>
              <Select
                value={type}
                onValueChange={(v) => v && setType(v as "ASSET" | "LIABILITY")}
              >
                <SelectTrigger>
                  <SelectValue>
                    {type === "ASSET" ? t("accountForm.optionAsset") : t("accountForm.optionLiability")}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="ASSET">{t("accountForm.optionAsset")}</SelectItem>
                  <SelectItem value="LIABILITY">{t("accountForm.optionLiability")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-2">
              <Label>{t("accountForm.labelCategory")}</Label>
              <Select value={category} onValueChange={(v) => v && setCategory(v)}>
                <SelectTrigger>
                  <SelectValue>{t(`categories.${category}`)}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CATEGORY_KEYS.map((key) => (
                    <SelectItem key={key} value={key}>
                      {t(`categories.${key}`)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          {category === "BROKERAGE" || category === "CRYPTO_WALLET" ? (
            <div className="space-y-2">
              <Label>{t("accountForm.labelCurrency")}</Label>
              <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                <SelectTrigger>
                  <SelectValue>
                    {(() => { const c = CURRENCIES.find((c) => c.code === currency); return c ? `${c.code} (${c.symbol})` : currency; })()}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {CURRENCIES.map((c) => (
                    <SelectItem key={c.code} value={c.code}>
                      {c.code} ({c.symbol})
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-2">
                <Label>{t("accountForm.labelCurrency")}</Label>
                <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {CURRENCIES.map((c) => (
                      <SelectItem key={c.code} value={c.code}>
                        {c.code} ({c.symbol})
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div className="space-y-2">
                <Label>{t("accountForm.labelCashBalance")}</Label>
                <Input
                  type="number"
                  step="0.01"
                  value={cashBalance}
                  onChange={(e) => setCashBalance(e.target.value)}
                />
              </div>
            </div>
          )}

          <div className="flex justify-end gap-2 pt-2">
            <Button type="button" variant="outline" onClick={onClose}>
              {t("accountForm.cancel")}
            </Button>
            <Button type="submit" disabled={loading}>
              {loading ? t("accountForm.creating") : t("accountForm.create")}
            </Button>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  );
}
