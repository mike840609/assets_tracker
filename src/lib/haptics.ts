export function haptic(ms = 10): void {
  if (typeof window === "undefined") return;
  navigator.vibrate?.(ms);
}
