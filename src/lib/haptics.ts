export function hapticTick() {
  if (typeof navigator !== "undefined") {
    navigator.vibrate?.(10);
  }
}
