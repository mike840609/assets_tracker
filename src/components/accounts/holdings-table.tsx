"use client";

import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Badge } from "@/components/ui/badge";
import { AllocationBar } from "./allocation-bar";
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
  label: string;
  align: "left" | "right";
  className?: string;
}

const COLUMNS: Column[] = [
  { field: "symbol", label: "Symbol", align: "left" },
  { field: "name", label: "Name", align: "left" },
  { field: "assetType", label: "Type", align: "left", className: "hidden lg:table-cell" },
  { field: "quantity", label: "Qty", align: "right", className: "hidden lg:table-cell" },
  { field: "currentPrice", label: "Price", align: "right" },
  { field: "marketValue", label: "Mkt Value", align: "right" },
  { field: "percentage", label: "Weight", align: "right" },
  { field: null, label: "", align: "right" },
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
            {COLUMNS.map((col, i) => (
              <th
                key={i}
                className={`px-3 py-2.5 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground whitespace-nowrap ${
                  col.align === "right" ? "text-right" : "text-left"
                } ${col.field ? "cursor-pointer select-none hover:text-foreground transition-colors" : ""} ${col.className ?? ""}`}
                onClick={col.field ? () => onSort(col.field!) : undefined}
              >
                {col.label}
                {col.field && sortField === col.field && (
                  <span className="ml-1">{sortDirection === "asc" ? "↑" : "↓"}</span>
                )}
              </th>
            ))}
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
                      <AllocationBar value={weight} label={`${weight.toFixed(1)}%`} />
                    )}
                  </div>
                </td>
                <td className={`px-2 ${tdPy} text-right`}>
                  <DropdownMenu>
                    <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity">
                      <MoreHorizontal className="h-4 w-4" />
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
