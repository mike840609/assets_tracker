export type SafariPwaHintEnvironment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  isStandalone: boolean;
  hasBeenShown: boolean;
};

const IOS_BROWSER_TOKENS = ["CriOS", "FxiOS", "EdgiOS", "OPiOS", "Brave"] as const;

export function shouldShowSafariPwaHint({
  userAgent,
  platform,
  maxTouchPoints,
  isStandalone,
  hasBeenShown,
}: SafariPwaHintEnvironment): boolean {
  if (isStandalone || hasBeenShown) return false;

  const isIOSDevice = /iPhone|iPad|iPod/.test(userAgent);
  const isIPadOSDesktopMode = platform === "MacIntel" && maxTouchPoints > 1;
  if (!isIOSDevice && !isIPadOSDesktopMode) return false;

  const isAlternativeIOSBrowser = IOS_BROWSER_TOKENS.some((token) => userAgent.includes(token));
  const isSafari = userAgent.includes("Safari") && !isAlternativeIOSBrowser;

  return !isSafari;
}
