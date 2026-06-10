"use client";

import { useRef, useState, useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { hapticTick } from "@/lib/haptics";
import { registerSwipeRow, closeOtherSwipeRows } from "@/lib/swipe-row-registry";
import { springConfig } from "@/lib/motion";
import { LucideIcon } from "lucide-react";

const REVEAL_WIDTH = 144;
const SNAP_THRESHOLD = REVEAL_WIDTH * 0.4;
const FULL_SWIPE = REVEAL_WIDTH + 80;
const ACTION_WIDTH = 60;

export interface SwipeAction {
  label: string;
  icon: LucideIcon;
  color: string;
  onClick: () => void;
}

interface SwipeableRowProps {
  children: React.ReactNode;
  actions: SwipeAction[];
  onFullSwipe?: () => void;
  className?: string;
}

export function SwipeableRow({
  children,
  actions,
  onFullSwipe,
  className = "",
}: SwipeableRowProps) {
  const x = useMotionValue(0);
  const hasFiredHaptic = useRef(false);
  const hasFiredDangerHaptic = useRef(false);
  const [isOpen, setIsOpen] = useState(false);
  const closeRef = useRef<() => void>(() => {});

  useEffect(() => {
    function close() {
      animate(x, 0, springConfig);
      setIsOpen(false);
      hasFiredHaptic.current = false;
      hasFiredDangerHaptic.current = false;
    }
    closeRef.current = close;
    return registerSwipeRow(close);
  }, [x]);

  const actionsOpacity = useTransform(x, [-REVEAL_WIDTH * 0.5, 0], [1, 0], { clamp: true });
  const iconScale = useTransform(x, [0, -REVEAL_WIDTH], [0.65, 1.0], { clamp: true });

  // Specific transforms for when we have exactly 2 actions (edit/delete pattern)
  const editOpacity = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [1, 0], { clamp: true });
  const editWidth = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [ACTION_WIDTH, 0], {
    clamp: true,
  });
  const deleteIconScale = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [1.0, 1.3], {
    clamp: true,
  });
  const dangerOpacity = useTransform(x, [-REVEAL_WIDTH, -FULL_SWIPE], [0, 1], { clamp: true });

  function snapOpen() {
    closeOtherSwipeRows(closeRef.current);
    animate(x, -REVEAL_WIDTH, springConfig);
    setIsOpen(true);
  }

  function snapClose() {
    animate(x, 0, springConfig);
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
    if (onFullSwipe) {
      if (!hasFiredDangerHaptic.current && cur < -FULL_SWIPE) {
        hapticTick();
        hapticTick(); // double-tick signals danger zone
        hasFiredDangerHaptic.current = true;
      } else if (hasFiredDangerHaptic.current && cur > -FULL_SWIPE) {
        hasFiredDangerHaptic.current = false;
      }
    }
  }

  function handleDragEnd() {
    const cur = x.get();
    if (onFullSwipe && cur < -FULL_SWIPE) {
      snapClose();
      hapticTick();
      onFullSwipe();
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
        className="absolute inset-y-0 right-0 flex gap-2 px-2"
        style={{ opacity: actionsOpacity, width: REVEAL_WIDTH }}
        aria-hidden="true"
      >
        {actions.map((action, idx) => {
          const isFirstOfTwo = actions.length === 2 && idx === 0;
          const isLastOfTwo = actions.length === 2 && idx === 1;

          const buttonStyle = isFirstOfTwo
            ? { opacity: editOpacity, width: editWidth, minWidth: 0 }
            : {};

          const innerStyle = isLastOfTwo ? { scale: deleteIconScale } : { scale: iconScale };

          return (
            <motion.button
              key={idx}
              className={`flex items-center justify-center ${action.color} text-white text-xs font-medium overflow-hidden rounded-2xl my-1.5 active:brightness-90 transition-[filter] ${!isFirstOfTwo ? "flex-1" : ""}`}
              style={buttonStyle}
              onClick={() => {
                snapClose();
                action.onClick();
              }}
              aria-label={action.label}
            >
              <motion.div className="flex flex-col items-center gap-1" style={innerStyle}>
                <action.icon className="h-4 w-4" />
                <span>{action.label}</span>
              </motion.div>
            </motion.button>
          );
        })}
      </motion.div>

      {/* Draggable row */}
      <motion.div
        className={className}
        style={{ x }}
        drag="x"
        dragDirectionLock
        dragConstraints={{ left: onFullSwipe ? -(FULL_SWIPE + 60) : -REVEAL_WIDTH, right: 0 }}
        dragElastic={{ left: 0.12, right: 0.15 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={() => {
          if (isOpen) snapClose();
        }}
      >
        {/* Danger-zone red tint bleeds in from the right edge */}
        {onFullSwipe && (
          <motion.div
            className="absolute inset-y-0 right-0 w-28 pointer-events-none rounded-r-none"
            style={{
              opacity: dangerOpacity,
              background: "linear-gradient(to left, oklch(0.55 0.22 27 / 0.35), transparent)",
            }}
          />
        )}
        {children}
      </motion.div>
    </div>
  );
}
