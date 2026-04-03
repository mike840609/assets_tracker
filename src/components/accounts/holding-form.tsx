"use client";

import { useState, useRef, useEffect, useCallback } from "react";
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
import { toast } from "sonner";

type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
};

const ASSET_TYPES = [
  { value: "STOCK", label: "Stock" },
  { value: "ETF", label: "ETF" },
  { value: "CRYPTO", label: "Crypto" },
  { value: "MUTUAL_FUND", label: "Mutual Fund" },
  { value: "BOND", label: "Bond" },
  { value: "OTHER", label: "Other" },
];

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
  const [step, setStep] = useState<"search" | "confirm">("search");

  // Search state
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  // Selected holding state
  const [symbol, setSymbol] = useState("");
  const [name, setName] = useState("");
  const [quantity, setQuantity] = useState("");
  const [assetType, setAssetType] = useState("STOCK");
  const [currency, setCurrency] = useState("USD");

  // Close dropdown on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (searchRef.current && !searchRef.current.contains(e.target as Node)) {
        setShowResults(false);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  const searchTickers = useCallback(async (q: string) => {
    if (q.length < 1) {
      setResults([]);
      setShowResults(false);
      return;
    }

    setSearching(true);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      const data: SearchResult[] = await res.json();
      setResults(data);
      setShowResults(data.length > 0);
    } catch {
      setResults([]);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTickers(value), 300);
  }

  function selectResult(result: SearchResult) {
    setSymbol(result.symbol);
    setName(result.name);
    setAssetType(result.type);
    setCurrency(result.currency);
    setShowResults(false);
    setStep("confirm");
  }

  function resetForm() {
    setStep("search");
    setQuery("");
    setResults([]);
    setSymbol("");
    setName("");
    setQuantity("");
    setAssetType("STOCK");
    setCurrency("USD");
    setShowResults(false);
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);

    try {
      const res = await fetch(`/api/accounts/${accountId}/holdings`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          symbol,
          name,
          quantity: parseFloat(quantity),
          assetType,
          currency,
        }),
      });

      if (!res.ok) {
        const err = await res.json();
        throw new Error(JSON.stringify(err.error) || "Failed");
      }

      toast.success(`Added ${symbol}`);
      handleClose();
      if (onSuccess) onSuccess();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add holding"
      );
    } finally {
      setLoading(false);
    }
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "search" ? "Search Ticker" : "Add Holding"}
          </DialogTitle>
        </DialogHeader>

        {step === "search" ? (
          <div className="space-y-4">
            <div ref={searchRef} className="relative">
              <div className="space-y-2">
                <Label>Search by name or ticker symbol</Label>
                <div className="relative">
                  <Input
                    value={query}
                    onChange={(e) => handleQueryChange(e.target.value)}
                    placeholder="e.g. Apple, TSMC, 2330, BTC..."
                    autoFocus
                  />
                  {searching && (
                    <div className="absolute right-3 top-1/2 -translate-y-1/2">
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
                    </div>
                  )}
                </div>
              </div>

              {showResults && (
                <div className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-lg max-h-72 overflow-y-auto">
                  {results.map((r) => (
                    <button
                      key={r.symbol}
                      type="button"
                      className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
                      onClick={() => selectResult(r)}
                    >
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <span className="font-mono font-semibold text-sm">
                            {r.symbol}
                          </span>
                          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                            {r.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                          {r.currency}
                        </Badge>
                        <p className="text-[10px] text-muted-foreground mt-0.5">
                          {r.exchange}
                        </p>
                      </div>
                    </button>
                  ))}
                </div>
              )}
            </div>

            {/* Manual entry fallback */}
            <div className="pt-2 border-t">
              <p className="text-xs text-muted-foreground mb-3">
                Can&apos;t find what you&apos;re looking for?{" "}
                <button
                  type="button"
                  className="text-primary underline underline-offset-2 hover:text-primary/80"
                  onClick={() => setStep("confirm")}
                >
                  Enter manually
                </button>
              </p>
            </div>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            {/* Selected ticker confirmation */}
            {symbol && name && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{symbol}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {ASSET_TYPES.find((t) => t.value === assetType)?.label || assetType}
                    </Badge>
                    <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                      {currency}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground mt-0.5">
                    {name}
                  </p>
                </div>
                <Button
                  type="button"
                  variant="ghost"
                  size="sm"
                  onClick={resetForm}
                >
                  Change
                </Button>
              </div>
            )}

            {/* Manual fields (shown if no ticker was selected via search) */}
            {!symbol && (
              <>
                <div className="grid grid-cols-2 gap-4">
                  <div className="space-y-2">
                    <Label>Symbol</Label>
                    <Input
                      value={symbol}
                      onChange={(e) => setSymbol(e.target.value.toUpperCase())}
                      placeholder="e.g. AAPL"
                      required
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Asset Type</Label>
                    <select
                      value={assetType}
                      onChange={(e) => setAssetType(e.target.value)}
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {ASSET_TYPES.map((t) => (
                        <option key={t.value} value={t.value}>
                          {t.label}
                        </option>
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
              </>
            )}

            {/* Number of shares — always shown */}
            <div className="space-y-2">
              <Label className="text-base font-medium">Number of Shares</Label>
              <Input
                type="number"
                step="any"
                value={quantity}
                onChange={(e) => setQuantity(e.target.value)}
                placeholder="e.g. 100"
                required
                autoFocus={!!symbol}
                className="text-lg h-12"
              />
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={handleClose}>
                Cancel
              </Button>
              <Button type="submit" disabled={loading}>
                {loading ? "Adding..." : "Add Holding"}
              </Button>
            </div>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
