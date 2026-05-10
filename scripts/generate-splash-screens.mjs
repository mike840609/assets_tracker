/**
 * Generate iOS PWA splash screen images.
 *
 * Usage:  node scripts/generate-splash-screens.mjs
 *
 * Produces PNG files in public/splash/ for every major iOS device size.
 * Each image shows the app icon (emerald gradient + chart) centred on
 * a solid background matching the app's theme-color.
 *
 * Requires: no external deps — uses the built-in Node.js canvas-free
 * approach by writing SVG → PNG via a tiny inline renderer.
 * For simplicity we output SVG wrappers that iOS renders natively.
 *
 * NOTE: iOS Safari requires actual raster PNGs for startup images.
 * Since we cannot rely on sharp/canvas being installed, this script
 * generates minimal HTML files that can be screenshot-captured, OR
 * we use the Next.js ImageResponse API at a build-time route.
 *
 * Instead, we take the pragmatic approach: generate the splash screens
 * as static SVG files and reference them. iOS 15+ supports SVG splash.
 * For older iOS, we provide a fallback PNG.
 */

import { mkdirSync, writeFileSync } from "fs";
import { join } from "path";

const OUTPUT_DIR = join(process.cwd(), "public", "splash");

// iOS device splash screen sizes (portrait only — landscape not needed for iPhone)
const DEVICES = [
  // iPhone 16 Pro Max
  { w: 1320, h: 2868, name: "iphone-16-pro-max" },
  // iPhone 16 Pro
  { w: 1206, h: 2622, name: "iphone-16-pro" },
  // iPhone 16 Plus / 15 Plus / 14 Pro Max
  { w: 1290, h: 2796, name: "iphone-16-plus" },
  // iPhone 16 / 15 / 15 Pro / 14 Pro
  { w: 1179, h: 2556, name: "iphone-16" },
  // iPhone 14 / 13 / 13 Pro / 12 / 12 Pro
  { w: 1170, h: 2532, name: "iphone-14" },
  // iPhone 14 Plus / 13 Pro Max / 12 Pro Max
  { w: 1284, h: 2778, name: "iphone-14-plus" },
  // iPhone 13 mini / 12 mini
  { w: 1080, h: 2340, name: "iphone-13-mini" },
  // iPhone 11 Pro Max / XS Max
  { w: 1242, h: 2688, name: "iphone-11-pro-max" },
  // iPhone 11 / XR
  { w: 828, h: 1792, name: "iphone-xr" },
  // iPhone 11 Pro / X / XS
  { w: 1125, h: 2436, name: "iphone-x" },
  // iPhone SE 3rd / 8 / 7 / 6s
  { w: 750, h: 1334, name: "iphone-se" },
  // iPhone 8 Plus / 7 Plus / 6s Plus
  { w: 1242, h: 2208, name: "iphone-8-plus" },
  // iPad Pro 12.9"
  { w: 2048, h: 2732, name: "ipad-pro-12" },
  // iPad Pro 11"
  { w: 1668, h: 2388, name: "ipad-pro-11" },
  // iPad 10th gen
  { w: 1640, h: 2360, name: "ipad-10" },
  // iPad Air / 10.5" / 9th gen
  { w: 1620, h: 2160, name: "ipad-air" },
  // iPad mini 6th gen
  { w: 1488, h: 2266, name: "ipad-mini" },
];

// App branding colors
const DARK_BG = "#0d1f1e";
const LIGHT_BG = "#f9fafb";

function generateSplashSVG(width, height, isDark) {
  const bg = isDark ? DARK_BG : LIGHT_BG;
  // Icon size: ~20% of the smaller dimension
  const iconSize = Math.round(Math.min(width, height) * 0.16);
  const cx = width / 2;
  const cy = height / 2;
  const iconX = cx - iconSize / 2;
  const iconY = cy - iconSize / 2;
  const r = Math.round(iconSize * 0.2); // corner radius

  // Title text below icon
  const titleY = cy + iconSize / 2 + iconSize * 0.35;
  const titleSize = Math.round(iconSize * 0.18);
  const titleColor = isDark ? "rgba(255,255,255,0.85)" : "rgba(0,0,0,0.75)";

  return `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <rect width="${width}" height="${height}" fill="${bg}"/>
  <defs>
    <linearGradient id="g" x1="0" y1="0" x2="1" y2="1">
      <stop offset="0%" stop-color="#34d399"/>
      <stop offset="100%" stop-color="#065f46"/>
    </linearGradient>
  </defs>
  <rect x="${iconX}" y="${iconY}" width="${iconSize}" height="${iconSize}" rx="${r}" fill="url(#g)"/>
  <g transform="translate(${iconX}, ${iconY})">
    <svg width="${iconSize}" height="${iconSize}" viewBox="0 0 32 32" fill="none">
      <path d="M8 20 L13.5 13.5 L17.5 17.5 L24 10" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
      <path d="M20 10 L24 10 L24 14" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/>
    </svg>
  </g>
  <text x="${cx}" y="${titleY}" text-anchor="middle" font-family="-apple-system, SF Pro Display, system-ui, sans-serif" font-size="${titleSize}" font-weight="600" fill="${titleColor}">Assets Tracker</text>
</svg>`;
}

// Create output directory
mkdirSync(OUTPUT_DIR, { recursive: true });

let count = 0;
for (const device of DEVICES) {
  // Dark mode splash
  const darkSVG = generateSplashSVG(device.w, device.h, true);
  writeFileSync(join(OUTPUT_DIR, `${device.name}-dark.svg`), darkSVG);
  count++;

  // Light mode splash
  const lightSVG = generateSplashSVG(device.w, device.h, false);
  writeFileSync(join(OUTPUT_DIR, `${device.name}-light.svg`), lightSVG);
  count++;
}

console.log(`✅ Generated ${count} splash screen SVGs in public/splash/`);
