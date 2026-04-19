"use client";

import { SpeedInsights } from "@vercel/speed-insights/next";

export function CustomSpeedInsights() {
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
