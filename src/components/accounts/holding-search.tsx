"use client";

import { useState, useRef, useEffect, useCallback, useId } from "react";
import { useTranslations } from "next-intl";
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
  allowedTypes?: string[];
}

export function HoldingSearch({
  onSelect,
  label,
  placeholder,
  autoFocus = false,
  allowedTypes,
}: HoldingSearchProps) {
  const t = useTranslations("holdingSearch");
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<SearchResult[]>([]);
  const [searching, setSearching] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [activeIndex, setActiveIndex] = useState(-1);

  const containerRef = useRef<HTMLDivElement>(null);
  const optionRefs = useRef<(HTMLLIElement | null)[]>([]);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>(null);
  const abortRef = useRef<AbortController | null>(null);

  // Stable ids so the input (combobox) can point at its listbox and active
  // option, and the visible label binds to the input.
  const baseId = useId();
  const inputId = `${baseId}-input`;
  const listboxId = `${baseId}-listbox`;
  const statusId = `${baseId}-status`;
  const optionId = (i: number) => `${baseId}-opt-${i}`;
  const activeOptionId = activeIndex >= 0 ? optionId(activeIndex) : undefined;

  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setShowResults(false);
        setActiveIndex(-1);
      }
    }
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, []);

  // Keep the active option scrolled into view during keyboard navigation.
  useEffect(() => {
    if (activeIndex >= 0) optionRefs.current[activeIndex]?.scrollIntoView({ block: "nearest" });
  }, [activeIndex]);

  // Abort any in-flight request on unmount so a late response can't touch an
  // unmounted component.
  useEffect(() => () => abortRef.current?.abort(), []);

  const searchTickers = useCallback(
    async (q: string) => {
      if (q.length < 1) {
        setResults([]);
        setShowResults(false);
        setError(null);
        setActiveIndex(-1);
        return;
      }
      // Cancel the previous request so a slow earlier response can't overwrite a
      // newer one (stale-response race).
      abortRef.current?.abort();
      const controller = new AbortController();
      abortRef.current = controller;

      setSearching(true);
      setError(null);
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`, {
          signal: controller.signal,
        });
        if (!res.ok) {
          // Upstream failure (e.g. Yahoo down) — distinct from an empty result set.
          setResults([]);
          setActiveIndex(-1);
          setError(t("unavailable"));
          setShowResults(true);
          return;
        }
        const { data }: { data: SearchResult[] } = await res.json();
        const filtered = allowedTypes
          ? data.filter((result) => allowedTypes.includes(result.type))
          : data;
        setResults(filtered);
        setActiveIndex(-1);
        setShowResults(filtered.length > 0);
      } catch (err) {
        if (err instanceof DOMException && err.name === "AbortError") return;
        setResults([]);
        setActiveIndex(-1);
        setError(t("unavailable"));
        setShowResults(true);
      } finally {
        // Only the most recent request clears the spinner; aborted ones bail above.
        if (abortRef.current === controller) setSearching(false);
      }
    },
    [allowedTypes, t],
  );

  function handleQueryChange(value: string) {
    setQuery(value);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => searchTickers(value), 300);
  }

  function handleSelect(result: SearchResult) {
    setShowResults(false);
    setActiveIndex(-1);
    onSelect(result);
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        if (!showResults && results.length > 0) {
          setShowResults(true);
          return;
        }
        setActiveIndex((i) => Math.min(i + 1, results.length - 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIndex((i) => Math.max(i - 1, 0));
        break;
      case "Enter":
        if (showResults && activeIndex >= 0 && results[activeIndex]) {
          e.preventDefault();
          handleSelect(results[activeIndex]);
        }
        break;
      case "Escape":
        if (showResults) {
          e.preventDefault();
          setShowResults(false);
          setActiveIndex(-1);
        }
        break;
    }
  }

  // Single source of truth for what assistive tech announces via the live region.
  const statusMessage = searching
    ? t("searching")
    : error
      ? error
      : query.length >= 1 && !showResults
        ? t("noResults")
        : results.length > 0
          ? t("resultCount", { count: results.length })
          : "";

  const listboxOpen = showResults && (!!error || results.length > 0);

  return (
    <div ref={containerRef} className="relative">
      <div className="space-y-2">
        <Label htmlFor={inputId}>{label ?? t("searchLabel")}</Label>
        <div className="relative">
          <Input
            id={inputId}
            value={query}
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={placeholder ?? t("placeholder")}
            autoFocus={autoFocus}
            role="combobox"
            aria-expanded={listboxOpen}
            aria-controls={listboxOpen ? listboxId : undefined}
            aria-activedescendant={activeOptionId}
            aria-autocomplete="list"
            aria-describedby={statusId}
            aria-busy={searching}
            autoComplete="off"
            spellCheck={false}
          />
          {searching && (
            <div
              className="absolute right-3 top-1/2 -translate-y-1/2 motion-reduce:hidden"
              aria-hidden="true"
            >
              <div className="h-4 w-4 animate-spin rounded-full border-2 border-muted-foreground border-t-transparent" />
            </div>
          )}
        </div>
      </div>

      {/* Polite live region: announces searching / count / no matches / errors
          to screen readers without stealing focus from the input. */}
      <p id={statusId} className="sr-only" role="status" aria-live="polite">
        {statusMessage}
      </p>

      {listboxOpen && (
        <ul
          id={listboxId}
          role="listbox"
          aria-label={label}
          className="absolute z-50 w-full mt-1 rounded-lg border bg-popover shadow-lg max-h-72 overflow-y-auto"
        >
          {error ? (
            <li className="px-3 py-2.5 text-sm text-destructive" role="alert">
              {error}
            </li>
          ) : (
            results.map((r, i) => (
              <li
                key={r.symbol}
                ref={(el) => {
                  optionRefs.current[i] = el;
                }}
                id={optionId(i)}
                role="option"
                aria-selected={i === activeIndex}
                onMouseEnter={() => setActiveIndex(i)}
                onClick={() => handleSelect(r)}
                className={`flex min-h-11 cursor-pointer items-center gap-3 px-3 py-2.5 text-left transition-colors first:rounded-t-lg last:rounded-b-lg ${
                  i === activeIndex ? "bg-accent" : ""
                }`}
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <span className="font-mono font-semibold text-sm">{r.symbol}</span>
                    <Badge variant="secondary" className="text-[10px] px-1.5 py-0">
                      {t.has(`assetType.${r.type}` as Parameters<typeof t.has>[0])
                        ? t(`assetType.${r.type}` as Parameters<typeof t>[0])
                        : r.type}
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
              </li>
            ))
          )}
        </ul>
      )}
    </div>
  );
}
