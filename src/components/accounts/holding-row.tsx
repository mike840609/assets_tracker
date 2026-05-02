"use client";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal } from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/currencies";
import { getOptionDisplay } from "@/lib/options";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import type { SerializedHolding } from "@/lib/types";

const HIDDEN = "***";

export interface HoldingWithPrice extends SerializedHolding {
  currentPrice: number | null;
  marketValue: number | null;
}

interface HoldingRowProps {
  holding: HoldingWithPrice;
  totalValue: number;
  accountCurrency: string;
  onEdit: (holding: HoldingWithPrice) => void;
  onDelete: (holdingId: string) => void;
}

export function HoldingRow({ holding: h, totalValue, accountCurrency, onEdit, onDelete }: HoldingRowProps) {
  const t = useTranslations();
  const { privacyMode } = usePrivacyMode();
  const optionDisplay = getOptionDisplay(h);
  const symbolLabel = optionDisplay ? optionDisplay.short : h.symbol;
  const nameLabel = optionDisplay ? optionDisplay.long : h.name;
  const isOption = h.assetType === "OPTION";

  return (
    <div className="flex items-center gap-3 px-4 py-3.5 hover:bg-muted/40 active:bg-muted/60 transition-colors group">
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5 flex-wrap">
          <span
            className="font-mono font-semibold text-sm"
            title={isOption ? optionDisplay?.occ : undefined}
          >
            {symbolLabel}
          </span>
          <Badge variant="secondary" className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
            {h.assetType}
          </Badge>
          <Badge variant="outline" className="text-[10px] px-1.5 py-0 h-4 rounded-sm">
            {h.currency || "USD"}
          </Badge>
        </div>
        <p className="text-xs text-muted-foreground mt-0.5 truncate">{nameLabel}</p>
        <p className="text-xs text-muted-foreground/70 mt-0.5 tabular-nums">
          {formatQuantity(h.quantity, h.assetType)}
          {isOption && <span className="ml-1">contracts</span>}
          {!privacyMode && h.currentPrice !== null && (
            <span className="ml-2">
              @ {formatCurrency(h.currentPrice, h.currency || "USD")}
              {isOption && <span>/share</span>}
            </span>
          )}
        </p>
      </div>
      <div className="text-right shrink-0">
        <p className="text-sm font-medium tabular-nums">
          {privacyMode
            ? HIDDEN
            : h.marketValue !== null
              ? formatCurrency(h.marketValue, accountCurrency)
              : "—"}
        </p>
        <p className="text-xs text-muted-foreground tabular-nums mt-0.5">
          {privacyMode
            ? "—"
            : h.marketValue !== null && totalValue > 0
              ? `${((h.marketValue / totalValue) * 100).toFixed(1)}%`
              : "—"}
        </p>
      </div>
      <DropdownMenu>
        <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md h-7 w-7 text-muted-foreground hover:bg-accent hover:text-accent-foreground shrink-0">
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
    </div>
  );
}
