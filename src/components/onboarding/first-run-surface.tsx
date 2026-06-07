"use client";

import type { ReactNode } from "react";
import Link from "next/link";
import type { LucideIcon } from "lucide-react";
import { ArrowRight } from "lucide-react";
import { Button, buttonVariants } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type FirstRunAction = {
  label: string;
  href?: string;
  onClick?: () => void;
  icon?: LucideIcon;
};

type FirstRunStep = {
  title: string;
  description: string;
  icon: LucideIcon;
};

type FirstRunSurfaceProps = {
  eyebrow: string;
  title: string;
  description: string;
  primaryAction: FirstRunAction;
  preview: ReactNode;
  steps: FirstRunStep[];
  activeStepIndex?: number;
  aside: {
    title: string;
    description: string;
    progressLabel?: string;
    progressHint?: string;
  };
};

function ActionControl({
  action,
  className,
  showArrow = false,
}: {
  action: FirstRunAction;
  className?: string;
  showArrow?: boolean;
}) {
  const Icon = action.icon;
  const content = (
    <>
      {Icon && <Icon className="h-4 w-4" aria-hidden="true" />}
      {action.label}
      {showArrow && <ArrowRight className="h-4 w-4" aria-hidden="true" />}
    </>
  );

  if (action.href) {
    return (
      <Link href={action.href} className={cn(buttonVariants(), className)}>
        {content}
      </Link>
    );
  }

  return (
    <Button type="button" onClick={action.onClick} className={className}>
      {content}
    </Button>
  );
}

export function FirstRunSurface({
  eyebrow,
  title,
  description,
  primaryAction,
  preview,
  steps,
  activeStepIndex = 0,
  aside,
}: FirstRunSurfaceProps) {
  const activeStep = Math.max(0, Math.min(activeStepIndex, steps.length - 1));

  return (
    <section className="mt-4 grid gap-3 sm:gap-4 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="relative overflow-hidden rounded-2xl bg-card text-card-foreground ring-1 ring-foreground/10">
        <div className="absolute inset-x-0 top-0 h-32 bg-[radial-gradient(ellipse_at_top,color-mix(in_oklch,var(--primary)_12%,transparent),transparent_68%)]" />
        <div className="relative flex min-h-full flex-col gap-4 p-4 sm:p-5">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="max-w-[58ch] space-y-2">
              <p className="text-sm font-medium text-primary">{eyebrow}</p>
              <div className="space-y-2">
                <h2 className="text-balance text-2xl font-bold leading-tight tracking-[-0.02em] text-foreground">
                  {title}
                </h2>
                <p className="text-pretty text-sm leading-6 text-muted-foreground sm:text-base">
                  {description}
                </p>
              </div>
            </div>
            <ActionControl action={primaryAction} className="w-full sm:w-auto" />
          </div>

          {preview}

          <div className="rounded-xl border border-primary/20 bg-primary/5 p-3 sm:p-4">
            <div className="grid gap-3 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-center">
              <div className="grid gap-2 sm:grid-cols-3">
                {steps.map((step, index) => {
                  const Icon = step.icon;

                  return (
                    <div
                      key={step.title}
                      className={cn(
                        "flex min-h-14 items-start gap-3 rounded-lg p-2.5",
                        index === activeStep
                          ? "bg-background shadow-sm ring-1 ring-foreground/10"
                          : "bg-transparent",
                      )}
                    >
                      <span
                        className={cn(
                          "flex h-8 w-8 shrink-0 items-center justify-center rounded-lg",
                          index === activeStep
                            ? "bg-primary text-primary-foreground"
                            : "bg-background text-muted-foreground ring-1 ring-foreground/10",
                        )}
                      >
                        <Icon className="h-4 w-4" aria-hidden="true" />
                      </span>
                      <span className="min-w-0 space-y-1">
                        <span className="flex items-center gap-2 text-sm font-semibold leading-tight text-foreground">
                          <span className="font-mono text-xs text-muted-foreground">
                            {index + 1}
                          </span>
                          {step.title}
                        </span>
                        <span className="block text-pretty text-xs leading-5 text-muted-foreground md:hidden 2xl:block">
                          {step.description}
                        </span>
                      </span>
                    </div>
                  );
                })}
              </div>
              <ActionControl
                action={primaryAction}
                showArrow
                className="w-full justify-between sm:justify-center lg:w-auto"
              />
            </div>
          </div>
        </div>
      </div>

      <aside className="rounded-2xl bg-card p-4 ring-1 ring-foreground/10 lg:p-5">
        <div className="flex h-full flex-col justify-between gap-8">
          <div className="space-y-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <ArrowRight className="h-5 w-5" aria-hidden="true" />
            </div>
            <div className="space-y-2">
              <h3 className="text-base font-semibold leading-snug text-foreground">
                {aside.title}
              </h3>
              <p className="text-pretty text-sm leading-6 text-muted-foreground">
                {aside.description}
              </p>
            </div>
          </div>
          {(aside.progressLabel || aside.progressHint) && (
            <div className="space-y-1.5 rounded-xl bg-muted/50 p-3 text-sm">
              {aside.progressLabel && (
                <p className="text-xs font-medium text-primary">{aside.progressLabel}</p>
              )}
              {aside.progressHint && (
                <p className="text-xs leading-5 text-muted-foreground">{aside.progressHint}</p>
              )}
            </div>
          )}
        </div>
      </aside>
    </section>
  );
}
