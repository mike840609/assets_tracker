export type SafariPwaHintEnvironment = {
  userAgent: string;
  platform: string;
  maxTouchPoints: number;
  isStandalone: boolean;
  hasBeenShown: boolean;
};

const IOS_BROWSER_TOKENS = ["CriOS", "FxiOS", "EdgiOS", "OPiOS", "Brave"] as const;

export async function copyPageUrl(
  writeText: ((text: string) => Promise<void>) | undefined,
  href: string,
): Promise<boolean> {
  if (!writeText) return false;

  try {
    await writeText(href);
    return true;
  } catch {
    return false;
  }
}

export type PublishUntilRenderedOptions = {
  publish: () => void;
  hasRendered: () => boolean;
  onRendered: () => void;
  isCancelled: () => boolean;
  maxAttempts?: number;
  delayMs?: number;
};

/**
 * Sonner publishes a toast only to the subscribers mounted at that instant and
 * never replays it, while the app's <Toaster> is a dynamic() import that can
 * subscribe after this hint's mount effect runs — so the toast is silently
 * dropped. Re-publishing under the same toast id is idempotent, so republish
 * until the toast is really in the DOM, and let the caller persist its
 * "already shown" flag only once that is confirmed.
 */
export function publishUntilRendered({
  publish,
  hasRendered,
  onRendered,
  isCancelled,
  maxAttempts = 20,
  delayMs = 100,
}: PublishUntilRenderedOptions): void {
  const attempt = (remaining: number) => {
    if (isCancelled()) return;
    publish();

    // The toast lands on React's next render, not synchronously, so check later.
    setTimeout(() => {
      if (isCancelled()) return;
      if (hasRendered()) onRendered();
      else if (remaining > 0) attempt(remaining - 1);
    }, delayMs);
  };

  attempt(maxAttempts);
}

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
