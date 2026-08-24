import { describe, expect, it } from "vitest";
import {
  CLIENT_STORAGE_KEYS,
  readClientStorage,
  writeClientStorage,
  type ClientStorageKey,
} from "@/lib/client-storage";

function createStorage(initial: Record<string, string> = {}) {
  const values = new Map(Object.entries(initial));

  return {
    values,
    storage: {
      getItem: (key: string) => values.get(key) ?? null,
      setItem: (key: string, value: string) => values.set(key, value),
      removeItem: (key: string) => values.delete(key),
    },
  };
}

describe("client storage versioning", () => {
  it("uses the v1 namespace for every app-owned Web Storage key", () => {
    expect(CLIENT_STORAGE_KEYS.privacyMode.current).toBe("asset-tracker:v1:privacy-mode");
    expect(CLIENT_STORAGE_KEYS.colorSchema.current).toBe("asset-tracker:v1:color-schema");
    expect(CLIENT_STORAGE_KEYS.sidebarCollapsed.current).toBe("asset-tracker:v1:sidebar-collapsed");
    expect(CLIENT_STORAGE_KEYS.density.current).toBe("asset-tracker:v1:density");
    expect(CLIENT_STORAGE_KEYS.projectionsGuideOpen.current).toBe(
      "asset-tracker:v1:projections-guide-open",
    );
    expect(CLIENT_STORAGE_KEYS.pwaInstallPromptDismissed.current).toBe(
      "asset-tracker:v1:pwa-install-prompt-dismissed",
    );
    expect(CLIENT_STORAGE_KEYS.pwaSafariHintShown.current).toBe(
      "asset-tracker:v1:pwa-safari-hint-shown",
    );
    expect(CLIENT_STORAGE_KEYS.range("analysis-view").current).toBe(
      "asset-tracker:v1:range:analysis-view",
    );
  });

  it("reads and writes recognized current-version values", () => {
    const { storage, values } = createStorage();

    writeClientStorage(storage, CLIENT_STORAGE_KEYS.density, "compact");

    expect(
      readClientStorage(storage, CLIENT_STORAGE_KEYS.density, ["comfortable", "compact"]),
    ).toBe("compact");
    expect(values.get("asset-tracker:v1:density")).toBe("compact");
  });

  it("migrates every recognized legacy value and removes its legacy key", () => {
    const migrations: Array<{
      key: ClientStorageKey;
      legacy: string;
      value: string;
      allowed: readonly string[];
    }> = [
      {
        key: CLIENT_STORAGE_KEYS.privacyMode,
        legacy: "privacy-mode",
        value: "true",
        allowed: ["true", "false"],
      },
      {
        key: CLIENT_STORAGE_KEYS.colorSchema,
        legacy: "asset-tracker:color-schema",
        value: "ocean",
        allowed: ["emerald", "ocean"],
      },
      {
        key: CLIENT_STORAGE_KEYS.sidebarCollapsed,
        legacy: "asset-tracker:sidebar-collapsed",
        value: "1",
        allowed: ["1", "0"],
      },
      {
        key: CLIENT_STORAGE_KEYS.density,
        legacy: "asset-tracker:density",
        value: "compact",
        allowed: ["comfortable", "compact"],
      },
      {
        key: CLIENT_STORAGE_KEYS.projectionsGuideOpen,
        legacy: "asset-tracker:projections-guide-open",
        value: "1",
        allowed: ["1", "0"],
      },
      {
        key: CLIENT_STORAGE_KEYS.pwaInstallPromptDismissed,
        legacy: "assets-tracker:pwa-install-prompt-dismissed",
        value: "1",
        allowed: ["1"],
      },
      {
        key: CLIENT_STORAGE_KEYS.pwaSafariHintShown,
        legacy: "assets-tracker:pwa-safari-hint-shown",
        value: "1",
        allowed: ["1"],
      },
      {
        key: CLIENT_STORAGE_KEYS.range("analysis-view"),
        legacy: "asset-tracker:range:analysis-view",
        value: "All",
        allowed: ["YTD", "All"],
      },
    ];

    for (const migration of migrations) {
      const { storage, values } = createStorage({ [migration.legacy]: migration.value });

      expect(readClientStorage(storage, migration.key, migration.allowed)).toBe(migration.value);
      expect(values.get(migration.key.current)).toBe(migration.value);
      expect(values.has(migration.legacy)).toBe(false);
    }
  });

  it("ignores invalid current values without reviving legacy state", () => {
    const { storage, values } = createStorage({
      "asset-tracker:v1:density": "dense",
      "asset-tracker:density": "compact",
    });

    expect(
      readClientStorage(storage, CLIENT_STORAGE_KEYS.density, ["comfortable", "compact"]),
    ).toBeNull();
    expect(values.get("asset-tracker:density")).toBe("compact");
  });

  it("ignores invalid legacy values and unknown versions", () => {
    const { storage, values } = createStorage({
      "asset-tracker:density": "dense",
      "asset-tracker:v99:density": "compact",
    });

    expect(
      readClientStorage(storage, CLIENT_STORAGE_KEYS.density, ["comfortable", "compact"]),
    ).toBeNull();
    expect(values.has("asset-tracker:v1:density")).toBe(false);
    expect(values.get("asset-tracker:density")).toBe("dense");
  });

  it("falls back safely when storage reads or writes throw", () => {
    const inaccessible = {
      getItem: () => {
        throw new Error("storage disabled");
      },
      setItem: () => {
        throw new Error("storage disabled");
      },
      removeItem: () => {
        throw new Error("storage disabled");
      },
    };

    expect(
      readClientStorage(inaccessible, CLIENT_STORAGE_KEYS.privacyMode, ["true", "false"]),
    ).toBeNull();
    expect(() =>
      writeClientStorage(inaccessible, CLIENT_STORAGE_KEYS.privacyMode, "true"),
    ).not.toThrow();
  });

  it("keeps a valid legacy value when copying it fails", () => {
    const legacy = new Map([["privacy-mode", "true"]]);
    const storage = {
      getItem: (key: string) => legacy.get(key) ?? null,
      setItem: () => {
        throw new Error("quota exceeded");
      },
      removeItem: (key: string) => legacy.delete(key),
    };

    expect(readClientStorage(storage, CLIENT_STORAGE_KEYS.privacyMode, ["true", "false"])).toBe(
      "true",
    );
    expect(legacy.get("privacy-mode")).toBe("true");
  });
});
