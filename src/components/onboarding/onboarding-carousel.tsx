"use client";

import { useCallback, useEffect, useState } from "react";
import { AnimatePresence, motion } from "framer-motion";
import type { LucideIcon } from "lucide-react";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { springConfig } from "@/lib/motion";
import { cn } from "@/lib/utils";

export interface OnboardingSlide {
  icon: LucideIcon;
  title: string;
  description: string;
}

interface OnboardingCarouselProps {
  slides: OnboardingSlide[];
  labels: { back: string; next: string; skip: string; done: string };
  onDone: () => void;
}

const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 300;

export function OnboardingCarousel({ slides, labels, onDone }: OnboardingCarouselProps) {
  const [[index, direction], setState] = useState<[number, number]>([0, 0]);
  const isLast = index === slides.length - 1;
  const isFirst = index === 0;

  const paginate = useCallback(
    (dir: number) => {
      setState(([cur]) => {
        const next = cur + dir;
        if (next < 0 || next >= slides.length) return [cur, dir];
        return [next, dir];
      });
    },
    [slides.length],
  );

  // Arrow-key navigation.
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      if (e.key === "ArrowRight") paginate(1);
      else if (e.key === "ArrowLeft") paginate(-1);
    }
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [paginate]);

  const slide = slides[index];
  const Icon = slide.icon;

  return (
    <div className="flex flex-col">
      {/* Slide viewport */}
      <div className="relative h-[230px] overflow-hidden px-6">
        <AnimatePresence initial={false} custom={direction} mode="popLayout">
          <motion.div
            key={index}
            custom={direction}
            variants={{
              enter: (dir: number) => ({ x: dir > 0 ? 240 : -240, opacity: 0 }),
              center: { x: 0, opacity: 1 },
              exit: (dir: number) => ({ x: dir > 0 ? -240 : 240, opacity: 0 }),
            }}
            initial="enter"
            animate="center"
            exit="exit"
            transition={springConfig}
            drag="x"
            dragConstraints={{ left: 0, right: 0 }}
            dragElastic={0.2}
            onDragEnd={(_, info) => {
              if (info.offset.x < -SWIPE_DISTANCE || info.velocity.x < -SWIPE_VELOCITY) {
                paginate(1);
              } else if (info.offset.x > SWIPE_DISTANCE || info.velocity.x > SWIPE_VELOCITY) {
                paginate(-1);
              }
            }}
            className="absolute inset-0 flex cursor-grab flex-col items-center justify-center gap-4 px-2 text-center active:cursor-grabbing"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/10 text-primary">
              <Icon className="h-8 w-8" aria-hidden="true" />
            </div>
            <h3 className="text-xl font-bold tracking-tight">{slide.title}</h3>
            <p className="max-w-sm text-sm text-muted-foreground">{slide.description}</p>
          </motion.div>
        </AnimatePresence>
      </div>

      {/* Dot indicators */}
      <div className="flex justify-center gap-2 py-4" role="tablist" aria-label="Onboarding slides">
        {slides.map((_, i) => (
          <button
            key={i}
            type="button"
            aria-label={`Go to slide ${i + 1}`}
            aria-selected={i === index}
            role="tab"
            onClick={() => setState(([cur]) => [i, i > cur ? 1 : -1])}
            className={cn(
              "h-2 rounded-full transition-all",
              i === index
                ? "w-6 bg-primary"
                : "w-2 bg-muted-foreground/30 hover:bg-muted-foreground/50",
            )}
          />
        ))}
      </div>

      {/* Controls */}
      <div className="flex items-center justify-between gap-2 px-6 pb-6">
        {isFirst ? (
          <Button variant="ghost" onClick={onDone} className="text-muted-foreground">
            {labels.skip}
          </Button>
        ) : (
          <Button variant="ghost" onClick={() => paginate(-1)}>
            <ChevronLeft className="h-4 w-4" />
            {labels.back}
          </Button>
        )}

        {isLast ? (
          <Button onClick={onDone}>{labels.done}</Button>
        ) : (
          <Button onClick={() => paginate(1)}>
            {labels.next}
            <ChevronRight className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
