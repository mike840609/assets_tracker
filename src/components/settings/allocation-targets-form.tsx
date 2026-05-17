"use client";

import { useState, useTransition } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { PlusIcon, Trash2Icon, Loader2Icon } from "lucide-react";
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
import { HOLDING_ASSET_TYPES, ACCOUNT_CATEGORIES } from "@/lib/enums";
import type { SerializedAllocationTarget } from "@/lib/types";

interface Props {
  initialTargets: SerializedAllocationTarget[];
}

type Scope = "ASSET_TYPE" | "ACCOUNT_CATEGORY";

const SCOPE_KEYS: Record<Scope, readonly string[]> = {
  ASSET_TYPE: HOLDING_ASSET_TYPES.filter((t) => t !== "OPTION"),
  ACCOUNT_CATEGORY: ACCOUNT_CATEGORIES.filter(
    (c) => !["CREDIT_CARD", "LOAN", "MORTGAGE"].includes(c),
  ),
};

const ASSET_TYPE_LABELS: Record<string, string> = {
  STOCK: "Stock",
  ETF: "ETF",
  CRYPTO: "Crypto",
  MUTUAL_FUND: "Mutual Fund",
  BOND: "Bond",
  OTHER: "Other",
};

export function AllocationTargetsForm({ initialTargets }: Props) {
  const t = useTranslations("allocation");
  const tCat = useTranslations("categories");
  const [targets, setTargets] = useState<SerializedAllocationTarget[]>(initialTargets);
  const [scope, setScope] = useState<Scope>("ASSET_TYPE");
  const [key, setKey] = useState("");
  const [targetPercent, setTargetPercent] = useState("");
  const [driftThreshold, setDriftThreshold] = useState("5");
  const [isPending, startTransition] = useTransition();
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const availableKeys = SCOPE_KEYS[scope].filter(
    (k) => !targets.some((tgt) => tgt.scope === scope && tgt.key === k),
  );

  const getKeyLabel = (s: Scope, k: string) => {
    if (s === "ASSET_TYPE") return ASSET_TYPE_LABELS[k] ?? k;
    return tCat(k as Parameters<typeof tCat>[0], { defaultValue: k });
  };

  const handleAdd = () => {
    if (!key || !targetPercent) return;
    const pct = parseFloat(targetPercent);
    const threshold = parseFloat(driftThreshold) || 5;
    if (isNaN(pct) || pct < 0 || pct > 100) {
      toast.error(t("invalidPercent"));
      return;
    }

    startTransition(async () => {
      try {
        const res = await fetch("/api/allocation-targets", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ scope, key, targetPercent: pct, driftThreshold: threshold }),
        });
        if (!res.ok) {
          const err = await res.json().catch(() => ({}));
          toast.error(err.error ?? t("toast.failed"));
          return;
        }
        const { data: created } = (await res.json()) as { data: SerializedAllocationTarget };
        setTargets((prev) => [...prev, created]);
        setKey("");
        setTargetPercent("");
        setDriftThreshold("5");
        toast.success(t("toast.created"));
      } catch {
        toast.error(t("toast.failed"));
      }
    });
  };

  const handleDelete = (id: string) => {
    setDeletingId(id);
    startTransition(async () => {
      try {
        const res = await fetch(`/api/allocation-targets/${id}`, { method: "DELETE" });
        if (!res.ok) {
          toast.error(t("toast.failed"));
          return;
        }
        setTargets((prev) => prev.filter((tgt) => tgt.id !== id));
        toast.success(t("toast.deleted"));
      } catch {
        toast.error(t("toast.failed"));
      } finally {
        setDeletingId(null);
      }
    });
  };

  const totalPctByScope = (s: Scope) =>
    targets.filter((tgt) => tgt.scope === s).reduce((sum, tgt) => sum + tgt.targetPercent, 0);

  return (
    <section className="space-y-4">
      <div className="flex flex-col gap-1">
        <h3 className="text-lg font-semibold">{t("title")}</h3>
        <p className="text-sm text-muted-foreground">{t("description")}</p>
      </div>

      {/* Existing targets */}
      {targets.length > 0 && (
        <div className="rounded-lg border divide-y text-sm">
          {targets.map((tgt) => (
            <div key={tgt.id} className="flex items-center justify-between px-4 py-3 gap-3">
              <div className="flex items-center gap-3 min-w-0">
                <span className="shrink-0 rounded px-1.5 py-0.5 text-[11px] bg-muted text-muted-foreground font-medium">
                  {tgt.scope === "ASSET_TYPE"
                    ? t("scope.ASSET_TYPE")
                    : tgt.scope === "ACCOUNT_CATEGORY"
                      ? t("scope.ACCOUNT_CATEGORY")
                      : tgt.scope}
                </span>
                <span className="font-medium truncate">{getKeyLabel(tgt.scope, tgt.key)}</span>
              </div>
              <div className="flex items-center gap-3 shrink-0">
                <span className="tabular-nums text-muted-foreground text-xs">
                  {t("threshold", { n: tgt.driftThreshold })}
                </span>
                <span className="tabular-nums font-semibold">{tgt.targetPercent.toFixed(1)}%</span>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 text-muted-foreground hover:text-destructive"
                  onClick={() => handleDelete(tgt.id)}
                  disabled={deletingId === tgt.id}
                  aria-label={t("deleteTarget")}
                >
                  {deletingId === tgt.id ? (
                    <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Trash2Icon className="h-3.5 w-3.5" />
                  )}
                </Button>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Total check */}
      {(["ASSET_TYPE", "ACCOUNT_CATEGORY"] as Scope[]).map((s) => {
        const total = totalPctByScope(s);
        if (total === 0) return null;
        const isOver = total > 100;
        return (
          <p key={s} className={`text-xs ${isOver ? "text-destructive" : "text-muted-foreground"}`}>
            {t("totalHint", {
              scope: s === "ASSET_TYPE" ? t("scope.ASSET_TYPE") : t("scope.ACCOUNT_CATEGORY"),
              total: total.toFixed(1),
            })}
            {isOver && ` — ${t("totalOverHint")}`}
          </p>
        );
      })}

      {/* Add form */}
      {targets.length < 20 && (
        <div className="rounded-lg border p-4 space-y-3 bg-muted/30">
          <p className="text-sm font-medium">{t("addTarget")}</p>
          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label className="text-xs">{t("scopeLabel")}</Label>
              <Select
                value={scope}
                onValueChange={(v) => {
                  setScope(v as Scope);
                  setKey("");
                }}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent align="start">
                  <SelectItem value="ASSET_TYPE">{t("scope.ASSET_TYPE")}</SelectItem>
                  <SelectItem value="ACCOUNT_CATEGORY">{t("scope.ACCOUNT_CATEGORY")}</SelectItem>
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("keyLabel")}</Label>
              <Select
                value={key}
                onValueChange={(v) => setKey(v ?? "")}
                disabled={availableKeys.length === 0}
              >
                <SelectTrigger className="h-8 text-xs w-full">
                  <SelectValue placeholder={t("keyPlaceholder")} />
                </SelectTrigger>
                <SelectContent align="start">
                  {availableKeys.map((k) => (
                    <SelectItem key={k} value={k}>
                      {getKeyLabel(scope, k)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("targetPercentLabel")}</Label>
              <div className="relative">
                <Input
                  className="h-8 text-xs pr-6"
                  type="number"
                  min={0}
                  max={100}
                  step={0.5}
                  value={targetPercent}
                  onChange={(e) => setTargetPercent(e.target.value)}
                  placeholder="30"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  %
                </span>
              </div>
            </div>

            <div className="space-y-1">
              <Label className="text-xs">{t("thresholdLabel")}</Label>
              <div className="relative">
                <Input
                  className="h-8 text-xs pr-6"
                  type="number"
                  min={0}
                  max={50}
                  step={0.5}
                  value={driftThreshold}
                  onChange={(e) => setDriftThreshold(e.target.value)}
                  placeholder="5"
                />
                <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs text-muted-foreground pointer-events-none">
                  pp
                </span>
              </div>
            </div>
          </div>

          <Button
            size="sm"
            className="gap-1.5"
            onClick={handleAdd}
            disabled={!key || !targetPercent || isPending}
          >
            {isPending ? (
              <Loader2Icon className="h-3.5 w-3.5 animate-spin" />
            ) : (
              <PlusIcon className="h-3.5 w-3.5" />
            )}
            {t("addBtn")}
          </Button>
        </div>
      )}
    </section>
  );
}
