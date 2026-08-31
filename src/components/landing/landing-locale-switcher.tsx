"use client";

import type { Locale } from "@/i18n/config";

const LOCALE_COOKIE_MAX_AGE_SECONDS = 60 * 60 * 24 * 365;

type LandingLocaleSwitcherProps = {
  locale: Locale;
  label: string;
  englishLabel: string;
  traditionalChineseLabel: string;
};

function persistLocale(locale: Locale): void {
  document.cookie = [
    `NEXT_LOCALE=${encodeURIComponent(locale)}`,
    "Path=/",
    `Max-Age=${LOCALE_COOKIE_MAX_AGE_SECONDS}`,
    "SameSite=Lax",
  ].join("; ");
  window.location.assign(
    `${window.location.pathname}${window.location.search}${window.location.hash}`,
  );
}

export function LandingLocaleSwitcher({
  locale,
  label,
  englishLabel,
  traditionalChineseLabel,
}: LandingLocaleSwitcherProps) {
  const options: Array<{ value: Locale; shortLabel: string; accessibleLabel: string }> = [
    { value: "en-US", shortLabel: "EN", accessibleLabel: englishLabel },
    { value: "zh-TW", shortLabel: "繁中", accessibleLabel: traditionalChineseLabel },
  ];

  return (
    <div
      role="group"
      aria-label={label}
      className="flex items-center gap-0.5 rounded-lg border border-border/50 bg-muted/30 p-0.5"
    >
      {options.map(({ value, shortLabel, accessibleLabel }) => {
        const isActive = locale === value;

        return (
          <button
            key={value}
            type="button"
            aria-label={accessibleLabel}
            aria-pressed={isActive}
            title={accessibleLabel}
            onClick={() => {
              if (!isActive) persistLocale(value);
            }}
            className={`flex h-11 min-w-11 items-center justify-center rounded-md px-2 text-xs font-semibold transition-colors focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-ring/50 md:h-8 md:min-w-0 ${
              isActive
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:bg-secondary hover:text-foreground"
            }`}
          >
            <span lang={value === "zh-TW" ? "zh-TW" : "en"}>{shortLabel}</span>
          </button>
        );
      })}
    </div>
  );
}
