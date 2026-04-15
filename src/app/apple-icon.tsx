import { ImageResponse } from "next/og";

export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(
    (
      <div
        style={{
          width: 180,
          height: 180,
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          background: "linear-gradient(135deg, #34d399 0%, #065f46 100%)",
          borderRadius: 36,
        }}
      >
        <svg width="110" height="110" viewBox="0 0 32 32" fill="none">
          <path
            d="M8 20 L13.5 13.5 L17.5 17.5 L24 10"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
          <path
            d="M20 10 L24 10 L24 14"
            stroke="white"
            stroke-width="2.5"
            stroke-linecap="round"
            stroke-linejoin="round"
          />
        </svg>
      </div>
    ),
    { width: 180, height: 180 },
  );
}
