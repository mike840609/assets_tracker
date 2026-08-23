const CLIENT_STORAGE_VERSION = 1;
const CLIENT_STORAGE_PREFIX = `asset-tracker:v${CLIENT_STORAGE_VERSION}`;

export type ClientStorageKey = Readonly<{
  current: string;
  legacy: string;
}>;

type StorageLike = {
  getItem(key: string): string | null;
  setItem(key: string, value: string): unknown;
  removeItem(key: string): unknown;
};

function key(name: string, legacy: string): ClientStorageKey {
  return { current: `${CLIENT_STORAGE_PREFIX}:${name}`, legacy };
}

/** App-owned Web Storage keys. Cookies and dependency-owned keys are separate. */
export const CLIENT_STORAGE_KEYS = {
  privacyMode: key("privacy-mode", "privacy-mode"),
  colorSchema: key("color-schema", "asset-tracker:color-schema"),
  sidebarCollapsed: key("sidebar-collapsed", "asset-tracker:sidebar-collapsed"),
  density: key("density", "asset-tracker:density"),
  projectionsGuideOpen: key("projections-guide-open", "asset-tracker:projections-guide-open"),
  pwaInstallPromptDismissed: key(
    "pwa-install-prompt-dismissed",
    "assets-tracker:pwa-install-prompt-dismissed",
  ),
  pwaSafariHintShown: key("pwa-safari-hint-shown", "assets-tracker:pwa-safari-hint-shown"),
  range: (name: string) => key(`range:${name}`, `asset-tracker:range:${name}`),
} as const;

export function readClientStorage<T extends string>(
  storage: StorageLike,
  storageKey: ClientStorageKey,
  allowed: readonly T[],
): T | null {
  try {
    const current = storage.getItem(storageKey.current);
    if (current !== null) return allowed.includes(current as T) ? (current as T) : null;

    const legacy = storage.getItem(storageKey.legacy);
    if (legacy === null || !allowed.includes(legacy as T)) return null;

    try {
      storage.setItem(storageKey.current, legacy);
      storage.removeItem(storageKey.legacy);
    } catch {
      // Keep the valid legacy value when migration cannot be persisted.
    }
    return legacy as T;
  } catch {
    return null;
  }
}

export function writeClientStorage(
  storage: StorageLike,
  storageKey: ClientStorageKey,
  value: string,
): void {
  try {
    storage.setItem(storageKey.current, value);
  } catch {
    // Client preferences are optional; storage failures must not break rendering.
  }
}
