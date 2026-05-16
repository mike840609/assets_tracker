"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { formatCurrency } from "@/lib/currencies";
import { Pencil, Trash2, Target, CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import type { GoalWithProgress, SerializedAccount, SerializedGoal } from "@/lib/types";
import { GoalFormDialog } from "./goal-form-dialog";

interface GoalCardProps {
  data: GoalWithProgress;
  baseCurrency: string;
  accounts: SerializedAccount[];
  defaultCurrency: string;
}

function formatProjectedDate(iso: string | null, locale: string): string | null {
  if (!iso) return null;
  return new Intl.DateTimeFormat(locale, { year: "numeric", month: "short" }).format(new Date(iso));
}

function daysFromNow(iso: string): number {
  const target = new Date(iso);
  const now = new Date();
  return Math.round((target.getTime() - now.getTime()) / (1000 * 60 * 60 * 24));
}

export function GoalCard({ data, baseCurrency, accounts, defaultCurrency }: GoalCardProps) {
  const {
    goal,
    currentAmount,
    targetAmountInBase,
    progressPercent,
    projectedDateLinear,
    projectedDateCAGR,
    isCompleted,
  } = data;
  const t = useTranslations("goals");
  const router = useRouter();
  const [editOpen, setEditOpen] = useState(false);
  const [deleting, setDeleting] = useState(false);

  const locale = typeof navigator !== "undefined" ? navigator.language : "en-US";
  const progressClamped = Math.max(0, Math.min(100, progressPercent));

  const scopeLabel = t(`scope.${goal.scope}`);
  const scopeDetail =
    goal.scope === "CATEGORY"
      ? (goal.scopeRefId
          ?.replace(/_/g, " ")
          .toLowerCase()
          .replace(/^\w/, (c) => c.toUpperCase()) ?? "")
      : goal.scope === "ACCOUNT"
        ? (accounts.find((a) => a.id === goal.scopeRefId)?.name ?? "")
        : "";

  const targetDateDays = goal.targetDate ? daysFromNow(goal.targetDate) : null;

  async function handleDelete() {
    if (!confirm(t("confirmDelete"))) return;
    setDeleting(true);
    try {
      const res = await fetch(`/api/goals/${goal.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Failed");
      toast.success(t("toast.deleted"));
      router.refresh();
    } catch {
      toast.error(t("toast.failed"));
      setDeleting(false);
    }
  }

  const linearLabel = formatProjectedDate(projectedDateLinear, locale);
  const cagrLabel = formatProjectedDate(projectedDateCAGR, locale);

  return (
    <>
      <Card className="border border-border/50 bg-card card-gradient shadow-sm hover:shadow-lg transition-all motion-normal rounded-xl overflow-hidden">
        <CardContent className="p-5 space-y-4">
          {/* Header row */}
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-3 min-w-0">
              <div
                className={`h-9 w-9 rounded-full flex items-center justify-center shrink-0 ${isCompleted ? "bg-primary/20 text-primary" : "bg-muted text-muted-foreground"}`}
              >
                {isCompleted ? (
                  <CheckCircle2 className="h-5 w-5" />
                ) : (
                  <Target className="h-5 w-5" />
                )}
              </div>
              <div className="min-w-0">
                <p className="font-semibold text-sm leading-snug truncate">{goal.name}</p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {scopeLabel}
                  {scopeDetail && ` · ${scopeDetail}`}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-foreground"
                onClick={() => setEditOpen(true)}
              >
                <Pencil className="h-3.5 w-3.5" />
              </Button>
              <Button
                variant="ghost"
                size="sm"
                className="h-8 px-2 text-muted-foreground hover:text-destructive"
                onClick={handleDelete}
                disabled={deleting}
              >
                <Trash2 className="h-3.5 w-3.5" />
              </Button>
            </div>
          </div>

          {/* Progress bar */}
          <div className="space-y-1.5">
            <div className="flex justify-between items-baseline text-xs text-muted-foreground">
              <span>{formatCurrency(currentAmount, baseCurrency)}</span>
              <span className="font-medium text-foreground">{progressClamped.toFixed(1)}%</span>
            </div>
            <div className="h-2.5 w-full rounded-full bg-muted/60 overflow-hidden">
              <div
                className={`h-full rounded-full transition-all motion-normal ${isCompleted ? "bg-primary" : "bg-primary/80"}`}
                style={{ width: `${progressClamped}%` }}
              />
            </div>
            <div className="flex justify-between items-baseline text-xs">
              <span className="text-muted-foreground">
                {t("ofTarget", {
                  target: formatCurrency(targetAmountInBase, baseCurrency),
                })}
              </span>
              {goal.targetCurrency !== baseCurrency && (
                <span className="text-muted-foreground/70">
                  {formatCurrency(goal.targetAmount, goal.targetCurrency)}
                </span>
              )}
            </div>
          </div>

          {/* Metadata row */}
          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-xs text-muted-foreground">
            {isCompleted && (
              <Badge variant="outline" className="text-primary border-primary/30 bg-primary/5">
                {t("completed")}
              </Badge>
            )}
            {goal.targetDate && targetDateDays !== null && (
              <span>
                {targetDateDays >= 0
                  ? t("dueIn", {
                      days: targetDateDays,
                      date: new Intl.DateTimeFormat(locale, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }).format(new Date(goal.targetDate)),
                    })
                  : t("overdue", {
                      date: new Intl.DateTimeFormat(locale, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      }).format(new Date(goal.targetDate)),
                    })}
              </span>
            )}
            {!isCompleted && linearLabel && (
              <span>{t("projectedLinear", { date: linearLabel })}</span>
            )}
            {!isCompleted && cagrLabel && cagrLabel !== linearLabel && (
              <span>{t("projectedCAGR", { date: cagrLabel })}</span>
            )}
          </div>
        </CardContent>
      </Card>

      <GoalFormDialog
        open={editOpen}
        onOpenChange={setEditOpen}
        editGoal={goal as SerializedGoal}
        accounts={accounts}
        defaultCurrency={defaultCurrency}
      />
    </>
  );
}
