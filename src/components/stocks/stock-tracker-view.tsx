"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { Reorder, useDragControls } from "framer-motion";
import {
  ArrowRight,
  ArrowUpDown,
  ChartCandlestick,
  GripVertical,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Save,
  Trash2,
  TrendingDown,
  TrendingUp,
  X,
} from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { FreshnessBadge } from "@/components/ui/freshness-badge";
import { HoldingSearch, type SearchResult } from "@/components/accounts/holding-search";
import { DiscardConfirmDialog } from "@/components/discard-confirm-dialog";
import { useDiscardGuard } from "@/hooks/use-discard-guard";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { StocksOnboarding } from "./stocks-onboarding";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { hapticTick } from "@/lib/haptics";
import { CLIENT_REFRESH_COOLDOWN_MS } from "@/lib/refresh-policy";
import { cn, daysBetweenDates, localToday } from "@/lib/utils";
import type { SerializedTrackedStock } from "@/lib/services/stock-watch-service";

type QuoteResponse = {
  symbol: string;
  name: string;
  exchange: string;
  currency: string;
  price: number;
  updatedAt: string;
};

const HIDDEN = "***";

function parseMoney(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumberInput(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}

function useFormatters() {
  const locale = useLocale();
  const { privacyMode } = usePrivacyMode();

  return useMemo(
    () => ({
      date(value: string) {
        return new Intl.DateTimeFormat(locale, { dateStyle: "medium" }).format(
          new Date(`${value}T00:00:00`),
        );
      },
      money(value: number | null, currency: string) {
        if (privacyMode) return HIDDEN;
        if (value === null) return null;
        return new Intl.NumberFormat(locale, {
          style: "currency",
          currency,
          maximumFractionDigits: Math.abs(value) >= 100 ? 2 : 4,
        }).format(value);
      },
      percent(value: number | null) {
        if (privacyMode) return HIDDEN;
        if (value === null) return null;
        return new Intl.NumberFormat(locale, {
          style: "percent",
          minimumFractionDigits: 2,
          maximumFractionDigits: 2,
        }).format(value / 100);
      },
    }),
    [locale, privacyMode],
  );
}

function StockForm({
  open,
  stock,
  onClose,
}: {
  open: boolean;
  stock: SerializedTrackedStock | null;
  onClose: () => void;
}) {
  const t = useTranslations("stocks");
  const common = useTranslations("common");
  const router = useRouter();
  const isMobile = useIsMobile();
  const editing = !!stock;
  const [loading, setLoading] = useState(false);
  const [quoteLoading, setQuoteLoading] = useState(false);
  const [selected, setSelected] = useState<SearchResult | null>(
    stock
      ? {
          symbol: stock.symbol,
          name: stock.name,
          exchange: stock.exchange,
          type: "STOCK",
          currency: stock.currency,
        }
      : null,
  );
  const [recordPrice, setRecordPrice] = useState(stock ? formatNumberInput(stock.recordPrice) : "");
  const [recordDate, setRecordDate] = useState(stock?.recordDate ?? localToday());
  const [note, setNote] = useState(stock?.note ?? "");
  const [priceError, setPriceError] = useState("");

  const isDirty = editing
    ? recordPrice !== formatNumberInput(stock.recordPrice) ||
      recordDate !== stock.recordDate ||
      note !== (stock.note ?? "")
    : !!selected || !!recordPrice || recordDate !== localToday() || note.trim().length > 0;
  const { confirmOpen, setConfirmOpen, requestClose, confirmDiscard } = useDiscardGuard(
    isDirty,
    onClose,
  );

  async function selectStock(result: SearchResult) {
    if (result.type !== "STOCK") {
      toast.error(t("stockOnly"));
      return;
    }

    setSelected(result);
    setQuoteLoading(true);
    try {
      const res = await fetch(`/api/stocks/quote?symbol=${encodeURIComponent(result.symbol)}`);
      if (!res.ok) throw new Error("quote failed");
      const { data }: { data: QuoteResponse } = await res.json();
      setSelected({
        symbol: data.symbol,
        name: data.name,
        exchange: data.exchange,
        type: "STOCK",
        currency: data.currency,
      });
      setRecordPrice(formatNumberInput(data.price));
      setPriceError("");
    } catch {
      toast.error(t("prefillFailed"));
    } finally {
      setQuoteLoading(false);
    }
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    const parsedPrice = parseMoney(recordPrice);
    if (!parsedPrice) {
      setPriceError(t("recordPriceInvalid"));
      return;
    }
    if (!selected) {
      toast.error(t("selectStockFirst"));
      return;
    }

    setLoading(true);
    try {
      const res = await fetch(editing ? `/api/stocks/${stock.id}` : "/api/stocks", {
        method: editing ? "PATCH" : "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol: selected.symbol,
          name: selected.name,
          exchange: selected.exchange,
          currency: selected.currency,
          recordPrice: parsedPrice,
          recordDate,
          note,
        }),
      });

      if (!res.ok) {
        if (res.status === 409) throw new Error(t("alreadyTracked"));
        if (res.status === 400) throw new Error(t("stockOnly"));
        throw new Error(editing ? t("updateFailed") : t("addFailed"));
      }

      toast.success(
        editing
          ? t("updateSuccess", { symbol: selected.symbol })
          : t("addSuccess", { symbol: selected.symbol }),
      );
      onClose();
      startTransition(() => router.refresh());
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : editing ? t("updateFailed") : t("addFailed"),
      );
    } finally {
      setLoading(false);
    }
  }

  const form = (
    <form onSubmit={handleSubmit} className="min-w-0 space-y-4">
      {editing && selected ? (
        <div className="rounded-lg border bg-muted/40 p-3">
          <div className="flex items-center gap-2">
            <span className="font-mono text-sm font-semibold">{selected.symbol}</span>
            <Badge variant="secondary" className="text-[10px]">
              {selected.currency}
            </Badge>
          </div>
          <p className="mt-1 truncate text-sm text-muted-foreground">{selected.name}</p>
        </div>
      ) : selected ? (
        <div className="flex items-center justify-between gap-3 rounded-lg border bg-muted/40 p-3">
          <div className="min-w-0">
            <Label className="text-xs text-muted-foreground">{t("selectedStock")}</Label>
            <div className="mt-1 flex items-center gap-2">
              <span className="font-mono text-sm font-semibold">{selected.symbol}</span>
              <Badge variant="secondary" className="text-[10px]">
                {selected.currency}
              </Badge>
            </div>
            <p className="mt-1 truncate text-sm text-muted-foreground">{selected.name}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="shrink-0 whitespace-nowrap"
            onClick={() => setSelected(null)}
          >
            {t("changeStock")}
          </Button>
        </div>
      ) : (
        <HoldingSearch
          onSelect={selectStock}
          label={t("searchLabel")}
          placeholder={t("searchPlaceholder")}
          autoFocus={!isMobile}
          allowedTypes={["STOCK"]}
        />
      )}

      <div className="grid gap-4 sm:grid-cols-2">
        <div className="space-y-2">
          <Label htmlFor="stock-record-price">{t("recordPrice")}</Label>
          <div className="relative">
            <Input
              id="stock-record-price"
              type="text"
              inputMode="decimal"
              value={recordPrice}
              onChange={(event) => {
                setPriceError("");
                setRecordPrice(event.target.value);
              }}
              placeholder="0.00"
              required
              aria-invalid={!!priceError}
            />
            {quoteLoading && (
              <RefreshCw className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
            )}
          </div>
          {priceError && <p className="text-xs text-destructive">{priceError}</p>}
        </div>
        <div className="space-y-2">
          <Label htmlFor="stock-record-date">{t("recordDate")}</Label>
          <Input
            id="stock-record-date"
            type="date"
            value={recordDate}
            onChange={(event) => setRecordDate(event.target.value)}
            required
          />
        </div>
      </div>

      <div className="space-y-2">
        <Label htmlFor="stock-note">{t("note")}</Label>
        <Textarea
          id="stock-note"
          value={note}
          onChange={(event) => setNote(event.target.value)}
          placeholder={t("notePlaceholder")}
          rows={4}
          maxLength={2000}
        />
      </div>

      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={requestClose}>
          {common("cancel")}
        </Button>
        <Button type="submit" disabled={loading || quoteLoading || !selected}>
          {loading ? t("saving") : t("saveStock")}
        </Button>
      </div>
    </form>
  );

  const title = editing ? t("editStock") : t("addStock");

  return (
    <>
      {isMobile ? (
        <Drawer open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
          <DrawerContent showCloseButton={false}>
            <DrawerHeader>
              <DrawerTitle>{title}</DrawerTitle>
            </DrawerHeader>
            <div className="px-4 pb-4">{form}</div>
          </DrawerContent>
        </Drawer>
      ) : (
        <Dialog open={open} onOpenChange={(nextOpen) => !nextOpen && requestClose()}>
          <DialogContent className="sm:max-w-md">
            <DialogHeader>
              <DialogTitle>{title}</DialogTitle>
            </DialogHeader>
            {form}
          </DialogContent>
        </Dialog>
      )}
      <DiscardConfirmDialog
        open={confirmOpen}
        onOpenChange={setConfirmOpen}
        onDiscard={confirmDiscard}
      />
    </>
  );
}

function StockRow({
  stock,
  onEdit,
  onDelete,
}: {
  stock: SerializedTrackedStock;
  onEdit: (stock: SerializedTrackedStock) => void;
  onDelete: (stock: SerializedTrackedStock) => void;
}) {
  const t = useTranslations("stocks");
  const common = useTranslations("common");
  const format = useFormatters();
  const currency = stock.latestPriceCurrency ?? stock.currency;
  const isGain = (stock.change ?? 0) >= 0;
  const hasDirection = stock.changePercent !== null;
  const DirectionIcon = isGain ? TrendingUp : TrendingDown;
  // Deepened schema hue for the secondary directional cues (connector arrow,
  // absolute change). Null when there's no quote, so those stay neutral gray.
  const directionInk = hasDirection
    ? isGain
      ? "text-[var(--gain-ink)]"
      : "text-[var(--loss-ink)]"
    : null;
  const latestPrice = format.money(stock.latestPrice, currency);
  const recordPrice = format.money(stock.recordPrice, stock.currency);
  const change = format.money(stock.change, currency);
  const percent = format.percent(stock.changePercent);
  const [today, setToday] = useState<string | null>(null);
  const noteText = stock.note?.trim() ?? "";

  useEffect(() => {
    const timer = window.setTimeout(() => setToday(localToday()), 0);
    return () => window.clearTimeout(timer);
  }, []);

  const recordPeriodDays = today ? daysBetweenDates(stock.recordDate, today) : null;
  const recordPeriodLabel =
    recordPeriodDays !== null ? t("recordPeriod", { days: recordPeriodDays }) : null;

  function renderIdentity(compact = false) {
    return (
      <div className="min-w-0">
        <div className="flex flex-wrap items-center gap-2">
          <span
            className={cn(
              "font-mono font-semibold tracking-normal",
              compact ? "text-sm" : "text-base",
            )}
          >
            {stock.symbol}
          </span>
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/5 text-[10px] font-medium text-primary/90"
          >
            {stock.currency}
          </Badge>
          {stock.exchange && (
            <Badge
              variant="secondary"
              className="max-w-40 truncate bg-muted/40 text-[10px] font-medium text-muted-foreground"
            >
              {stock.exchange}
            </Badge>
          )}
        </div>
        <p
          className={cn(
            "mt-1 truncate text-muted-foreground",
            compact ? "text-xs leading-4" : "text-sm",
          )}
        >
          {stock.name}
        </p>
      </div>
    );
  }

  function renderActions() {
    return (
      <DropdownMenu>
        <DropdownMenuTrigger
          aria-label={common("actionsFor", { name: stock.symbol })}
          className="inline-flex h-7 w-7 items-center justify-center rounded-md text-muted-foreground outline-none transition-colors hover:bg-muted hover:text-foreground focus-visible:ring-2 focus-visible:ring-primary"
        >
          <MoreHorizontal className="h-4 w-4" />
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end">
          <DropdownMenuItem onClick={() => onEdit(stock)}>
            <Pencil className="mr-2 h-4 w-4" />
            {common("edit")}
          </DropdownMenuItem>
          <DropdownMenuItem
            onClick={() => onDelete(stock)}
            className="text-destructive focus:text-destructive"
          >
            <Trash2 className="mr-2 h-4 w-4" />
            {common("delete")}
          </DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }

  return (
    <Card
      size="sm"
      className={cn(
        "overflow-visible transition-colors md:py-2",
        hasDirection
          ? isGain
            ? "border-[var(--gain)]/35 bg-[var(--gain)]/5 hover:border-[var(--gain)]/60 hover:bg-[var(--gain)]/8"
            : "border-[var(--loss)]/35 bg-[var(--loss)]/5 hover:border-[var(--loss)]/60 hover:bg-[var(--loss)]/8"
          : "hover:border-primary/20 hover:bg-primary/[0.02]",
      )}
    >
      <CardContent className="space-y-3 md:px-3">
        <div className="hidden items-center gap-5 md:grid md:grid-cols-[minmax(180px,1.5fr)_minmax(280px,1.3fr)_minmax(116px,auto)_1.75rem]">
          {renderIdentity(true)}

          {/* Price journey: the recorded reference price, then the live quote it's measured against. */}
          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">
              {t("recorded")}
              <ArrowRight className="mx-1.5 inline h-3 w-3 -translate-y-px text-muted-foreground/40" />
              {t("latestPrice")}
            </p>
            {/* flex-wrap (not truncate): a long price must never be clipped mid-number. */}
            <p className="mt-1 flex flex-wrap items-baseline gap-x-2 gap-y-0.5 font-mono tabular-nums">
              <span className="text-sm font-medium text-muted-foreground">{recordPrice}</span>
              <ArrowRight
                className={cn(
                  "h-3.5 w-3.5 shrink-0 translate-y-0.5",
                  directionInk ?? "text-muted-foreground/40",
                )}
              />
              <span className="text-base font-semibold text-foreground">
                {latestPrice ?? t("unavailable")}
              </span>
            </p>
            <p className="mt-1 truncate text-[11px] leading-4 text-muted-foreground/80">
              {format.date(stock.recordDate)}
              {recordPeriodLabel && ` · ${recordPeriodLabel}`}
            </p>
            {!stock.latestPriceUpdatedAt && (
              <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                {t("noLatestPrice")}
              </p>
            )}
          </div>

          {/* Change: the payoff, anchored to the row's right edge so pills line up down the list. */}
          <div className="flex flex-col items-end gap-1 justify-self-end">
            {stock.changePercent !== null ? (
              <span
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2.5 py-1 font-mono text-sm font-semibold tabular-nums leading-none ring-1 ring-inset",
                  isGain
                    ? "bg-[var(--gain)]/15 text-[var(--gain)] ring-[var(--gain)]/25"
                    : "bg-[var(--loss)]/15 text-[var(--loss)] ring-[var(--loss)]/25",
                )}
              >
                <DirectionIcon className="h-3.5 w-3.5 shrink-0" />
                {percent}
              </span>
            ) : (
              <p className="font-mono text-sm font-semibold tabular-nums text-muted-foreground">
                {t("unavailable")}
              </p>
            )}
            {stock.change !== null && (
              <p
                className={cn(
                  "font-mono text-[11px] font-medium tabular-nums",
                  directionInk ?? "text-muted-foreground",
                )}
              >
                {change}
              </p>
            )}
          </div>

          <div className="justify-self-end">{renderActions()}</div>
        </div>

        <div className="flex flex-col gap-3.5 md:hidden">
          <div className="flex items-start justify-between gap-4">
            {renderIdentity()}

            <div className="flex min-w-0 shrink-0 flex-col items-end">
              {stock.changePercent !== null ? (
                <span
                  className={cn(
                    "inline-flex items-center gap-1 rounded-full px-3 py-1.5 font-mono text-base font-bold tabular-nums leading-none ring-1 ring-inset",
                    isGain
                      ? "bg-[var(--gain)]/15 text-[var(--gain)] ring-[var(--gain)]/25"
                      : "bg-[var(--loss)]/15 text-[var(--loss)] ring-[var(--loss)]/25",
                  )}
                >
                  <DirectionIcon className="h-4 w-4 shrink-0" />
                  {percent}
                </span>
              ) : (
                <p className="font-mono text-base font-bold tabular-nums text-muted-foreground">
                  {t("unavailable")}
                </p>
              )}
              <p className="mt-2 font-mono text-base font-semibold tabular-nums text-foreground">
                {latestPrice ?? t("unavailable")}
              </p>
              {change && (
                <p
                  className={cn(
                    "mt-0.5 font-mono text-[11px] font-medium tabular-nums",
                    directionInk ?? "text-muted-foreground",
                  )}
                >
                  {change}
                </p>
              )}
            </div>
          </div>

          <div className="flex items-center justify-between gap-3 rounded-lg bg-muted/30 px-3 py-2.5">
            <div className="min-w-0">
              <p className="text-xs text-muted-foreground">
                <span className="font-medium text-foreground/80">{t("recorded")}:</span>{" "}
                <span className="font-mono font-medium text-foreground/90">{recordPrice}</span>
              </p>
              <p className="mt-0.5 truncate text-[11px] text-muted-foreground/70">
                {format.date(stock.recordDate)}
                {recordPeriodLabel && ` • ${recordPeriodLabel}`}
              </p>
            </div>
            <div className="shrink-0">{renderActions()}</div>
          </div>

          {!stock.latestPriceUpdatedAt && (
            <p className="text-[11px] text-muted-foreground">{t("noLatestPrice")}</p>
          )}
        </div>

        {noteText && (
          <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2.5">
            <p className="whitespace-pre-wrap break-words text-sm leading-relaxed text-foreground">
              <span className="mr-2 text-xs font-medium text-muted-foreground">{t("note")}:</span>
              {noteText}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

function ReorderStockItem({ stock }: { stock: SerializedTrackedStock }) {
  const t = useTranslations("stocks");
  const format = useFormatters();
  const dragControls = useDragControls();
  const isGain = (stock.change ?? 0) >= 0;
  const hasDirection = stock.changePercent !== null;
  const DirectionIcon = isGain ? TrendingUp : TrendingDown;
  const percent = format.percent(stock.changePercent);

  return (
    <Reorder.Item
      value={stock}
      dragListener={false}
      dragControls={dragControls}
      dragMomentum={false}
      layout="position"
      whileDrag={{ scale: 1.01 }}
      transition={{ type: "spring", stiffness: 520, damping: 38, mass: 0.85 }}
      style={{ willChange: "transform" }}
      className="flex items-center gap-3 rounded-lg border bg-card px-3 py-2.5"
    >
      <button
        type="button"
        aria-label={t("dragHandleLabel")}
        className="inline-flex shrink-0 cursor-grab touch-none items-center justify-center rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted/60 hover:text-foreground active:cursor-grabbing focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
        onPointerDown={(event) => dragControls.start(event)}
      >
        <GripVertical className="h-4 w-4" aria-hidden />
      </button>
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-2">
          <span className="truncate font-mono text-sm font-semibold tracking-normal">
            {stock.symbol}
          </span>
          <Badge
            variant="outline"
            className="border-primary/20 bg-primary/5 text-[10px] font-medium text-primary/90"
          >
            {stock.currency}
          </Badge>
        </div>
        <p className="mt-0.5 truncate text-xs leading-4 text-muted-foreground">{stock.name}</p>
      </div>
      {hasDirection ? (
        <span
          className={cn(
            "inline-flex shrink-0 items-center gap-1 rounded-full px-2 py-0.5 font-mono text-xs font-semibold tabular-nums leading-none",
            isGain
              ? "bg-[var(--gain)]/15 text-[var(--gain)]"
              : "bg-[var(--loss)]/15 text-[var(--loss)]",
          )}
        >
          <DirectionIcon className="h-3 w-3 shrink-0" aria-hidden />
          {percent}
        </span>
      ) : (
        <span className="shrink-0 font-mono text-xs font-medium tabular-nums text-muted-foreground">
          {t("unavailable")}
        </span>
      )}
    </Reorder.Item>
  );
}

function ManageOrderList({
  draft,
  onReorder,
}: {
  draft: SerializedTrackedStock[];
  onReorder: (next: SerializedTrackedStock[]) => void;
}) {
  const t = useTranslations("stocks");

  return (
    <div className="space-y-3">
      <p className="text-xs leading-tight text-muted-foreground">{t("manageOrderHint")}</p>
      <Reorder.Group
        axis="y"
        values={draft}
        onReorder={onReorder}
        layoutScroll
        className="space-y-2"
      >
        {draft.map((stock) => (
          <ReorderStockItem key={stock.id} stock={stock} />
        ))}
      </Reorder.Group>
    </div>
  );
}

export function StockTrackerView({ stocks }: { stocks: SerializedTrackedStock[] }) {
  const t = useTranslations("stocks");
  const common = useTranslations("common");
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<SerializedTrackedStock | null>(null);
  const [deletingStock, setDeletingStock] = useState<SerializedTrackedStock | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [now, setNow] = useState(() => Date.now());
  const [manageMode, setManageMode] = useState(false);
  const [savingOrder, setSavingOrder] = useState(false);
  const [draft, setDraft] = useState<SerializedTrackedStock[]>([]);

  // 1s tick while a cooldown is active so the button re-enables on time.
  useEffect(() => {
    if (cooldownUntil <= now) return;
    const interval = window.setInterval(() => setNow(Date.now()), 1000);
    return () => window.clearInterval(interval);
  }, [cooldownUntil, now]);

  const coolingDown = cooldownUntil > now;

  function startCooldown(seconds: number) {
    setCooldownUntil(Date.now() + seconds * 1000);
    setNow(Date.now());
  }

  // Derive the most recent price update timestamp across all stocks.
  // Since all prices are refreshed in the same batch, they share one timestamp.
  const latestPriceTimestamp = useMemo(() => {
    let newest: string | null = null;
    for (const stock of stocks) {
      if (stock.latestPriceUpdatedAt && (!newest || stock.latestPriceUpdatedAt > newest)) {
        newest = stock.latestPriceUpdatedAt;
      }
    }
    return newest;
  }, [stocks]);

  async function refreshPrices() {
    hapticTick();
    setRefreshing(true);
    try {
      const res = await fetch("/api/stocks/refresh", { method: "POST" });
      if (res.status === 429) {
        const retryAfter = Number(res.headers.get("Retry-After"));
        const seconds =
          Number.isFinite(retryAfter) && retryAfter > 0
            ? Math.ceil(retryAfter)
            : Math.ceil(CLIENT_REFRESH_COOLDOWN_MS / 1000);
        startCooldown(seconds);
        toast.info(t("refreshCooldown", { seconds }));
        return;
      }
      if (!res.ok) throw new Error("refresh failed");
      const { data }: { data: { updated: number; skippedFresh?: number } } = await res.json();
      startCooldown(Math.ceil(CLIENT_REFRESH_COOLDOWN_MS / 1000));
      if (data.updated === 0 && (data.skippedFresh ?? 0) > 0) {
        toast.info(t("alreadyFresh"));
        return;
      }
      toast.success(t("refreshSuccess", { count: data.updated }));
      window.dispatchEvent(new CustomEvent("prices:refreshed"));
      startTransition(() => router.refresh());
    } catch {
      toast.error(t("refreshFailed"));
    } finally {
      setRefreshing(false);
    }
  }

  async function deleteStock() {
    if (!deletingStock || isDeleting) return;
    const stock = deletingStock;
    setIsDeleting(true);
    try {
      const res = await fetch(`/api/stocks/${stock.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success(t("deleteSuccess", { symbol: stock.symbol }));
      setDeletingStock(null);
      startTransition(() => router.refresh());
    } catch {
      // Keep the dialog open so the user can retry; only success dismisses it.
      toast.error(t("deleteFailed"));
    } finally {
      setIsDeleting(false);
    }
  }

  function enterManageMode() {
    setDraft([...stocks]);
    setManageMode(true);
  }

  function cancelManageMode() {
    setManageMode(false);
    setDraft([]);
  }

  async function saveOrder() {
    setSavingOrder(true);
    try {
      const res = await fetch("/api/stocks/reorder", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ orderedIds: draft.map((stock) => stock.id) }),
      });
      if (!res.ok) throw new Error("reorder failed");
      toast.success(t("reorderSaved"));
      setManageMode(false);
      setDraft([]);
      startTransition(() => router.refresh());
    } catch {
      // Stay in manage mode so the user can retry without losing the arrangement.
      toast.error(t("reorderSaveFailed"));
    } finally {
      setSavingOrder(false);
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/10 text-primary">
              <ChartCandlestick className="h-4 w-4" />
            </div>
            <span className="text-sm font-medium text-foreground">
              {t("trackedCount", { count: stocks.length })}
            </span>
          </div>
          {latestPriceTimestamp && (
            <FreshnessBadge kind="price" timestamp={latestPriceTimestamp} mobileShort />
          )}
        </div>
        {manageMode ? (
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Button
              variant="outline"
              onClick={cancelManageMode}
              disabled={savingOrder}
              className="w-full sm:w-auto"
            >
              <X className="h-4 w-4" />
              {common("cancel")}
            </Button>
            <Button onClick={saveOrder} disabled={savingOrder} className="w-full sm:w-auto">
              <Save className="h-4 w-4" />
              {savingOrder ? common("saving") : common("save")}
            </Button>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2 sm:flex-nowrap">
            <Button
              variant="outline"
              onClick={refreshPrices}
              disabled={refreshing || coolingDown || stocks.length === 0}
              className="flex-1 sm:flex-none"
            >
              <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
              {refreshing ? t("refreshing") : t("refreshPrices")}
            </Button>
            {stocks.length > 1 && (
              <Button variant="outline" onClick={enterManageMode} className="flex-1 sm:flex-none">
                <ArrowUpDown className="h-4 w-4" />
                {t("manageOrder")}
              </Button>
            )}
            <Button
              onClick={() => {
                setEditingStock(null);
                setFormOpen(true);
              }}
              className="order-last w-full sm:order-none sm:w-auto sm:flex-none"
            >
              <Plus className="h-4 w-4" />
              {t("addStock")}
            </Button>
          </div>
        )}
      </div>

      {stocks.length === 0 ? (
        <StocksOnboarding
          onAdd={() => {
            setEditingStock(null);
            setFormOpen(true);
          }}
        />
      ) : manageMode ? (
        <ManageOrderList draft={draft} onReorder={setDraft} />
      ) : (
        <div className="space-y-3 md:space-y-2">
          {stocks.map((stock) => (
            <StockRow
              key={stock.id}
              stock={stock}
              onEdit={(nextStock) => {
                setEditingStock(nextStock);
                setFormOpen(true);
              }}
              onDelete={setDeletingStock}
            />
          ))}
        </div>
      )}

      {formOpen && (
        <StockForm
          key={editingStock?.id ?? "new"}
          open={formOpen}
          stock={editingStock}
          onClose={() => setFormOpen(false)}
        />
      )}

      <AlertDialog
        open={!!deletingStock}
        onOpenChange={(open) => !open && !isDeleting && setDeletingStock(null)}
      >
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {deletingStock
                ? t("deleteTitle", { symbol: deletingStock.symbol })
                : t("deleteStock")}
            </AlertDialogTitle>
            <AlertDialogDescription>{t("deleteBody")}</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isDeleting}>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction
              disabled={isDeleting}
              onClick={(event) => {
                event.preventDefault();
                deleteStock();
              }}
            >
              {isDeleting ? t("deleting") : t("deleteStock")}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
