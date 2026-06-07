"use client";

import { startTransition, useEffect, useMemo, useState } from "react";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import {
  ChartCandlestick,
  MoreHorizontal,
  Pencil,
  Plus,
  RefreshCw,
  Trash2,
  TrendingDown,
  TrendingUp,
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
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { hapticTick } from "@/lib/haptics";
import { cn } from "@/lib/utils";
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

function localToday() {
  const now = new Date();
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

function parseMoney(value: string) {
  const normalized = value.replace(/,/g, "").trim();
  if (!normalized) return null;
  const parsed = Number(normalized);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : null;
}

function formatNumberInput(value: number) {
  return new Intl.NumberFormat("en-US", { maximumFractionDigits: 8 }).format(value);
}

function dateToLocalTime(value: string) {
  const [year, month, day] = value.split("-").map(Number);
  return new Date(year, month - 1, day).getTime();
}

function daysBetweenDates(startDate: string, endDate: string) {
  const DAY_MS = 24 * 60 * 60 * 1000;
  return Math.max(0, Math.floor((dateToLocalTime(endDate) - dateToLocalTime(startDate)) / DAY_MS));
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
    <form onSubmit={handleSubmit} className="space-y-4">
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
        <div className="flex items-center justify-between rounded-lg border bg-muted/40 p-3">
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
          <Button type="button" variant="ghost" size="sm" onClick={() => setSelected(null)}>
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
  const DirectionIcon = isGain ? TrendingUp : TrendingDown;
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
          <Badge variant="outline" className="text-[10px]">
            {stock.currency}
          </Badge>
          {stock.exchange && (
            <Badge variant="secondary" className="max-w-40 truncate text-[10px]">
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
        {compact && noteText && (
          <p className="mt-1 truncate text-xs leading-4 text-muted-foreground">
            <span className="text-muted-foreground/70">{t("note")}:</span> {noteText}
          </p>
        )}
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
    <Card size="sm" className="overflow-visible md:py-2">
      <CardContent className="space-y-3 md:px-3">
        <div className="hidden items-center gap-3 md:grid md:grid-cols-[minmax(190px,1.45fr)_minmax(118px,0.85fr)_minmax(122px,0.9fr)_minmax(112px,0.8fr)_minmax(104px,0.72fr)_1.75rem]">
          {renderIdentity(true)}

          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">{t("recorded")}</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
              {recordPrice}
            </p>
            <div className="mt-0.5 space-y-0.5 text-[11px] leading-4 text-muted-foreground">
              <p className="truncate">{format.date(stock.recordDate)}</p>
              {recordPeriodLabel && <p className="truncate">{recordPeriodLabel}</p>}
            </div>
          </div>

          <div className="min-w-0">
            <p className="text-[11px] font-medium text-muted-foreground">{t("latestPrice")}</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
              {latestPrice ?? t("unavailable")}
            </p>
            {stock.latestPriceUpdatedAt ? (
              <FreshnessBadge
                kind="price"
                timestamp={stock.latestPriceUpdatedAt}
                mobileShort
                className="mt-1 max-w-full"
              />
            ) : (
              <p className="mt-0.5 truncate text-[11px] leading-4 text-muted-foreground">
                {t("noLatestPrice")}
              </p>
            )}
          </div>

          <div
            className={cn("min-w-0", stock.change !== null && (isGain ? "text-gain" : "text-loss"))}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{t("change")}</p>
            <p className="mt-0.5 flex items-center gap-1 truncate font-mono text-sm font-semibold tabular-nums">
              {stock.change !== null && <DirectionIcon className="h-3.5 w-3.5 shrink-0" />}
              {change ?? t("unavailable")}
            </p>
          </div>

          <div
            className={cn(
              "min-w-0",
              stock.changePercent !== null && (isGain ? "text-gain" : "text-loss"),
            )}
          >
            <p className="text-[11px] font-medium text-muted-foreground">{t("changePercent")}</p>
            <p className="mt-0.5 truncate font-mono text-sm font-semibold tabular-nums">
              {percent ?? t("unavailable")}
            </p>
          </div>

          <div className="justify-self-end">{renderActions()}</div>
        </div>

        <div className="flex items-start justify-between gap-3 md:hidden">
          {renderIdentity()}
          {renderActions()}
        </div>

        <div className="space-y-2 md:hidden">
          <div className="rounded-lg border border-border/60 bg-muted/25 p-3">
            <div className="flex items-start justify-between gap-3">
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{t("latestPrice")}</p>
                <p className="mt-1 truncate font-mono text-lg font-semibold leading-6 tabular-nums">
                  {latestPrice ?? t("unavailable")}
                </p>
              </div>
              <div
                className={cn(
                  "min-w-0 shrink-0 text-right",
                  (stock.change !== null || stock.changePercent !== null) &&
                    (isGain ? "text-gain" : "text-loss"),
                )}
              >
                <p className="text-xs opacity-80">{t("change")}</p>
                <p className="mt-1 flex items-center justify-end gap-1 font-mono text-sm font-semibold tabular-nums">
                  {stock.change !== null && <DirectionIcon className="h-3.5 w-3.5 shrink-0" />}
                  {change ?? t("unavailable")}
                </p>
                <p className="mt-0.5 font-mono text-sm font-semibold tabular-nums">
                  {percent ?? t("unavailable")}
                </p>
              </div>
            </div>
            {stock.latestPriceUpdatedAt ? (
              <FreshnessBadge
                kind="price"
                timestamp={stock.latestPriceUpdatedAt}
                mobileShort
                className="mt-2"
              />
            ) : (
              <p className="mt-2 text-xs text-muted-foreground">{t("noLatestPrice")}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="min-w-0 rounded-lg bg-muted/30 p-2.5">
              <p className="text-xs text-muted-foreground">{t("recorded")}</p>
              <p className="mt-1 truncate font-mono text-sm font-semibold tabular-nums">
                {recordPrice}
              </p>
            </div>
            <div className="min-w-0 rounded-lg bg-muted/30 p-2.5">
              <p className="truncate text-xs text-muted-foreground">
                {format.date(stock.recordDate)}
              </p>
              {recordPeriodLabel && (
                <p className="mt-1 truncate text-xs text-muted-foreground">{recordPeriodLabel}</p>
              )}
            </div>
          </div>

          {noteText && (
            <div className="rounded-lg border border-border/60 bg-background/60 px-3 py-2">
              <p className="truncate text-sm text-muted-foreground">
                <span className="text-xs text-muted-foreground/75">{t("note")}:</span> {noteText}
              </p>
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
}

export function StockTrackerView({ stocks }: { stocks: SerializedTrackedStock[] }) {
  const t = useTranslations("stocks");
  const common = useTranslations("common");
  const router = useRouter();
  const [formOpen, setFormOpen] = useState(false);
  const [editingStock, setEditingStock] = useState<SerializedTrackedStock | null>(null);
  const [deletingStock, setDeletingStock] = useState<SerializedTrackedStock | null>(null);
  const [refreshing, setRefreshing] = useState(false);

  async function refreshPrices() {
    hapticTick();
    setRefreshing(true);
    try {
      const res = await fetch("/api/stocks/refresh", { method: "POST" });
      if (!res.ok) throw new Error("refresh failed");
      const { data }: { data: { updated: number } } = await res.json();
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
    if (!deletingStock) return;
    const stock = deletingStock;
    try {
      const res = await fetch(`/api/stocks/${stock.id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("delete failed");
      toast.success(t("deleteSuccess", { symbol: stock.symbol }));
      setDeletingStock(null);
      startTransition(() => router.refresh());
    } catch {
      toast.error(t("deleteFailed"));
    }
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <ChartCandlestick className="h-4 w-4 text-primary" />
          <span>{t("trackedCount", { count: stocks.length })}</span>
        </div>
        <div className="grid grid-cols-2 gap-2 sm:flex">
          <Button
            variant="outline"
            onClick={refreshPrices}
            disabled={refreshing || stocks.length === 0}
            className="w-full sm:w-auto"
          >
            <RefreshCw className={cn("h-4 w-4", refreshing && "animate-spin")} />
            {refreshing ? t("refreshing") : t("refreshPrices")}
          </Button>
          <Button
            onClick={() => {
              setEditingStock(null);
              setFormOpen(true);
            }}
            className="w-full sm:w-auto"
          >
            <Plus className="h-4 w-4" />
            {t("addStock")}
          </Button>
        </div>
      </div>

      {stocks.length === 0 ? (
        <div className="rounded-xl border border-dashed bg-card px-4 py-12 text-center">
          <div className="mx-auto flex h-11 w-11 items-center justify-center rounded-full bg-primary/10 text-primary">
            <ChartCandlestick className="h-5 w-5" />
          </div>
          <h2 className="mt-4 text-base font-semibold">{t("emptyTitle")}</h2>
          <p className="mx-auto mt-2 max-w-md text-sm text-muted-foreground">{t("emptyBody")}</p>
          <Button
            className="mt-5"
            onClick={() => {
              setEditingStock(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" />
            {t("addStock")}
          </Button>
        </div>
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

      <AlertDialog open={!!deletingStock} onOpenChange={(open) => !open && setDeletingStock(null)}>
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
            <AlertDialogCancel>{common("cancel")}</AlertDialogCancel>
            <AlertDialogAction onClick={deleteStock}>{t("deleteStock")}</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
