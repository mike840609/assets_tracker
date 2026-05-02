"use client";

import { useRef, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";
import { formatCurrency, formatQuantity } from "@/lib/currencies";
import { getOptionDisplay } from "@/lib/options";
import { useTranslations } from "next-intl";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";
import { hapticTick } from "@/lib/haptics";
import type { SerializedHolding } from "@/lib/types";

const HIDDEN = "***";
const ACTION_WIDTH = 72; // px per action button
const REVEAL_WIDTH = ACTION_WIDTH * 2;
const SNAP_THRESHOLD = REVEAL_WIDTH * 0.4;

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

  const x = useMotionValue(0);
  const hasFiredHaptic = useRef(false);
  const [isOpen, setIsOpen] = useState(false);

  const actionsOpacity = useTransform(x, [-REVEAL_WIDTH, -REVEAL_WIDTH * 0.25, 0], [1, 0.85, 0]);

  function snapOpen() {
    animate(x, -REVEAL_WIDTH, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(true);
  }

  function snapClose() {
    animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(false);
    hasFiredHaptic.current = false;
  }

  function handleDragEnd() {
    if (x.get() < -SNAP_THRESHOLD) {
      snapOpen();
      hapticTick();
    } else {
      snapClose();
    }
  }

  function handleDrag() {
    const currentX = x.get();
    if (!hasFiredHaptic.current && currentX < -SNAP_THRESHOLD) {
      hapticTick();
      hasFiredHaptic.current = true;
    } else if (hasFiredHaptic.current && currentX > -SNAP_THRESHOLD) {
      hasFiredHaptic.current = false;
    }
  }

  return (
    <div className="relative overflow-hidden bg-card select-none">
      {/* Action buttons revealed on left swipe */}
      <motion.div
        className="absolute inset-y-0 right-0 flex"
        style={{ opacity: actionsOpacity, width: REVEAL_WIDTH }}
        aria-hidden="true"
      >
        <button
          className="flex-1 flex flex-col items-center justify-center bg-blue-500 text-white text-xs font-medium gap-1 active:brightness-90 transition-[filter]"
          onClick={() => { snapClose(); onEdit(h); }}
          aria-label={t("common.edit")}
        >
          <Pencil className="h-4 w-4" />
          <span>{t("common.edit")}</span>
        </button>
        <button
          className="flex-1 flex flex-col items-center justify-center bg-destructive text-destructive-foreground text-xs font-medium gap-1 active:brightness-90 transition-[filter]"
          onClick={() => { snapClose(); onDelete(h.id); }}
          aria-label={t("common.delete")}
        >
          <Trash2 className="h-4 w-4" />
          <span>{t("common.delete")}</span>
        </button>
      </motion.div>

      {/* Draggable row content */}
      <motion.div
        className="flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors relative z-10"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -REVEAL_WIDTH, right: 0 }}
        dragElastic={{ left: 0.08, right: 0.15 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={() => { if (isOpen) snapClose(); }}
      >
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
        {/* Desktop fallback: three-dot menu */}
        <div className="hidden sm:block">
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
      </motion.div>
    </div>
  );
}
