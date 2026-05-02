export function softHapticTick(duration = 10): void {
  if (typeof navigator === "undefined" || typeof navigator.vibrate !== "function") return;
  navigator.vibrate(duration);
}
