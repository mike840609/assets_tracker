"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { HoldingSearch } from "./holding-search";
import type { SearchResult } from "./holding-search";
import {
  buildOccSymbol,
  formatOptionLabel,
  formatOptionShort,
  parseOccSymbol,
  tryParseOccSymbol,
  type OptionSide,
} from "@/lib/options";

function fmtExp(iso: string) {
  const [y, m, d] = iso.split("-").map(Number);
  return new Date(y, m - 1, d).toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

type ChainContract = {
  contractSymbol: string;
  strike: number;
  lastPrice: number | null;
  bid: number | null;
  ask: number | null;
};

type ChainResponse = {
  underlying: string;
  expirations: string[];
  chains: Record<string, { calls: ChainContract[]; puts: ChainContract[] }>;
};

type SubmitPayload = {
  symbol: string;
  name: string;
  quantity: number;
  assetType: "OPTION";
  currency: "USD";
};

interface OptionBuilderProps {
  loading: boolean;
  onSubmit?: (payload: SubmitPayload) => Promise<void>;
  /** When provided, called instead of onSubmit — lets the parent handle submission (e.g. account selection). */
  onConfigure?: (payload: SubmitPayload) => void;
  onCancel: () => void;
}

export function OptionBuilder({ loading, onSubmit, onConfigure, onCancel }: OptionBuilderProps) {
  const [underlying, setUnderlying] = useState("");
  const [chain, setChain] = useState<ChainResponse | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);
  const [expChainLoading, setExpChainLoading] = useState(false);

  const [expiration, setExpiration] = useState("");
  const [side, setSide] = useState<OptionSide>("CALL");
  const [strike, setStrike] = useState<string>("");
  const [quantity, setQuantity] = useState("");

  const [showSearch, setShowSearch] = useState(false);
  const [pasteMode, setPasteMode] = useState(false);
  const [pasteValue, setPasteValue] = useState("");
  const [pasteError, setPasteError] = useState<string | null>(null);

  const fetchChain = useCallback(async (symbol: string) => {
    setChainLoading(true);
    setChainError(null);
    try {
      const res = await fetch(`/api/options/chain?symbol=${encodeURIComponent(symbol)}`);
      const { data }: { data: ChainResponse } = await res.json();
      setChain(data);
      if (data.expirations.length === 0) {
        setChainError(`No option chain available for ${symbol}`);
        return;
      }
      const firstLoaded = data.expirations.find((exp) => data.chains[exp]);
      const firstExp = firstLoaded ?? data.expirations[0] ?? "";
      setExpiration(firstExp);
      const firstChainBlock = firstExp ? data.chains[firstExp] : undefined;
      const firstStrike = firstChainBlock?.calls[0]?.strike;
      setStrike(firstStrike !== undefined ? String(firstStrike) : "");
    } catch {
      setChainError(`Failed to load option chain for ${symbol}`);
    } finally {
      setChainLoading(false);
    }
  }, []);

  // Lazy-load chain data when user picks an expiration not yet fetched.
  const underlyingRef = useRef(underlying);
  underlyingRef.current = underlying;
  useEffect(() => {
    if (!chain || !expiration || chain.chains[expiration]) return;
    setExpChainLoading(true);
    const sym = underlyingRef.current;
    fetch(`/api/options/chain?symbol=${encodeURIComponent(sym)}&date=${expiration}`)
      .then((r) => r.json())
      .then(({ data }: { data: ChainResponse }) => {
        if (data.chains[expiration]) {
          setChain((prev) =>
            prev ? { ...prev, chains: { ...prev.chains, ...data.chains } } : null,
          );
        }
      })
      .catch((err) => console.error("Chain fetch error:", err))
      .finally(() => setExpChainLoading(false));
  }, [chain, expiration]);

  // When expiration or side changes, reset strike if the current one is no longer valid.
  const strikeRef = useRef(strike);
  strikeRef.current = strike;
  useEffect(() => {
    if (!chain || !expiration) return;
    const block = chain.chains[expiration];
    if (!block) return;
    const arr = side === "CALL" ? block.calls : block.puts;
    if (arr.length === 0) return;
    const stillValid = arr.some((c) => String(c.strike) === strikeRef.current);
    if (!stillValid) {
      const middle = arr[Math.floor(arr.length / 2)];
      setStrike(String(middle.strike));
    }
  }, [chain, expiration, side]);

  function loadChain(sym: string) {
    const cleaned = sym.trim().toUpperCase();
    if (!cleaned || cleaned === chain?.underlying) return;
    setUnderlying(cleaned);
    void fetchChain(cleaned);
  }

  function handleUnderlyingKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    if (e.key === "Enter") {
      e.preventDefault();
      loadChain(underlying);
    }
  }

  function handleUnderlyingSearch(r: SearchResult) {
    setShowSearch(false);
    setUnderlying(r.symbol);
    void fetchChain(r.symbol);
  }

  function handlePaste(e: React.SyntheticEvent) {
    e.preventDefault();
    setPasteError(null);
    const trimmed = pasteValue.trim().toUpperCase();
    try {
      const parsed = parseOccSymbol(trimmed);
      setUnderlying(parsed.underlying);
      const expIso = parsed.expiration.toISOString().slice(0, 10);
      setExpiration(expIso);
      setSide(parsed.optionType);
      setStrike(String(parsed.strike));
      setChain({
        underlying: parsed.underlying,
        expirations: [expIso],
        chains: {
          [expIso]: {
            calls: parsed.optionType === "CALL"
              ? [{ contractSymbol: trimmed, strike: parsed.strike, lastPrice: null, bid: null, ask: null }]
              : [],
            puts: parsed.optionType === "PUT"
              ? [{ contractSymbol: trimmed, strike: parsed.strike, lastPrice: null, bid: null, ask: null }]
              : [],
          },
        },
      });
      setPasteMode(false);
      setPasteValue("");
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Invalid option symbol");
    }
  }

  function dispatchPayload(payload: SubmitPayload) {
    if (onConfigure) {
      onConfigure(payload);
    } else if (onSubmit) {
      void onSubmit(payload);
    }
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!underlying || !expiration || !strike || !quantity) return;
    const strikeNum = Number(strike);
    if (!Number.isFinite(strikeNum) || strikeNum <= 0) return;
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) return;
    try {
      const occ = buildOccSymbol({
        underlying,
        expiration: new Date(`${expiration}T00:00:00.000Z`),
        optionType: side,
        strike: strikeNum,
      });
      const parsed = parseOccSymbol(occ);
      dispatchPayload({
        symbol: occ,
        name: formatOptionLabel(parsed),
        quantity: qty,
        assetType: "OPTION",
        currency: "USD",
      });
    } catch {
      // invalid inputs — buildOccSymbol threw
    }
  }

  // Derived chain data for current expiration + side
  const currentBlock = chain && expiration ? chain.chains[expiration] : undefined;
  const strikesForSide: ChainContract[] = currentBlock
    ? side === "CALL" ? currentBlock.calls : currentBlock.puts
    : [];
  const selectedContract = strikesForSide.find((c) => String(c.strike) === strike);

  // OCC preview
  const previewOcc = (() => {
    if (!underlying || !expiration || !strike) return "";
    const n = Number(strike);
    if (!Number.isFinite(n) || n <= 0) return "";
    try {
      return buildOccSymbol({
        underlying,
        expiration: new Date(`${expiration}T00:00:00.000Z`),
        optionType: side,
        strike: n,
      });
    } catch {
      return "";
    }
  })();
  const previewParsed = previewOcc ? tryParseOccSymbol(previewOcc) : null;

  const ask = selectedContract?.ask ?? null;
  const qtyNum = parseInt(quantity, 10);
  const previewCost =
    ask !== null && Number.isFinite(qtyNum) && qtyNum > 0
      ? ask * qtyNum * 100
      : null;

  const canSubmit =
    !loading &&
    !!underlying &&
    !!expiration &&
    !!strike &&
    !!quantity &&
    parseInt(quantity, 10) > 0;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      {/* ── Underlying ── */}
      <div className="space-y-2">
        <Label>Underlying Symbol</Label>
        {showSearch ? (
          <div className="space-y-2">
            <HoldingSearch
              onSelect={handleUnderlyingSearch}
              label="Search underlying stock or ETF"
              placeholder="e.g. AAPL, SPY"
              autoFocus
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={() => setShowSearch(false)}
            >
              Cancel
            </Button>
          </div>
        ) : (
          <div className="flex gap-2">
            <Input
              value={underlying}
              onChange={(e) =>
                setUnderlying(e.target.value.toUpperCase().replace(/[^A-Z0-9.\-]/g, ""))
              }
              onKeyDown={handleUnderlyingKeyDown}
              placeholder="e.g. AAPL, SPY"
              autoFocus={!chain}
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              className="shrink-0"
              onClick={() => loadChain(underlying)}
              disabled={!underlying || chainLoading}
            >
              Load
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="shrink-0"
              onClick={() => setShowSearch(true)}
            >
              Search
            </Button>
          </div>
        )}

        {chainLoading && (
          <p className="text-xs text-muted-foreground">Loading option chain…</p>
        )}
        {chainError && (
          <p className="text-xs text-destructive">{chainError}</p>
        )}
      </div>

      {/* ── Expiration dropdown (shown once chain is loaded) ── */}
      {chain && chain.expirations.length > 0 && (
        <div className="space-y-2">
          <Label>Expiration</Label>
          <Select value={expiration} onValueChange={(v) => v && setExpiration(v)}>
            <SelectTrigger className="w-full">
              <SelectValue>
                {expiration ? fmtExp(expiration) : "Select expiration"}
              </SelectValue>
            </SelectTrigger>
            <SelectContent>
              {chain.expirations.map((exp) => (
                <SelectItem key={exp} value={exp}>
                  {fmtExp(exp)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      )}

      {/* ── Call / Put ── */}
      <div className="space-y-2">
        <Label>Type</Label>
        <Tabs value={side} onValueChange={(v) => v && setSide(v as OptionSide)}>
          <TabsList>
            <TabsTrigger value="CALL">Call</TabsTrigger>
            <TabsTrigger value="PUT">Put</TabsTrigger>
          </TabsList>
        </Tabs>
      </div>

      {/* ── Strike dropdown (shown once expiration chain data is loaded) ── */}
      {chain && expiration && (
        <div className="space-y-2">
          <Label>Strike</Label>
          {expChainLoading ? (
            <p className="text-sm text-muted-foreground">Loading strikes…</p>
          ) : strikesForSide.length === 0 ? (
            <p className="text-sm text-destructive">
              No strikes available for this expiration.
            </p>
          ) : (
            <Select
              value={strike}
              onValueChange={(v) => { if (v) setStrike(v); }}
            >
              <SelectTrigger className="w-full">
                <SelectValue>
                  {strike ? `$${strike}` : "Select strike"}
                </SelectValue>
              </SelectTrigger>
              <SelectContent>
                {strikesForSide.map((c) => {
                  const askLabel =
                    c.ask !== null ? ` — ask $${c.ask.toFixed(2)}` : "";
                  return (
                    <SelectItem key={c.contractSymbol} value={String(c.strike)}>
                      ${c.strike}{askLabel}
                    </SelectItem>
                  );
                })}
              </SelectContent>
            </Select>
          )}
        </div>
      )}

      {/* ── Placeholder when chain not yet loaded ── */}
      {!chain && !chainLoading && (
        <p className="text-xs text-muted-foreground">
          Enter an underlying symbol above and click <strong>Load</strong> (or press Enter)
          to see available expirations and strikes.
        </p>
      )}

      {/* ── Quantity ── */}
      <div className="space-y-2">
        <Label className="text-base font-medium">Number of Contracts</Label>
        <Input
          type="number"
          step="1"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 1"
          className="text-lg h-12"
        />
        <p className="text-xs text-muted-foreground">1 contract = 100 shares</p>
      </div>

      {/* ── Summary / cost preview ── */}
      {previewParsed && (
        <div className="rounded-md bg-muted/50 px-3 py-2 space-y-0.5">
          <div className="flex items-center gap-2">
            <span className="text-sm font-medium">
              {formatOptionShort(previewParsed)}
            </span>
            <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
              Option
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">{formatOptionLabel(previewParsed)}</p>
          <p className="text-[11px] font-mono text-muted-foreground">{previewOcc}</p>
          {previewCost !== null && (
            <p className="text-xs text-muted-foreground">
              Est. cost at ask: ${previewCost.toFixed(2)} ({qtyNum} × $
              {ask?.toFixed(2)} × 100)
            </p>
          )}
        </div>
      )}

      {/* ── Paste OCC ── */}
      <div className="pt-1 border-t">
        <button
          type="button"
          className="text-xs text-primary underline underline-offset-2 hover:text-primary/80"
          onClick={() => setPasteMode((v) => !v)}
        >
          Paste OCC symbol
        </button>

        {pasteMode && (
          <div className="mt-2 space-y-2">
            <Label>OCC symbol</Label>
            <Input
              value={pasteValue}
              onChange={(e) => setPasteValue(e.target.value.toUpperCase())}
              placeholder="e.g. AAPL250117C00150000"
              autoFocus
            />
            {pasteError && (
              <p className="text-xs text-destructive">{pasteError}</p>
            )}
            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => { setPasteMode(false); setPasteValue(""); setPasteError(null); }}
              >
                Cancel
              </Button>
              <Button type="button" size="sm" onClick={handlePaste}>
                Use
              </Button>
            </div>
          </div>
        )}
      </div>

      {/* ── Actions ── */}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button type="submit" disabled={!canSubmit}>
          {onConfigure ? "Next" : loading ? "Adding…" : "Add Option"}
        </Button>
      </div>
    </form>
  );
}
