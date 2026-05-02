"use client";

import { useRef, useState, useEffect } from "react";
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
import { registerSwipeRow, closeOtherSwipeRows } from "@/lib/swipe-row-registry";
import type { SerializedHolding } from "@/lib/types";

const HIDDEN = "***";
const ACTION_WIDTH = 72;
const REVEAL_WIDTH = ACTION_WIDTH * 2;
const SNAP_THRESHOLD = REVEAL_WIDTH * 0.4;
const FULL_SWIPE = REVEAL_WIDTH + 80; // past this → delete on release

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
  const hasFiredDangerHaptic = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    function close() {
      animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
      setIsOpen(false);
      hasFiredHaptic.current = false;
      hasFiredDangerHaptic.current = false;
    }
    closeRef.current = close;
    return registerSwipeRow(close);
  }, [x]);

  // Reveal opacity: fades in as row slides open
  const actionsOpacity = useTransform(x, [-REVEAL_WIDTH * 0.5, 0], [1, 0], { clamp: true });
  // Icon scale: pops from 65% → 100% as row reveals
  const iconScale = useTransform(x, [0, -REVEAL_WIDTH], [0.65, 1.0], { clamp: true });
  // Edit button shrinks away in the danger zone
  const editOpacity = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [1, 0], { clamp: true });
  const editWidth = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [ACTION_WIDTH, 0], { clamp: true });
  // Delete icon grows in the danger zone
  const deleteIconScale = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [1.0, 1.3], { clamp: true });
  // Red edge tint on the row itself
  const dangerOpacity = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [0, 1], { clamp: true });

  function snapOpen() {
    closeOtherSwipeRows(closeRef.current);
    animate(x, -REVEAL_WIDTH, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(true);
  }

  function snapClose() {
    animate(x, 0, { type: "spring", stiffness: 300, damping: 30 });
    setIsOpen(false);
    hasFiredHaptic.current = false;
    hasFiredDangerHaptic.current = false;
  }

  function handleDrag() {
    const cur = x.get();
    if (!hasFiredHaptic.current && cur < -SNAP_THRESHOLD) {
      hapticTick();
      hasFiredHaptic.current = true;
    } else if (hasFiredHaptic.current && cur > -SNAP_THRESHOLD) {
      hasFiredHaptic.current = false;
    }
    if (!hasFiredDangerHaptic.current && cur < -FULL_SWIPE) {
      hapticTick();
      hapticTick(); // double-tick signals danger zone
      hasFiredDangerHaptic.current = true;
    } else if (hasFiredDangerHaptic.current && cur > -FULL_SWIPE) {
      hasFiredDangerHaptic.current = false;
    }
  }

  function handleDragEnd() {
    const cur = x.get();
    if (cur < -FULL_SWIPE) {
      snapClose();
      hapticTick();
      onDelete(h.id);
    } else if (cur < -SNAP_THRESHOLD) {
      snapOpen();
      hapticTick();
    } else {
      snapClose();
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
        <motion.button
          className="flex items-center justify-center bg-blue-500 text-white text-xs font-medium overflow-hidden active:brightness-90 transition-[filter]"
          style={{ opacity: editOpacity, width: editWidth, minWidth: 0 }}
          onClick={() => { snapClose(); onEdit(h); }}
          aria-label={t("common.edit")}
        >
          <motion.div className="flex flex-col items-center gap-1" style={{ scale: iconScale }}>
            <Pencil className="h-4 w-4" />
            <span>{t("common.edit")}</span>
          </motion.div>
        </motion.button>
        <button
          className="flex-1 flex items-center justify-center bg-destructive text-destructive-foreground text-xs font-medium active:brightness-90 transition-[filter]"
          onClick={() => { snapClose(); onDelete(h.id); }}
          aria-label={t("common.delete")}
        >
          <motion.div className="flex flex-col items-center gap-1" style={{ scale: deleteIconScale }}>
            <Trash2 className="h-4 w-4" />
            <span>{t("common.delete")}</span>
          </motion.div>
        </button>
      </motion.div>

      {/* Draggable row */}
      <motion.div
        className="flex items-center gap-3 px-4 py-3.5 bg-card hover:bg-muted/40 active:bg-muted/60 transition-colors relative z-10"
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: -(FULL_SWIPE + 60), right: 0 }}
        dragElastic={{ left: 0.12, right: 0.15 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={() => { if (isOpen) snapClose(); }}
      >
        {/* Danger-zone red tint bleeds in from the right edge */}
        <motion.div
          className="absolute inset-y-0 right-0 w-28 pointer-events-none rounded-r-none"
          style={{
            opacity: dangerOpacity,
            background: "linear-gradient(to left, oklch(0.55 0.22 27 / 0.35), transparent)",
          }}
        />

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
