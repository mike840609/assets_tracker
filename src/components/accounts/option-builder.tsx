"use client";

import { useState, useEffect, useCallback } from "react";
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
  onSubmit: (payload: SubmitPayload) => Promise<void>;
  onCancel: () => void;
}

type Step = "underlying" | "chain" | "review";

export function OptionBuilder({ loading, onSubmit, onCancel }: OptionBuilderProps) {
  const [step, setStep] = useState<Step>("underlying");
  const [underlying, setUnderlying] = useState("");
  const [chain, setChain] = useState<ChainResponse | null>(null);
  const [chainLoading, setChainLoading] = useState(false);
  const [chainError, setChainError] = useState<string | null>(null);

  const [expiration, setExpiration] = useState("");
  const [side, setSide] = useState<OptionSide>("CALL");
  const [strike, setStrike] = useState<string>("");
  const [quantity, setQuantity] = useState("");

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
      const firstExp = data.expirations[0] ?? "";
      setExpiration(firstExp);
      const firstChain = firstExp ? data.chains[firstExp] : undefined;
      const firstStrike = firstChain?.calls[0]?.strike;
      setStrike(firstStrike !== undefined ? String(firstStrike) : "");
      if (data.expirations.length === 0) {
        setChainError(`No option chain available for ${symbol}`);
      }
    } catch {
      setChainError(`Failed to load option chain for ${symbol}`);
    } finally {
      setChainLoading(false);
    }
  }, []);

  function handleUnderlyingPick(r: SearchResult) {
    setUnderlying(r.symbol);
    setStep("chain");
    void fetchChain(r.symbol);
  }

  // When the user changes the expiration, pick a sensible default strike for the new chain.
  useEffect(() => {
    if (!chain || !expiration) return;
    const block = chain.chains[expiration];
    if (!block) return;
    const arr = side === "CALL" ? block.calls : block.puts;
    if (arr.length === 0) return;
    const stillValid = arr.some((c) => String(c.strike) === strike);
    if (!stillValid) {
      const middle = arr[Math.floor(arr.length / 2)];
      setStrike(String(middle.strike));
    }
  }, [chain, expiration, side, strike]);

  const currentChainBlock = chain && expiration ? chain.chains[expiration] : undefined;
  const strikesForSide: ChainContract[] = currentChainBlock
    ? side === "CALL"
      ? currentChainBlock.calls
      : currentChainBlock.puts
    : [];
  const selectedContract = strikesForSide.find((c) => String(c.strike) === strike);

  function handleReview() {
    if (!underlying || !expiration || !strike) return;
    setStep("review");
  }

  function handlePaste(e: React.FormEvent) {
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
      setStep("review");
    } catch (err) {
      setPasteError(err instanceof Error ? err.message : "Invalid option symbol");
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!underlying || !expiration) return;
    const strikeNum = Number(strike);
    if (!Number.isFinite(strikeNum) || strikeNum <= 0) return;
    const occ = buildOccSymbol({
      underlying,
      expiration: new Date(`${expiration}T00:00:00.000Z`),
      optionType: side,
      strike: strikeNum,
    });
    const parsed = parseOccSymbol(occ);
    const qty = parseInt(quantity, 10);
    if (!Number.isFinite(qty) || qty <= 0) return;
    await onSubmit({
      symbol: occ,
      name: formatOptionLabel(parsed),
      quantity: qty,
      assetType: "OPTION",
      currency: "USD",
    });
  }

  if (step === "underlying") {
    return (
      <div className="space-y-4">
        <HoldingSearch
          onSelect={handleUnderlyingPick}
          label="Search underlying stock or ETF"
          placeholder="e.g. AAPL, SPY"
          autoFocus
        />
        <div className="pt-2 border-t">
          <p className="text-xs text-muted-foreground mb-3">
            Already know the contract?{" "}
            <button
              type="button"
              className="text-primary underline underline-offset-2 hover:text-primary/80"
              onClick={() => setPasteMode(true)}
            >
              Paste OCC symbol
            </button>
          </p>
          {pasteMode && (
            <form onSubmit={handlePaste} className="space-y-2">
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
                <Button type="button" variant="outline" size="sm" onClick={() => setPasteMode(false)}>
                  Cancel
                </Button>
                <Button type="submit" size="sm">
                  Use
                </Button>
              </div>
            </form>
          )}
        </div>
        <div className="flex justify-end">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
        </div>
      </div>
    );
  }

  if (step === "chain") {
    return (
      <div className="space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <p className="text-xs text-muted-foreground">Underlying</p>
            <p className="font-mono font-bold">{underlying}</p>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => {
              setStep("underlying");
              setChain(null);
            }}
          >
            Change
          </Button>
        </div>

        {chainLoading ? (
          <p className="text-sm text-muted-foreground">Loading option chain...</p>
        ) : chainError ? (
          <p className="text-sm text-destructive">{chainError}</p>
        ) : chain && chain.expirations.length > 0 ? (
          <>
            <div className="space-y-2">
              <Label>Expiration</Label>
              <Select value={expiration} onValueChange={(v) => v && setExpiration(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>{expiration}</SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {chain.expirations.map((exp) => (
                    <SelectItem key={exp} value={exp}>
                      {exp}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            <Tabs value={side} onValueChange={(v) => v && setSide(v as OptionSide)}>
              <TabsList>
                <TabsTrigger value="CALL">Call</TabsTrigger>
                <TabsTrigger value="PUT">Put</TabsTrigger>
              </TabsList>
            </Tabs>

            <div className="space-y-2">
              <Label>Strike</Label>
              <Select value={strike} onValueChange={(v) => v && setStrike(v)}>
                <SelectTrigger className="w-full">
                  <SelectValue>
                    {strike ? `$${strike}` : "Select strike"}
                  </SelectValue>
                </SelectTrigger>
                <SelectContent>
                  {strikesForSide.map((c) => {
                    const askLabel = c.ask !== null ? ` — ask $${c.ask.toFixed(2)}` : "";
                    return (
                      <SelectItem key={c.contractSymbol} value={String(c.strike)}>
                        ${c.strike}{askLabel}
                      </SelectItem>
                    );
                  })}
                </SelectContent>
              </Select>
            </div>

            <div className="flex justify-end gap-2 pt-2">
              <Button type="button" variant="outline" onClick={onCancel}>
                Cancel
              </Button>
              <Button
                type="button"
                onClick={handleReview}
                disabled={!expiration || !strike}
              >
                Continue
              </Button>
            </div>
          </>
        ) : null}
      </div>
    );
  }

  // review
  const previewOcc = (() => {
    try {
      return buildOccSymbol({
        underlying,
        expiration: new Date(`${expiration}T00:00:00.000Z`),
        optionType: side,
        strike: Number(strike),
      });
    } catch {
      return "";
    }
  })();
  const previewParsed = previewOcc ? tryParseOccSymbol(previewOcc) : null;
  const ask = selectedContract?.ask ?? null;
  const qtyNum = parseInt(quantity, 10);
  const previewCost = ask !== null && Number.isFinite(qtyNum) && qtyNum > 0
    ? ask * qtyNum * 100
    : null;

  return (
    <form onSubmit={handleSubmit} className="space-y-4">
      <div className="rounded-lg border bg-muted/50 p-3">
        <div className="flex items-center gap-2">
          <span className="font-mono font-bold text-sm">
            {previewParsed ? formatOptionShort(previewParsed) : previewOcc}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
            Option
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0">
            USD
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground mt-0.5">
          {previewParsed ? formatOptionLabel(previewParsed) : ""}
        </p>
        <p className="text-[11px] font-mono text-muted-foreground mt-1">
          {previewOcc}
        </p>
      </div>

      <div className="space-y-2">
        <Label className="text-base font-medium">Number of contracts</Label>
        <Input
          type="number"
          step="1"
          min="1"
          value={quantity}
          onChange={(e) => setQuantity(e.target.value)}
          placeholder="e.g. 1"
          required
          autoFocus
          className="text-lg h-12"
        />
        <p className="text-xs text-muted-foreground">1 contract = 100 shares</p>
      </div>

      {previewCost !== null && (
        <p className="text-xs text-muted-foreground">
          Estimated cost at ask: ${previewCost.toFixed(2)} ({qtyNum} × $
          {ask?.toFixed(2)} × 100)
        </p>
      )}

      <div className="flex justify-between gap-2 pt-2">
        <Button type="button" variant="ghost" size="sm" onClick={() => setStep("chain")}>
          Back
        </Button>
        <div className="flex gap-2">
          <Button type="button" variant="outline" onClick={onCancel}>
            Cancel
          </Button>
          <Button type="submit" disabled={loading}>
            {loading ? "Adding..." : "Add Option"}
          </Button>
        </div>
      </div>
    </form>
  );
}
