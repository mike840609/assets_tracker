export function hasConsent(): boolean {
  if (typeof document === "undefined") return false;
  return document.cookie.split("; ").includes("cookie-consent=true");
}
