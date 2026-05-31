export const APP_ICON_APP_RADIUS = 9;
export const APP_ICON_FAVICON_RADIUS = 6;
export const APP_ICON_FALLBACK_START = "#34d399";
export const APP_ICON_FALLBACK_END = "#065f46";

const APP_ICON_LEDGER_PATH = "M9 9.5 H15";
const APP_ICON_BALANCE_PATH = "M9 14 H13";
const APP_ICON_SPARK_PATH = "M9 22 L13.25 17.25 L17 19.75 L23 11.25";
const APP_ICON_ARROW_PATH = "M19.25 11.25 H23 V15";

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

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 32 32" fill="none"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0%" stop-color="${startColor}"/><stop offset="100%" stop-color="${endColor}"/></linearGradient><linearGradient id="shine" x1="7" y1="2" x2="25" y2="28" gradientUnits="userSpaceOnUse"><stop offset="0%" stop-color="white" stop-opacity=".3"/><stop offset="44%" stop-color="white" stop-opacity=".08"/><stop offset="100%" stop-color="white" stop-opacity="0"/></linearGradient></defs><rect width="32" height="32" rx="${radius}" fill="url(#g)"/><rect x="1.25" y="1.25" width="29.5" height="29.5" rx="${Math.max(radius - 1, 0)}" fill="none" stroke="url(#shine)" stroke-width="1.5"/><path d="${APP_ICON_LEDGER_PATH}" stroke="white" stroke-opacity=".64" stroke-width="2.25" stroke-linecap="round"/><path d="${APP_ICON_BALANCE_PATH}" stroke="white" stroke-opacity=".42" stroke-width="2.25" stroke-linecap="round"/><path d="${APP_ICON_SPARK_PATH}" stroke="white" stroke-width="2.65" stroke-linecap="round" stroke-linejoin="round"/><path d="${APP_ICON_ARROW_PATH}" stroke="white" stroke-width="2.65" stroke-linecap="round" stroke-linejoin="round"/></svg>`;
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
  const shineId = `${gradientId}-shine`;

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
        <linearGradient id={shineId} x1="7" y1="2" x2="25" y2="28" gradientUnits="userSpaceOnUse">
          <stop offset="0%" stopColor="white" stopOpacity=".3" />
          <stop offset="44%" stopColor="white" stopOpacity=".08" />
          <stop offset="100%" stopColor="white" stopOpacity="0" />
        </linearGradient>
      </defs>
      <rect width="32" height="32" rx={radius} fill={`url(#${gradientId})`} />
      <rect
        x="1.25"
        y="1.25"
        width="29.5"
        height="29.5"
        rx={Math.max(radius - 1, 0)}
        fill="none"
        stroke={`url(#${shineId})`}
        strokeWidth="1.5"
      />
      <path
        d={APP_ICON_LEDGER_PATH}
        stroke="white"
        strokeOpacity=".64"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d={APP_ICON_BALANCE_PATH}
        stroke="white"
        strokeOpacity=".42"
        strokeWidth="2.25"
        strokeLinecap="round"
      />
      <path
        d={APP_ICON_SPARK_PATH}
        stroke="white"
        strokeWidth="2.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d={APP_ICON_ARROW_PATH}
        stroke="white"
        strokeWidth="2.65"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  );
}
