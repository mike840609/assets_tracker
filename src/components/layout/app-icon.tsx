const APP_ICON_APP_RADIUS = 9;
export const APP_ICON_FAVICON_RADIUS = 6;
export const APP_ICON_FALLBACK_START = "#34d399";
export const APP_ICON_FALLBACK_END = "#065f46";

const APP_ICON_CHART_PATH = "M8 20 L13.5 13.5 L17.5 17.5 L24 10";
const APP_ICON_ARROW_PATH = "M20 10 L24 10 L24 14";

function escapeSvgAttribute(value: string) {
  return value.replace(/&/g, "&amp;").replace(/"/g, "&quot;").replace(/</g, "&lt;");
}

export function createAppIconSvg({
  start = APP_ICON_FALLBACK_START,
  end = APP_ICON_FALLBACK_END,
  radius = APP_ICON_FAVICON_RADIUS,
}: {
  start?: string;
  end?: string;
  radius?: number;
}) {
  const startColor = escapeSvgAttribute(start.trim() || APP_ICON_FALLBACK_START);
  const endColor = escapeSvgAttribute(end.trim() || APP_ICON_FALLBACK_END);

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${startColor}"/><stop offset="100%" stop-color="${endColor}"/></linearGradient></defs><rect width="32" height="32" rx="${radius}" fill="url(#g)"/><path d="${APP_ICON_CHART_PATH}" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/><path d="${APP_ICON_ARROW_PATH}" stroke="white" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
}

export function AppIcon({
  className,
  gradientId,
  radius = APP_ICON_APP_RADIUS,
}: {
  className?: string;
  gradientId: string;
  radius?: number;
}) {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 32 32"
      fill="none"
      aria-hidden="true"
      focusable="false"
      className={className}
    >
      <defs>
        <linearGradient id={gradientId} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0%" style={{ stopColor: "var(--app-icon-gradient-start)" }} />
          <stop offset="100%" style={{ stopColor: "var(--app-icon-gradient-end)" }} />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={radius} fill={`url(#${gradientId})`} />
      <path
        d={APP_ICON_CHART_PATH}
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={APP_ICON_ARROW_PATH}
        stroke="white"
        strokeWidth="2.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
