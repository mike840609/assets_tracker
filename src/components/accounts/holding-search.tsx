"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";

export type SearchResult = {
  symbol: string;
  name: string;
  exchange: string;
  type: string;
  currency: string;
};

interface HoldingSearchProps {
  onSelect: (result: SearchResult) => void;
  label?: string;
  placeholder?: string;
  autoFocus?: boolean;
}

export function HoldingSearch({
  onSelect,
  label = "Search by name or ticker symbol",
  placeholder = "e.g. Apple, TSMC, 2330, BTC...",
  autoFocus = false,
}: HoldingSearchProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
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
      setError(null);
      return;
    }
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
      if (!res.ok) {
        // Upstream failure (e.g. Yahoo down) — distinct from an empty result set.
        setResults([]);
        setError("Search is temporarily unavailable. Please try again.");
        setShowResults(true);
        return;
      }
      const { data }: { data: SearchResult[] } = await res.json();
      setResults(data);
      setShowResults(data.length > 0);
    } catch {
      setResults([]);
      setError("Search is temporarily unavailable. Please try again.");
      setShowResults(true);
    } finally {
      setSearching(false);
    }
  }, []);

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTickers(value), 300);
  }

  function handleSelect(result: SearchResult) {
    setShowResults(false);
    onSelect(result);
  }

  return (
    <div ref={containerRef} className="relative">
      <div className="space-y-2">
        <Label>{label}</Label>
        <div className="relative">
          <Input
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            placeholder={placeholder}
            autoFocus={autoFocus}
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
          {error && (
            <p className="px-3 py-2.5 text-sm text-destructive" role="alert">
              {error}
            </p>
          )}
          {!error &&
            results.map((r) => (
              <button
                key={r.symbol}
                type="button"
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-accent text-left transition-colors first:rounded-t-lg last:rounded-b-lg"
                onClick={() => handleSelect(r)}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{r.symbol}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {r.type}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground truncate mt-0.5">{r.name}</p>
                </div>
                <div className="text-right shrink-0">
                  <Badge variant="outline" className="text-[10px] px-1.5 py-0">
                    {r.currency}
                  </Badge>
                  <p className="text-[10px] text-muted-foreground mt-0.5">{r.exchange}</p>
                </div>
              </button>
            ))}
        </div>
      )}
    </div>
  );
}
