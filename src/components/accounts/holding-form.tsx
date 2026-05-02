"use client";

import { useState, startTransition } from "react";
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
import { Badge } from "@/components/ui/badge";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { HoldingSearch } from "./holding-search";
import type { SearchResult } from "./holding-search";
import { OptionBuilder } from "./option-builder";

const ASSET_TYPES = [
  { value: "STOCK", label: "Stock" },
  { value: "ETF", label: "ETF" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "BOND", label: "Bond" },
  { value: "OTHER", label: "Other" },
];

type Mode = "stock" | "option";

export function HoldingForm({
  open,
  onClose,
  accountId,
  onSuccess,
}: {
  open: boolean;
  onClose: () => void;
  accountId: string;
  onSuccess?: () => void;
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [mode, setMode] = useState<Mode>("stock");

  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [assetType, setAssetType] = useState("STOCK");
  const [currency, setCurrency] = useState("USD");
  const [manualMode, setManualMode] = useState(false);

  function selectResult(result: SearchResult) {
    setSymbol(result.symbol);
    setName(result.name);
    setAssetType(result.type);
    setCurrency(result.currency);
    setManualMode(false);
  }

  function clearSelection() {
    setSymbol("");
    setName("");
    setAssetType("STOCK");
    setCurrency("USD");
    setQuantity("");
    setManualMode(false);
  }

  function resetForm() {
    clearSelection();
    setMode("stock");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function postHolding(payload: {
    symbol: string;
    name: string;
    quantity: number;
    assetType: string;
    currency: string;
  }) {
    setLoading(true);
    try {
      const res = await fetch(`/api/accounts/${accountId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(err.error?.message || "Failed");
      }

      toast.success(`Added ${payload.symbol}`);
      handleClose();
      if (onSuccess) onSuccess();
      startTransition(() => { router.refresh(); });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to add holding");
    } finally {
      setLoading(false);
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    await postHolding({ symbol, name, quantity: parseFloat(quantity), assetType, currency });
  }

  const tickerSelected = !!symbol;
  const canSubmit = (tickerSelected || (manualMode && symbol && name)) && !!quantity && parseFloat(quantity) > 0;

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="fixed inset-x-0 bottom-0 top-auto translate-y-0 rounded-t-2xl rounded-b-none border-t pb-[calc(env(safe-area-inset-bottom)+1rem)] data-[ending-style]:translate-y-full sm:top-1/2 sm:bottom-auto sm:max-w-md sm:-translate-x-1/2 sm:-translate-y-1/2 sm:rounded-2xl sm:pb-6">
        <DialogHeader>
          <div className="mx-auto mb-2 h-1.5 w-12 rounded-full bg-muted" aria-hidden="true" />
          <DialogTitle>
            {mode === "option" ? "Add Option Contract" : "Add Holding"}
          </DialogTitle>
        </DialogHeader>

        {/* Mode tabs */}
        <Tabs value={mode} onValueChange={(v) => { if (v) { setMode(v as Mode); clearSelection(); } }}>
          <TabsList>
            <TabsTrigger value="stock">Stock / ETF / Crypto</TabsTrigger>
            <TabsTrigger value="option">Option</TabsTrigger>
          </TabsList>
        </Tabs>

        {mode === "option" ? (
          <OptionBuilder
            loading={loading}
            onSubmit={postHolding}
            onCancel={handleClose}
          />
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* ── Ticker section ── */}
            {tickerSelected ? (
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{symbol}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {ASSET_TYPES.find((t) => t.value === assetType)?.label ?? assetType}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {currency}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">{name}</p>
                </div>
                <Button type="button" variant="ghost" size="sm" onClick={clearSelection}>
                  Change
                </Button>
              </div>
            ) : manualMode ? (
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="e.g. AAPL"
                      autoFocus
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Asset Type</Label>
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>{t.label}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-2">
                  <Label>Name</Label>
                  <Input
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="e.g. Apple Inc."
                    required
                  />
                </div>
                <p className="text-xs text-muted-foreground">
                  <button
                    type="button"
                    className="text-primary underline underline-offset-2 hover:text-primary/80"
                    onClick={() => setManualMode(false)}
                  >
                    Search instead
                  </button>
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <HoldingSearch onSelect={selectResult} autoFocus />
                <div className="pt-2 border-t">
                  <p className="text-xs text-muted-foreground">
                    Can&apos;t find what you&apos;re looking for?{" "}
                    <button
                      type="button"
                      className="text-primary underline underline-offset-2 hover:text-primary/80"
                      onClick={() => setManualMode(true)}
                    >
                      Enter manually
                    </button>
                  </p>
                </div>
              </div>
            )}

            {/* ── Quantity ── */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Number of Shares</Label>
              <Input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 100"
                required
                autoFocus={tickerSelected}
                className="text-lg h-12"
              />
            </div>

            {/* ── Actions ── */}
            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading || !canSubmit}>
                {loading ? "Adding..." : "Add Holding"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
