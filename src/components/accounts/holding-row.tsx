"use client";

import { TableCell, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { formatCurrency, formatQuantity } from "@/lib/currencies";
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
  return (
    <TableRow key={h.id}>
      <TableCell className="font-mono font-medium">{h.symbol}</TableCell>
      <TableCell>{h.name}</TableCell>
      <TableCell>
        <Badge variant="secondary">{h.assetType}</Badge>
      </TableCell>
      <TableCell>
        <Badge variant="outline">{h.currency || "USD"}</Badge>
      </TableCell>
      <TableCell className="text-right">
        {formatQuantity(h.quantity, h.assetType)}
      </TableCell>
      <TableCell className="text-right">
        {privacyMode ? HIDDEN : h.currentPrice !== null
          ? formatCurrency(h.currentPrice, h.currency || "USD")
          : "—"}
      </TableCell>
      <TableCell className="text-right font-medium">
        {privacyMode ? HIDDEN : h.marketValue !== null
          ? formatCurrency(h.marketValue, accountCurrency)
          : "—"}
      </TableCell>
      <TableCell className="text-right text-muted-foreground">
        {privacyMode ? "—" : h.marketValue !== null && totalValue > 0
          ? `${((h.marketValue / totalValue) * 100).toFixed(1)}%`
          : "—"}
      </TableCell>
      <TableCell>
        <DropdownMenu>
          <DropdownMenuTrigger className="inline-flex items-center justify-center rounded-md text-sm font-medium h-8 px-3 hover:bg-accent hover:text-accent-foreground">
            ...
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end">
            <DropdownMenuItem onClick={() => onEdit(h)}>
              {t("common.edit")}
            </DropdownMenuItem>
            <DropdownMenuItem
              className="text-destructive"
              onClick={() => onDelete(h.id)}
            >
              {t("common.delete")}
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </TableCell>
    </TableRow>
  );
}
