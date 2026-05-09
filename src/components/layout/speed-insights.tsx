"use client";

import { useEffect } from "react";
import { SpeedInsights } from "@vercel/speed-insights/next";
import { onLCP, onCLS, onINP } from "web-vitals";

const BUDGETS = { LCP: 2500, CLS: 0.1, INP: 200 } as const;

function postVital(name: string, value: number, rating: string) {
  if (typeof navigator === "undefined") return;
  navigator.sendBeacon(
    "/api/_metrics/vitals",
    JSON.stringify({ name, value, rating, url: window.location.pathname }),
  );
}

export function CustomSpeedInsights() {
  useEffect(() => {
    onLCP((m) => { if (m.value > BUDGETS.LCP) postVital("LCP", m.value, m.rating); });
    onCLS((m) => { if (m.value > BUDGETS.CLS) postVital("CLS", m.value, m.rating); });
    onINP((m) => { if (m.value > BUDGETS.INP) postVital("INP", m.value, m.rating); });
  }, []);

  return (
    <SpeedInsights
      beforeSend={(data) => {
        if (data.url.includes("/login") || data.url.includes("/privacy")) {
          return null;
        }
        return data;
      }}
    />
  );
}
