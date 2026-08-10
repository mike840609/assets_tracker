export type StandaloneEnvironment = {
  displayModeStandalone: boolean;
  navigatorStandalone: boolean;
};

export type PwaInstallEligibility = {
  userAgent: string;
  isStandalone: boolean;
  wasDismissed: boolean;
  hasInstallPrompt: boolean;
};

export function isStandalonePwa({
  displayModeStandalone,
  navigatorStandalone,
}: StandaloneEnvironment): boolean {
  return displayModeStandalone || navigatorStandalone;
}

export function shouldOfferPwaInstall({
  userAgent,
  isStandalone,
  wasDismissed,
  hasInstallPrompt,
}: PwaInstallEligibility): boolean {
  if (!hasInstallPrompt || isStandalone || wasDismissed) return false;

  const isAndroid = /Android/i.test(userAgent);
  const isIOS = /iPhone|iPad|iPod/i.test(userAgent);

  return isAndroid && !isIOS;
}
