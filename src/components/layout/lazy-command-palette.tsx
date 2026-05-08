"use client";

import dynamic from "next/dynamic";

const DesktopCommandPalette = dynamic(
  () =>
    import("@/components/layout/desktop-command-palette").then(
      (m) => m.DesktopCommandPalette,
    ),
  { ssr: false },
);

export function LazyCommandPalette() {
  return <DesktopCommandPalette />;
}
