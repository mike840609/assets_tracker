"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { MoreHorizontal } from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/currencies";
import { getOptionDisplay } from "@/lib/options";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { useDensity } from "@/components/layout/density-context";
import type { HoldingWithPrice } from "./holding-row";

const HIDDEN = "***";

export type HoldingSortField =
  | "symbol"
  | "name"
  | "assetType"
  | "currency"
  | "quantity"
  | "currentPrice"
  | "marketValue"
  | "percentage";

interface HoldingsTableProps {
  holdings: HoldingWithPrice[];
  totalValue: number;
  accountCurrency: string;
  sortField: HoldingSortField;
  sortDirection: "asc" | "desc";
  onSort: (field: HoldingSortField) => void;
  onEdit: (holding: HoldingWithPrice) => void;
  onDelete: (holdingId: string) => void;
}

interface Column {
  field: HoldingSortField | null;
  /** Key under the `accountDetail` i18n namespace; null for the actions column. */
  labelKey: string | null;
  align: "left" | "right";
  className?: string;
}

const COLUMNS: Column[] = [
  { field: "symbol", labelKey: "colSymbol", align: "left" },
  { field: "name", labelKey: "colName", align: "left" },
  { field: "assetType", labelKey: "colType", align: "left", className: "hidden lg:table-cell" },
  { field: "quantity", labelKey: "colQty", align: "right", className: "hidden lg:table-cell" },
  { field: "currentPrice", labelKey: "colPrice", align: "right" },
  { field: "marketValue", labelKey: "colValue", align: "right" },
  { field: "percentage", labelKey: "colPercentage", align: "right" },
  { field: null, labelKey: null, align: "right" },
];

export function HoldingsTable({
  holdings,
  totalValue,
  accountCurrency,
  sortField,
  sortDirection,
  onSort,
  onEdit,
  onDelete,
}: HoldingsTableProps) {
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const { density } = useDensity();
  const isCompact = density === "compact";
  const tdPy = isCompact ? "py-2" : "py-3";

  return (
    <div className="rounded-xl border border-border/40 overflow-hidden bg-card">
      <table className="w-full text-sm">
        <thead className="sticky top-0 bg-muted/70 backdrop-blur-sm border-b border-border/40">
          <tr>
            {COLUMNS.map((col, i) => {
              const isSorted = !!col.field && sortField === col.field;
              const label = col.labelKey ? t(`accountDetail.${col.labelKey}`) : "";
              return (
                <th
                  key={i}
                  scope="col"
                  aria-sort={
                    isSorted ? (sortDirection === "asc" ? "ascending" : "descending") : undefined
                  }
                  className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap ${
                    col.align === "right" ? "text-right" : "text-left"
                  } ${col.className ?? ""}`}
                >
                  {col.field ? (
                    <button
                      type="button"
                      onClick={() => onSort(col.field!)}
                      className={`inline-flex items-center gap-1 select-none rounded-sm transition-colors hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary ${
                        col.align === "right" ? "flex-row-reverse" : ""
                      } ${isSorted ? "text-foreground" : ""}`}
                    >
                      <span>{label}</span>
                      {isSorted && (
                        <span aria-hidden="true">{sortDirection === "asc" ? "↑" : "↓"}</span>
                      )}
                    </button>
                  ) : (
                    label
                  )}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody>
          {holdings.map((h, index) => {
            const optionDisplay = getOptionDisplay(h);
            const symbolLabel = optionDisplay ? optionDisplay.short : h.symbol;
            const nameLabel = optionDisplay ? optionDisplay.long : h.name;
            const weight =
              h.marketValue !== null && totalValue > 0 ? (h.marketValue / totalValue) * 100 : null;

            return (
              <tr
                key={h.id}
                className={`${index > 0 ? "border-t border-border/40" : ""} hover:bg-muted/40 transition-colors group`}
              >
                <td
                  className={`px-3 ${tdPy} font-mono font-semibold whitespace-nowrap`}
                  title={optionDisplay?.occ}
                >
                  {symbolLabel}
                </td>
                <td className={`px-3 ${tdPy} text-muted-foreground max-w-[200px] xl:max-w-[280px]`}>
                  <span className="truncate block">{nameLabel}</span>
                </td>
                <td className={`px-3 ${tdPy} hidden lg:table-cell`}>
                  <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
                    {h.assetType}
                  </Badge>
                </td>
                <td
                  className={`px-3 ${tdPy} text-right tabular-nums text-muted-foreground hidden lg:table-cell`}
                >
                  {privacyMode ? HIDDEN : formatQuantity(h.quantity, h.assetType)}
                </td>
                <td className={`px-3 ${tdPy} text-right tabular-nums text-muted-foreground`}>
                  {privacyMode
                    ? HIDDEN
                    : h.currentPrice !== null
                      ? formatCurrency(h.currentPrice, h.currency || "USD")
                      : "—"}
                </td>
                <td className={`px-3 ${tdPy} text-right tabular-nums font-medium`}>
                  {privacyMode
                    ? HIDDEN
                    : h.marketValue !== null
                      ? formatCurrency(h.marketValue, accountCurrency)
                      : "—"}
                </td>
                <td className={`px-3 ${tdPy} text-right`}>
                  <div className="flex flex-col items-end gap-1">
                    <span className="tabular-nums text-xs text-muted-foreground">
                      {privacyMode ? "—" : weight !== null ? `${weight.toFixed(1)}%` : "—"}
                    </span>
                    {!privacyMode && weight !== null && (
                      <div className="w-14 h-1 bg-muted rounded-full overflow-hidden">
                        <div
                          className="h-full bg-primary rounded-full"
                          style={{ width: `${Math.min(weight, 100)}%` }}
                        />
                      </div>
                    )}
                  </div>
                </td>
                <td className={`px-2 ${tdPy} text-right`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger
                      aria-label={t("common.actionsFor", { name: symbolLabel })}
                      className="inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:opacity-100"
                    >
                      <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem onClick={() => onEdit(h)}>
                        {t("common.edit")}
                      </DropdownMenuItem>
                      <DropdownMenuItem className="text-destructive" onClick={() => onDelete(h.id)}>
                        {t("common.delete")}
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
