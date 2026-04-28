import type { MetadataRoute } from "next";

export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "Assets Tracker",
    short_name: "Assets",
    description: "Track your net worth, assets, and investments",
    start_url: "/",
    display: "standalone",
    orientation: "portrait",
    background_color: "#0d1f1e",
    theme_color: "#0d1f1e",
    icons: [
      {
        src: "/icon.svg",
        sizes: "any",
        type: "image/svg+xml",
        purpose: "any",
      },
      {
        src: "/apple-icon.png",
        sizes: "180x180",
        type: "image/png",
        purpose: "any",
      },
    ],
  };
}
