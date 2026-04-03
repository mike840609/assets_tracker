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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { toast } from "sonner";
import type { SerializedAccountWithHoldings } from "@/lib/types";

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

const ASSET_TYPE_TO_CATEGORY: Record<string, string> = {
  STOCK: "BROKERAGE",
  ETF: "BROKERAGE",
  MUTUAL_FUND: "BROKERAGE",
  BOND: "BROKERAGE",
  CRYPTO: "CRYPTO_WALLET",
  OTHER: "BROKERAGE",
};

const DEFAULT_ACCOUNT_NAMES: Record<string, string> = {
  BROKERAGE: "Brokerage",
  CRYPTO_WALLET: "Crypto Wallet",
};

const CATEGORY_LABELS: Record<string, string> = {
  BROKERAGE: "Brokerage",
  CRYPTO_WALLET: "Crypto Wallet",
};

export function QuickAddHolding({
  open,
  onClose,
  accounts,
}: {
  open: boolean;
  onClose: () => void;
  accounts: SerializedAccountWithHoldings[];
}) {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [step, setStep] = useState<"search" | "confirm" | "account">("search");

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

  // Account selection state
  const [selectedAccountId, setSelectedAccountId] = useState("");

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
    setSelectedAccountId("");
  }

  function handleClose() {
    resetForm();
    onClose();
  }

  function getMatchingAccounts() {
    const targetCategory = ASSET_TYPE_TO_CATEGORY[assetType] || "BROKERAGE";
    return accounts.filter(
      (a) => a.type === "ASSET" && a.category === targetCategory
    );
  }

  function proceedToAccount() {
    const matching = getMatchingAccounts();
    if (matching.length === 1) {
      setSelectedAccountId(matching[0].id);
    } else if (matching.length > 1) {
      setSelectedAccountId(matching[0].id);
    } else {
      setSelectedAccountId("");
    }
    setStep("account");
  }

  async function handleSubmit() {
    setLoading(true);
    try {
      let accountId = selectedAccountId;

      // Auto-create account if needed
      if (!accountId) {
        const targetCategory = ASSET_TYPE_TO_CATEGORY[assetType] || "BROKERAGE";
        const res = await fetch("/api/accounts", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({
            name: DEFAULT_ACCOUNT_NAMES[targetCategory] || "Brokerage",
            type: "ASSET",
            category: targetCategory,
            currency: "USD",
            cashBalance: 0,
          }),
        });
        if (!res.ok) throw new Error("Failed to create account");
        const newAccount = await res.json();
        accountId = newAccount.id;
      }

      // Add the holding
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
        let message = "Failed to add holding";
        try {
          const err = await res.json();
          message =
            typeof err.error === "string"
              ? err.error
              : JSON.stringify(err.error) || message;
        } catch {
          // Response body may not be valid JSON
        }
        throw new Error(message);
      }

      toast.success(`Added ${symbol}`);
      handleClose();
      router.refresh();
    } catch (error) {
      toast.error(
        error instanceof Error ? error.message : "Failed to add holding"
      );
    } finally {
      setLoading(false);
    }
  }

  const targetCategory = ASSET_TYPE_TO_CATEGORY[assetType] || "BROKERAGE";
  const matchingAccounts = getMatchingAccounts();

  return (
    <Dialog open={open} onOpenChange={(v) => !v && handleClose()}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {step === "search"
              ? "Search Ticker"
              : step === "confirm"
                ? "Add Holding"
                : "Select Account"}
          </DialogTitle>
        </DialogHeader>

        {step === "search" && (
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
                          <Badge
                            variant="secondary"
                            className="text-[10px] px-1.5 py-0"
                          >
                            {r.type}
                          </Badge>
                        </div>
                        <p className="text-xs text-muted-foreground truncate mt-0.5">
                          {r.name}
                        </p>
                      </div>
                      <div className="text-right shrink-0">
                        <Badge
                          variant="outline"
                          className="text-[10px] px-1.5 py-0"
                        >
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
        )}

        {step === "confirm" && (
          <div className="space-y-4">
            {symbol && name && (
              <div className="flex items-center justify-between rounded-lg border bg-muted/50 p-3">
                <div>
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-bold">{symbol}</span>
                    <Badge
                      variant="secondary"
                      className="text-[10px] px-1.5 py-0"
                    >
                      {ASSET_TYPES.find((t) => t.value === assetType)?.label ||
                        assetType}
                    </Badge>
                    <Badge
                      variant="outline"
                      className="text-[10px] px-1.5 py-0"
                    >
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
                      className="flex h-9 w-full rounded-lg border border-input bg-background px-3 py-1 text-sm shadow-sm transition-colors placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
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
              <Button
                type="button"
                disabled={!quantity || parseFloat(quantity) <= 0 || (!symbol && !name)}
                onClick={proceedToAccount}
              >
                Next
              </Button>
            </div>
          </div>
        )}

        {step === "account" && (
          <div className="space-y-4">
            {/* Holding summary */}
            <div className="rounded-lg border bg-muted/50 p-3">
              <div className="flex items-center gap-2">
                <span className="font-mono font-bold">{symbol}</span>
                <Badge
                  variant="secondary"
                  className="text-[10px] px-1.5 py-0"
                >
                  {ASSET_TYPES.find((t) => t.value === assetType)?.label ||
                    assetType}
                </Badge>
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                  {currency}
                </Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-0.5">
                {name} &middot; {quantity} shares
              </p>
            </div>

            {matchingAccounts.length === 0 && (
              <div className="space-y-2">
                <p className="text-sm text-muted-foreground">
                  No {CATEGORY_LABELS[targetCategory] || targetCategory} account
                  found. A new{" "}
                  <span className="font-medium text-foreground">
                    &ldquo;{DEFAULT_ACCOUNT_NAMES[targetCategory]}&rdquo;
                  </span>{" "}
                  account will be created automatically.
                </p>
              </div>
            )}

            {matchingAccounts.length === 1 && (
              <div className="space-y-2">
                <Label>Account</Label>
                <div className="rounded-lg border bg-muted/50 p-3">
                  <p className="font-medium">{matchingAccounts[0].name}</p>
                  <p className="text-sm text-muted-foreground">
                    {CATEGORY_LABELS[matchingAccounts[0].category] ||
                      matchingAccounts[0].category}
                  </p>
                </div>
              </div>
            )}

            {matchingAccounts.length > 1 && (
              <div className="space-y-2">
                <Label>Select Account</Label>
                <Select
                  value={selectedAccountId}
                  onValueChange={(v) => v && setSelectedAccountId(v)}
                >
                  <SelectTrigger className="w-full">
                    <SelectValue>
                      {matchingAccounts.find((a) => a.id === selectedAccountId)
                        ?.name ?? "Choose an account"}
                    </SelectValue>
                  </SelectTrigger>
                  <SelectContent>
                    {matchingAccounts.map((a) => (
                      <SelectItem key={a.id} value={a.id}>
                        {a.name}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            )}

            <div className="flex justify-between pt-2">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setStep("confirm")}
              >
                Back
              </Button>
              <div className="flex gap-2">
                <Button type="button" variant="outline" onClick={handleClose}>
                  Cancel
                </Button>
                <Button
                  type="button"
                  disabled={loading}
                  onClick={handleSubmit}
                >
                  {loading ? "Adding..." : "Add Holding"}
                </Button>
              </div>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
