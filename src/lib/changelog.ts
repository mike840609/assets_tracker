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
    version: "0.9.0",
    date: "2026-06-23",
    summary: {
      "en-US": "Clearer, leaner Analysis charts, plus a cumulative growth view.",
      "zh-TW": "更清晰、更精簡的分析圖表，並新增累積成長檢視。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "New Cumulative Growth chart in Analysis shows how much of your net-worth growth came from deposits vs. market gains over the selected range.",
          "zh-TW":
            "分析頁新增「累積成長」圖表，呈現所選期間內淨資產成長有多少來自存入金額、多少來自市場收益。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Assets vs. Liabilities is now an area chart with a net-worth line, so the balance-sheet trend reads at a glance.",
          "zh-TW": "「資產與負債」改為帶有淨資產走勢線的面積圖，資產負債趨勢一眼即懂。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Streamlined the Analysis tab: Cash Flow Decomposition now carries monthly movement, Category Trend became a stacked area, and the redundant Monthly Change and Top Movers panels were removed.",
          "zh-TW":
            "精簡分析頁：現金流分解圖現在同時呈現每月變化、類別趨勢改為堆疊面積圖，並移除重複的每月變化與最大變動面板。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The Cash Flow chart now shows the true monthly net change even when deposits and market movement pull in opposite directions.",
          "zh-TW": "即使存入金額與市場變動方向相反，現金流圖表現在也能正確顯示每月淨變化。",
        },
      },
    ],
  },
  {
    version: "0.8.6",
    date: "2026-06-21",
    summary: {
      "en-US": "Reliable browser error reporting via first-party Sentry tunnel.",
      "zh-TW": "透過第一方 Sentry 通道確保瀏覽器錯誤回報正常運作。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Browser error reports now use a first-party tunnel so privacy tools such as Brave Shields no longer block them.",
          "zh-TW":
            "瀏覽器錯誤回報現在透過第一方通道傳送，不再被 Brave Shields 等隱私防護工具阻擋。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Google profile avatars now load when the PWA service worker is active, without triggering Content Security Policy errors.",
          "zh-TW":
            "PWA 服務工作者啟用時，Google 個人頭像現在可正常載入，不再觸發內容安全政策錯誤。",
        },
      },
    ],
  },
  {
    version: "0.8.5",
    date: "2026-06-21",
    summary: {
      "en-US": "Sharper mobile legibility in light mode.",
      "zh-TW": "淺色模式下行動版更清晰易讀。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Gain, loss, and accent values now meet WCAG AA contrast in light mode — green and blue figures on cards are easier to read in bright light.",
          "zh-TW":
            "淺色模式下的漲跌與重點數值現已符合 WCAG AA 對比標準，卡片上的綠色與藍色數字在強光下更易閱讀。",
        },
      },
    ],
  },
  {
    version: "0.8.4",
    date: "2026-06-21",
    summary: {
      "en-US": "Fixed the Google profile avatar failing to load in the sidebar.",
      "zh-TW": "修正側邊欄 Google 個人頭像無法載入的問題。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Sidebar avatar: Google profile pictures no longer fail to load (the request now omits the referrer that Google's image CDN was rejecting), and a broken avatar falls back to the version link instead of a broken-image icon.",
          "zh-TW":
            "側邊欄頭像：Google 個人頭像不再載入失敗（請求不再帶上 Google 圖片 CDN 會拒絕的來源資訊），且頭像載入失敗時會改顯示版本連結，而非破圖圖示。",
        },
      },
    ],
  },
  {
    version: "0.8.3",
    date: "2026-06-21",
    summary: {
      "en-US": "Clearer Analysis page and quieter dashboard status bar.",
      "zh-TW": "分析頁更清晰，儀表板狀態列更簡潔。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Analysis section headers now show the active time range (e.g. 'Movement — All') so the selected period is always visible as you scroll.",
          "zh-TW":
            "分析頁各區段標題現在會顯示當前時間範圍（例如「變動 — 全部」），捲動時也能隨時確認所選期間。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Replaced 'Fixed YTD baseline' and 'year-start baseline' with plain language: 'Year to date' and 'Latest snapshot vs. Jan 1'.",
          "zh-TW":
            "將「固定年初至今基準」等專業術語改為更直白的說法：「年初至今」及「最新快照 vs. 1月1日」。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Dashboard status bar: the snapshot badge now only appears when the daily cron has missed two or more cycles, keeping the bar quiet during normal operation.",
          "zh-TW":
            "儀表板狀態列：快照標籤現在只在每日排程連續兩次以上未執行時才出現，正常運作時不再佔用版面。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Sidebar privacy toggle now shows 'Hide' or 'Show' text next to the eye icon, making the control discoverable without hovering.",
          "zh-TW":
            "側邊欄隱私切換按鈕現在在眼睛圖示旁顯示「Hide」或「Show」文字，不需滑鼠懸停也能一目了然。",
        },
      },
    ],
  },
  {
    version: "0.8.1",
    date: "2026-06-20",
    summary: {
      "en-US": "Clearer mobile navigation, analysis charts, and labels; settings desktop polish.",
      "zh-TW": "更清楚的行動版導覽、分析圖表與標籤；設定頁桌面版優化。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Mobile navigation: Goals, Watchlist, and Projections now live together under a single Plan tab.",
          "zh-TW": "行動版導覽：目標、自選股與財務預測整合於單一「計畫」分頁。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Analysis opens straight to its charts on mobile; History is no longer a separate tab inside Analysis.",
          "zh-TW": "行動版分析頁直接顯示圖表；歷史紀錄不再是分析頁中的獨立分頁。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Sharper mobile labels: the header subtitle and activity-heatmap labels are larger and higher contrast.",
          "zh-TW": "行動版標籤更清晰：頁首副標與活動熱圖標籤加大並提高對比。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Dashboard: removed the exchange-rate status chip to keep the freshness row focused on prices and snapshots.",
          "zh-TW": "儀表板：移除匯率更新狀態標籤，狀態列聚焦於價格與快照。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Cash-flow chart: Contributions now has its own color, so it no longer reads as a downward move.",
          "zh-TW": "現金流圖表：「淨流入」改用獨立顏色，不再與下跌的顏色混淆。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "The Analysis loading placeholder now mirrors the page layout (section headings and chart cards), so content settles in place instead of shifting as it loads.",
          "zh-TW": "分析頁載入骨架改為對應實際版面（區段標題與圖表卡片），內容載入時不再跳動。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Settings now lays out in two columns on desktop instead of a single narrow column, so wide screens are no longer mostly empty space.",
          "zh-TW": "設定頁在桌面改為雙欄排版，不再是單一窄欄，寬螢幕不再留下大片空白。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "On large monitors (1536px and wider) page content uses more of the available width instead of leaving wide side margins.",
          "zh-TW": "在大型螢幕（1536px 以上）上，頁面內容會運用更多可用寬度，不再留下寬邊距。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Portfolio Composition treemap: the selection ring on a hovered tile now uses the tile's own color instead of a jarring near-black foreground stroke.",
          "zh-TW":
            "投資組合熱圖：滑鼠懸停時的選取框線現在使用圖塊本身的顏色，不再顯示突兀的深色邊框。",
        },
      },
    ],
  },
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
