import { DEFAULT_LOCALE, type Locale } from "@/i18n/config";

/**
 * Single source of truth for the app's version history.
 *
 * The website version is *derived* from this list — `APP_VERSION` is always the
 * top (newest) release. Shipping a change means prepending a release here; the
 * version shown in the sidebar, Settings, and the `/changelog` timeline all move
 * in lockstep because they read from `APP_VERSION` / `CHANGELOG`. Keep
 * `package.json`'s `version` field in sync with the top entry.
 *
 * Entries are newest-first. Change text may be a plain string (English only) or
 * a per-locale map; `resolveChangeText` handles the fallback so partial
 * translations never render blank.
 *
 * Versioning convention (SemVer, "highest change type wins"): see docs/VERSIONING.md.
 */

export type ChangeType = "added" | "improved" | "fixed";

/** Either a single English string or a per-locale map (falls back to en-US). */
type LocalizedText = string | Partial<Record<Locale, string>>;

export interface ChangeEntry {
  type: ChangeType;
  text: LocalizedText;
}

export interface Release {
  /** Semantic version without a leading "v" (e.g. "0.6.0"). */
  version: string;
  /** ISO date (YYYY-MM-DD) the release shipped. */
  date: string;
  /** Optional one-line headline for the release. */
  summary?: LocalizedText;
  changes: ChangeEntry[];
}

export const CHANGELOG: Release[] = [
  {
    version: "0.8.0",
    date: "2026-06-20",
    summary: {
      "en-US": "A calmer mobile header and an easier way to switch themes.",
      "zh-TW": "更清爽的行動版頁首，以及更直覺的主題切換方式。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Appearance control in Settings: pick Light, Dark, or System directly from the preferences page.",
          "zh-TW": "設定頁新增「外觀」選項：可直接選擇淺色、深色或跟隨系統。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Mobile navigation: History is now a primary tab, and Settings lives in the header for quicker access.",
          "zh-TW": "行動版導覽：歷史改為主要分頁，設定移至頁首以便快速開啟。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "The mobile header theme switcher is now a single icon that opens a compact Light / Dark / System picker, easing header crowding.",
          "zh-TW":
            "行動版頁首的主題切換改為單一圖示，點擊後展開淺色／深色／系統選單，減少頁首壅擠。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "History activity heatmap now fades on both edges so it's clear you can scroll in either direction after it jumps to today.",
          "zh-TW": "歷史活動熱圖兩側皆會淡出，捲動至今日後可清楚看出左右皆可繼續捲動。",
        },
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-17",
    summary: {
      "en-US": "Snapshots can now carry the story behind the numbers.",
      "zh-TW": "快照現在可以記錄數字背後的事件脈絡。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Snapshot labels and notes: annotate major events, corrections, migrations, and other moments directly from History.",
          "zh-TW": "新增快照標籤與備註：可在歷史頁直接標記重大事件、修正、帳戶轉移或其他關鍵時刻。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "History now surfaces snapshot context in the ledger, trend chart tooltip, and activity heatmap tooltip, with privacy mode hiding annotation text.",
          "zh-TW":
            "歷史頁會在分類帳、趨勢圖提示與活動熱圖提示中顯示快照脈絡；隱私模式會隱藏標籤與備註文字。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Snapshot reconciliation warnings flag large drift between the latest snapshot and current reconstructed net worth without changing data automatically.",
          "zh-TW":
            "新增快照對帳提醒：當最新快照與目前重建淨值差異過大時提示使用者，且不會自動修改資料。",
        },
      },
    ],
  },
  {
    version: "0.6.1",
    date: "2026-06-17",
    summary: {
      "en-US": "Recurring and transaction forms feel native on mobile.",
      "zh-TW": "定期與交易表單在手機上更貼近原生操作體驗。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Add/edit forms for recurring investments, recurring cash, and transactions now open as native bottom sheets on mobile with larger touch targets, and scroll instead of clipping on small screens.",
          "zh-TW":
            "定期投資、定期現金與交易的新增／編輯表單，在手機上改以原生底部彈出視窗呈現，並加大可點擊範圍；在小螢幕上可捲動而不會被裁切。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Long stock names no longer overflow and break the layout of the Add/Edit Recurring Investment dialog.",
          "zh-TW": "較長的股票名稱不再溢出並破壞「新增／編輯定期投資」視窗的版面。",
        },
      },
    ],
  },
  {
    version: "0.6.0",
    date: "2026-06-16",
    summary: {
      "en-US": "Recurring money in, and a place to see what changed.",
      "zh-TW": "新增定期資金流入，並提供查看更新內容的頁面。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Version history page with a release timeline, reachable from Settings and the command palette.",
          "zh-TW": "版本紀錄頁面，以時間軸呈現各版本更新，可從設定或指令面板開啟。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Recurring cash transactions and dollar-cost-averaging investment plans, materialized automatically by the daily snapshot job.",
          "zh-TW": "定期現金交易與定期定額（DCA）投資計畫，由每日快照工作自動產生。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Every dropdown now follows your display language after a Select localization sweep.",
          "zh-TW": "完成 Select 在地化校對，所有下拉選單皆會依顯示語言呈現。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US": "A runtime guard now warns early when Node is too old to run the dev server.",
          "zh-TW": "新增 Node 版本檢查，執行環境過舊時會在啟動開發伺服器前提早警告。",
        },
      },
    ],
  },
  {
    version: "0.5.1",
    date: "2026-06-15",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Yahoo Finance 4xx responses during symbol search are treated as expected and no longer logged to Sentry as errors.",
          "zh-TW": "搜尋代號時 Yahoo Finance 的 4xx 回應視為預期狀況，不再以錯誤回報至 Sentry。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US": "Recovered Frankfurter exchange-rate misses no longer report as Sentry errors.",
          "zh-TW": "已復原的 Frankfurter 匯率缺漏不再回報為 Sentry 錯誤。",
        },
      },
    ],
  },
  {
    version: "0.5.0",
    date: "2026-06-14",
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Migrated the toolchain from npm to pnpm with a content-addressable store for faster, smaller installs.",
          "zh-TW": "工具鏈由 npm 遷移至 pnpm，採用內容定址儲存，安裝更快、體積更小。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US": "Moved dev-only packages to devDependencies to slim production installs.",
          "zh-TW": "將僅供開發使用的套件移至 devDependencies，精簡正式環境安裝。",
        },
      },
    ],
  },
  {
    version: "0.4.0",
    date: "2026-06-02",
    summary: {
      "en-US": "Set targets, watch drift.",
      "zh-TW": "設定目標，掌握偏離。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Target allocation with rebalance drift alerts: set targets in Settings, track drift in Analysis, get nudges on the Dashboard.",
          "zh-TW": "目標配置與再平衡偏離提醒：於設定設定目標、在分析頁追蹤偏離、於儀表板取得提醒。",
        },
      },
    ],
  },
  {
    version: "0.3.0",
    date: "2026-05-19",
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Account-level performance attribution in Analysis, separating market movement from cash contributions.",
          "zh-TW": "分析頁新增帳戶層級的績效歸因，區分市場波動與現金投入。",
        },
      },
    ],
  },
  {
    version: "0.2.0",
    date: "2026-05-04",
    changes: [
      {
        type: "added",
        text: {
          "en-US": "Net worth goals and milestones with progress tracking.",
          "zh-TW": "淨值目標與里程碑，並提供進度追蹤。",
        },
      },
    ],
  },
  {
    version: "0.1.0",
    date: "2026-04-15",
    summary: {
      "en-US": "The first release.",
      "zh-TW": "首次發布。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US": "Accounts, holdings, and transactions with multi-currency net worth.",
          "zh-TW": "帳戶、持有部位與交易，支援多幣別淨值。",
        },
      },
      {
        type: "added",
        text: {
          "en-US": "Daily snapshots and net worth history that renormalizes to your base currency.",
          "zh-TW": "每日快照與淨值歷史，並換算為你的基準貨幣。",
        },
      },
      {
        type: "added",
        text: {
          "en-US": "Live prices from Yahoo Finance with a CoinGecko crypto fallback.",
          "zh-TW": "來自 Yahoo Finance 的即時報價，加密貨幣以 CoinGecko 備援。",
        },
      },
    ],
  },
];

/** The current website version: always the newest release. */
export const APP_VERSION = CHANGELOG[0].version;

/** Resolve localized change text with a graceful en-US fallback. */
export function resolveChangeText(text: LocalizedText, locale: Locale): string {
  if (typeof text === "string") return text;
  return text[locale] ?? text[DEFAULT_LOCALE] ?? Object.values(text)[0] ?? "";
}
