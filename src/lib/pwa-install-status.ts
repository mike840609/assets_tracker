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

  // Desktop and iOS are covered elsewhere; only Android gets the install toast.
  return /Android/i.test(userAgent);
}
