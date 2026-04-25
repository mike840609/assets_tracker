"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";
import { hasConsent } from "@/lib/consent";

export function CustomSpeedInsights() {
  return (
    <SpeedInsights
      beforeSend={(data) => {
        if (!hasConsent()) return null;
        if (data.url.includes("/login") || data.url.includes("/privacy")) {
          return null;
        }
        return data;
      }}
    />
  );
}
