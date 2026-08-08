export type DemoAnnouncementThreshold = "oneHour" | "tenMinutes" | "expired";

export function demoAnnouncementThreshold(remainingMs: number): DemoAnnouncementThreshold | null {
  if (remainingMs <= 0) return "expired";
  if (remainingMs <= 10 * 60 * 1000) return "tenMinutes";
  if (remainingMs <= 60 * 60 * 1000) return "oneHour";
  return null;
}
