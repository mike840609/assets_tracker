"use client";

import { Analytics } from "@vercel/analytics/next";
import { hasConsent } from "@/lib/consent";

export function CustomAnalytics() {
  return (
    <Analytics
      beforeSend={(event) => {
        if (!hasConsent()) return null;
        if (event.url.includes("/login") || event.url.includes("/privacy")) {
          return null;
        }
        return event;
      }}
    />
  );
}
