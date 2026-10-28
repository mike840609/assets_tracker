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
    version: "1.7.1",
    date: "2026-10-25",
    summary: {
      "en-US":
        "A security and reliability patch: refreshed Next.js and Zod, unresolved FX rates no longer enter history, and calendar earnings stop blocking the page.",
      "zh-CN":
        "安全与可靠性修补：更新 Next.js 和 Zod、未解析的汇率不再写入历史记录，日历收益也不再阻塞页面。",
      "zh-TW":
        "安全性與可靠性修補：更新 Next.js 與 Zod、未解析匯率不再寫入歷史，財報資料也不再阻塞行事曆頁面。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Upgraded Next.js to 16.4.3 and Zod to 4.6.7, clearing two critical and two high-severity advisories in the framework and validation layer.",
          "zh-CN":
            "升级 Next.js 至 16.4.3、Zod 至 4.6.7，修复框架与校验层中的两项重大与两项高风险安全漏洞。",
          "zh-TW":
            "升級 Next.js 至 16.4.3、Zod 至 4.6.7，修補框架與驗證層的兩項重大與兩項高風險安全性漏洞。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "A snapshot is no longer written when an exchange rate is missing. Previously the dashboard's 1:1 fallback could freeze an understated value into history; unsupported account, base, goal, and history currencies are now rejected at the edge as well.",
          "zh-CN":
            "缺失汇率时不再写入快照。过去仪表板的 1:1 回退可能把被低估的值永久写入历史；不受支持的账户、基准、目标和历史货币也会在边界处被拒绝。",
          "zh-TW":
            "匯率缺失時不再寫入快照。過去儀表板的 1:1 備援可能把低估的金額永久寫入歷史；不支援的帳戶、基準、目標與歷史查詢幣別也會在輸入時被拒絕。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Stock search and option-chain requests now require a signed-in session (the public Demo is still allowed), closing an anonymous path to the market-data providers.",
          "zh-CN":
            "股票搜索与期权链请求现在需要已登录的会话（公开 Demo 仍可使用），关闭匿名访问市场数据提供商的通道。",
          "zh-TW":
            "股票搜尋與選擇權鏈請求現在需要登入 session（公開 Demo 仍可使用），關閉匿名存取市場資料供應商的管道。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The daily snapshot cron resumes after the last user it processed when it hits its time budget, so the same tail of a large instance is no longer skipped every day.",
          "zh-CN":
            "每日快照 cron 在耗尽时间预算后会从上一次处理的用户继续执行，因此大型实例的尾部用户不再每天被跳过。",
          "zh-TW":
            "每日快照 cron 在時間預算用完後，會從上次處理到的使用者續跑，大型實例尾端的使用者不再每天被跳過。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Calendar earnings load after hydration instead of blocking the server render, and a provider failure now shows a retry message rather than silently removing the events.",
          "zh-CN":
            "日历收益在页面 hydrate 后再加载，不再阻塞服务器渲染；提供商失败时会显示重试消息，而不是静默移除事件。",
          "zh-TW":
            "行事曆財報改在頁面 hydrate 後載入，不再阻塞伺服器渲染；供應商失敗時會顯示重試訊息，而不是默默移除事件。",
        },
      },
    ],
  },
  {
    version: "1.7.0",
    date: "2026-09-23",
    summary: {
      "en-US":
        "Options group with their underlying like a broker statement, plus a dashboard secondary currency and a security patch.",
      "zh-CN":
        "期权会按标的合并分组显示，如券商对账单；新增仪表板次要货币，并修补一项安全漏洞。",
      "zh-TW":
        "選擇權現在會跟標的一起分組顯示，如券商對帳單；新增儀表板次要幣別，並修補一項安全性漏洞。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "On an account page, a stock and its call/put options on the same underlying now collapse into one group showing their combined value and weight — expand it to see each position, same as a broker statement.",
          "zh-CN":
            "账户页面中，同一标的的正股与其买权/卖权，现在会合并成一个分组，显示合计市值与占比 —— 展开即可看到各个持仓，如同券商对账单。",
          "zh-TW":
            "帳戶頁面中，同一標的的正股與其買權/賣權，現在會收合成一個群組，顯示合計市值與佔比 —— 展開即可看到個別部位，如同券商對帳單。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Optional secondary currency on the dashboard: turn it on in Settings to show a small converted total under net worth, assets, and liabilities.",
          "zh-CN":
            "仪表板可选择次要货币：在设置中开启后，净资产、资产与负债下方会显示换算后的金额。",
          "zh-TW":
            "儀表板可選擇次要幣別：於設定中開啟後，淨資產、資產與負債下方會顯示換算後的金額。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Cleaned up light-mode contrast: the History heatmap's tile labels and subtitle, and the selected ring around a theme swatch in Settings.",
          "zh-CN":
            "改善浅色模式对比度：历史热力图的网格文字与副标题，以及设置页中已选主题的外框。",
          "zh-TW":
            "改善淺色模式對比度：歷史熱力圖的格子文字與副標題，以及設定頁中已選佈景主題的外框。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The public landing page no longer occasionally falls back to client-side rendering with a blank flash on first load.",
          "zh-CN": "公开介绍页首次加载时，不再偶尔退回客户端渲染并出现空白闪烁。",
          "zh-TW": "公開介紹頁首次載入時，不再偶爾退回用戶端渲染並出現空白閃爍。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Patched three critical advisories in the auth stack (next-auth and @auth/core).",
          "zh-CN": "修补认证组件栈（next-auth 与 @auth/core）中的三项重大安全漏洞。",
          "zh-TW": "修補驗證元件堆疊（next-auth 與 @auth/core）中的三項重大安全性漏洞。",
        },
      },
    ],
  },
  {
    version: "1.6.0",
    date: "2026-09-04",
    summary: {
      "en-US":
        "Expired options settle at what they are actually worth, DCA cash comes back exactly, and history follows the Taiwan day.",
      "zh-CN": "到期期权按真实价值结算、DCA 扣款精确返还，历史图表全面对齐台湾日。",
      "zh-TW": "到期選擇權按真實價值結算、DCA 扣款精準返還，歷史圖表全面對齊台灣日。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Links shared to chat apps and social media now unfurl with a preview image of the public landing page instead of a generic card.",
          "zh-CN": "分享到聊天应用和社交媒体的链接，现在会显示公开介绍页的预览图，而不是通用卡片。",
          "zh-TW": "分享到通訊軟體與社群媒體的連結，現在會顯示公開介紹頁的預覽圖，而非通用卡片。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "An expired option now settles into cash at its intrinsic value from the underlying's expiration-day close — a call credits max(price − strike, 0), a put credits max(strike − price, 0) — instead of carrying a stale premium or vanishing to zero. When the expiration price cannot be established reliably, the position is left untouched for you to close by hand.",
          "zh-CN":
            "到期的期权现在会按标的到期日收盘价的内在价值转为现金 —— 看涨期权记入 max(现价 − 行权价, 0)，看跌期权记入 max(行权价 − 现价, 0)，不再沿用过期的权利金，也不会直接归零。若无法可靠确认到期价格，持仓会保留，供你手动处理。",
          "zh-TW":
            "到期的選擇權現在會按標的到期日收盤價的內含價值轉為現金 —— 買權認列 max(現價 − 履約價, 0)，賣權認列 max(履約價 − 現價, 0)，不再沿用過期的權利金，也不會直接歸零。若無法可靠確認到期價格，部位會完整保留，由你手動處理。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Deleting or shrinking an auto-invested BUY now returns exactly the cash that was debited — even across currencies and even after its rule was deleted. Previously the shares disappeared but the debit stayed, leaving the account permanently short.",
          "zh-CN":
            "删除或缩减自动定投产生的 BUY，现在会精确返还当初扣掉的现金 —— 跨币种、规则已删除也适用。此前只会移除股数而保留扣款，导致账户永久短缺。",
          "zh-TW":
            "刪除或縮減自動定投產生的 BUY，現在會精準返還當初扣掉的現金 —— 跨幣別、規則已刪除也適用。先前只會移除股數而保留扣款，導致帳戶永久短少。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "History charts now anchor on the Taiwan business day like the snapshots do. The newest day no longer looks missing in the morning, dates no longer shift a day for viewers outside UTC+8, and year-to-date keeps January 1.",
          "zh-CN":
            "历史图表改与快照一致，以台湾营业日为基准。清晨不再出现最新一天空白，UTC+8 以外地区日期不再偏移一天，今年至今也不再遗漏 1 月 1 日。",
          "zh-TW":
            "歷史圖表改與快照一致，以台灣營業日為基準。清晨不再看見最新一天空白，UTC+8 以外地區日期不再偏移一天，今年至今也不再漏掉 1 月 1 日。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "A scheduled DCA buy no longer converts at a days-old cached price when a provider drops a symbol. It refetches the live price first, and if that fails the run is skipped so it retries next time instead of locking in the wrong share count.",
          "zh-CN":
            "当行情源临时缺失某只标的时，计划定投不再使用数天前的缓存价格换算股数。系统会先抓取实时价格，失败则跳过本次并留待下次重试，不会写死错误的股数。",
          "zh-TW":
            "當行情來源暫時缺漏某檔標的，排程定投不再用數天前的快取價格換算股數。系統會先抓即時價格，失敗則跳過本次、留待下次重試，不會寫死錯誤的股數。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Large balances no longer fail with a mid-transaction overflow error — amounts up to 1e15 are accepted, which covers very weak currencies in normal use. An oversized value in a backup import is now rejected with a 400 pointing at the field instead of a generic 500.",
          "zh-CN":
            "大额余额不再因交易中途溢出而失败 —— 金额上限放宽至 1e15，正常使用的弱币种也涵盖在内。备份导入若有超大数值，现在会返回 400 并指出字段，而非笼统的 500。",
          "zh-TW":
            "大額餘額不再於交易中途因欄位溢位失敗 —— 金額上限放寬至 1e15，一般使用的弱勢幣別也涵蓋在內。備份匯入若有超大數值，現在會回 400 並指出欄位，而非籠統的 500。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Exchange rates for very weak currencies no longer carry a ~0.3% rounding error from the stored inverse rate, and refreshing one base currency can no longer trick another base into skipping its own refresh.",
          "zh-CN":
            "极弱币种的汇率不再因存储的反向汇率产生约 0.3% 的舍入误差；刷新某一基准货币也不再导致另一基准错误地跳过自身刷新。",
          "zh-TW":
            "極弱勢幣別的匯率不再因儲存的反向匯率產生約 0.3% 的捨入誤差；重新整理某一基準貨幣也不會讓另一基準誤以為已更新而跳過抓取。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Resuming a paused recurring rule now schedules the next run from the resume date instead of replaying every occurrence missed while paused.",
          "zh-CN":
            "恢复已暂停的定期规则时，下次执行改从恢复当下起算，不会把暂停期间的次数一次补跑。",
          "zh-TW":
            "恢復已暫停的定期規則時，下次執行改從恢復當下起算，不會把暫停期間的次數一次補跑。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Account type can no longer be changed after creation — flipping asset and liability would re-sign the entire stored history. To restructure, create the matching account and move the balance instead.",
          "zh-CN":
            "账户类型建立后不再允许修改 —— 资产/负债互换会导致整段历史金额的正负号错误。若需调整，请创建对应类型的新账户并转移余额。",
          "zh-TW":
            "帳戶類型建立後不再允許修改 —— 資產／負債互換會讓整段歷史金額正負號錯亂。如需調整，請建立對應類型的新帳戶並轉移餘額。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Restoring a backup whose recurring rule has no end date no longer fails validation — open-ended rules import as open-ended.",
          "zh-CN": "还原备份时，没有结束日的定期规则不再因验证失败而中断 —— 无期限规则会原样导入。",
          "zh-TW": "還原備份時，沒有結束日的定期規則不再因驗證失敗而中斷 —— 無限期規則會原樣匯入。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "When a selected range includes accounts you later deleted, Analysis now says so: the net-worth trend keeps their stored totals while the category and attribution charts omit them.",
          "zh-CN":
            "所选期间若包含后来删除的账户，分析页现在会主动说明：净资产趋势保留其已存储总额，类别与归因图则不纳入。",
          "zh-TW":
            "所選期間若包含後來刪除的帳戶，分析頁現在會主動說明：淨資產趨勢保留其已儲存總額，類別與歸因圖則不納入。",
        },
      },
    ],
  },
  {
    version: "1.5.0",
    date: "2026-08-31",
    summary: {
      "en-US":
        "A public page at your own domain, and a one-command setup that stops shipping a shared secret.",
      "zh-CN": "自有域名的公开介绍页，以及一行命令完成设置，不再沿用共享的 secret。",
      "zh-TW": "自有網域的公開介紹頁，以及一行指令完成設定，不再沿用共用的 secret。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Visitors who are not signed in now see a public landing page at your domain instead of the sign-in form, with product screenshots, the feature list, and the deployment options. Available in English and Traditional Chinese, and it never exposes your data.",
          "zh-CN":
            "未登录的访客现在会在你的域名看到公开介绍页，而不是登录表单，内含产品截图、功能列表与部署方式。提供英文和繁体中文，且不会暴露你的任何数据。",
          "zh-TW":
            "未登入的訪客現在會在你的網域看到公開介紹頁，而不是登入表單，內含產品截圖、功能列表與部署方式。提供英文與繁體中文，且不會揭露你的任何資料。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "`./scripts/setup-env.sh` creates .env and generates every secret in one command, then prints the password you sign in with. It refuses to overwrite an existing .env, and needs only a shell — no Node install for the Docker path.",
          "zh-CN":
            "`./scripts/setup-env.sh` 一行命令即可创建 .env 并生成所有 secret，并打印登录用的密码。它不会覆盖既有 .env，而且只需要 shell —— Docker 部署无需额外安装 Node。",
          "zh-TW":
            "`./scripts/setup-env.sh` 一行指令即可建立 .env 並產生所有 secret，並印出登入用的密碼。它不會覆寫既有的 .env，且只需要 shell —— Docker 部署不必額外安裝 Node。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "A deployment that copied .env.example without editing it started normally while signing sessions with a secret published in the public repository. Any secret left at the example placeholder is now rejected at startup, with the command that fixes it. Secrets you generated yourself keep working unchanged; short ones now log a warning instead of failing.",
          "zh-CN":
            "此前若直接复制 .env.example 而未修改，服务仍会正常启动，却使用了公开在源码库中的 secret 簽署登录会话。现在只要有 secret 仍是示例占位字符串，启动时就会被拦下，并提示修正命令。你自行生成的 secret 不受影响；长度过短者改为记录警告而非中止。",
          "zh-TW":
            "先前若直接複製 .env.example 而未修改，服務仍會正常啟動，卻使用了公開在原始碼庫中的 secret 簽署登入工作階段。現在只要有 secret 仍是範例佔位字串，啟動時就會被擋下，並提示修正指令。你自行產生的 secret 不受影響；長度過短者改為記錄警告而非中止。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Self-hosting docs now open with the generate-and-deploy sequence that actually works from an empty directory, and drop the redundant image pull — starting the stack already fetches what is missing.",
          "zh-CN":
            "自行部署文档改为“生成配置并部署”的完整步骤，从空目录即可照做；同时移除多余的镜像拉取 —— 启动时本来就会自动获取缺失的镜像。",
          "zh-TW":
            "自行架設文件改以「產生設定並部署」的完整步驟開頭，從空目錄即可照做；同時移除多餘的映像檔 pull —— 啟動時本來就會自動取得缺少的映像檔。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Reading the landing page while it is still loading no longer jumps back to the top the moment it finishes. The slower the device, the more of the page you used to lose.",
          "zh-CN":
            "在公开介绍页尚未加载完成时往下阅读，不会再在加载完成的瞬间跳回顶部。设备越慢，之前被卷掉的内容越多。",
          "zh-TW":
            "在公開介紹頁尚未載入完成時往下閱讀，不會再於載入完成的瞬間跳回頁首。裝置越慢，先前被捲掉的內容越多。",
        },
      },
    ],
  },
  {
    version: "1.4.0",
    date: "2026-08-22",
    summary: {
      "en-US":
        "A US earnings overlay for your calendar, with resilient data and safer deployment recovery.",
      "zh-CN": "日历新增美股财报覆盖层，并强化数据获取与部署恢复能力。",
      "zh-TW": "行事曆新增美股財報覆蓋層，並強化資料取得與部署復原能力。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Calendar and the mobile Goals calendar now show upcoming US earnings for stocks you follow. Add tracked or manual symbols, see before-market and after-market calls on the Taiwan calendar day, and manage the list from the calendar.",
          "zh-CN":
            "日历与移动版目标日历现在会显示关注美股的即将公布财报。可加入已跟踪或手动输入的代码，在台湾日历日期查看盘前与盘后财报，并直接在日历管理列表。",
          "zh-TW":
            "行事曆與行動版目標行事曆現在會顯示追蹤美股的即將公布財報。可加入已追蹤或手動輸入的代號，在台灣日曆日期查看盤前與盤後財報，並直接於行事曆管理清單。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Earnings data handles unavailable Yahoo Finance responses without blocking the calendar, while watch management validates US listings and applies request limits.",
          "zh-CN":
            "Yahoo Finance 暂时无法获取数据时不会阻塞日历；关注清单管理也会校验美股上市地并应用请求限制。",
          "zh-TW":
            "Yahoo Finance 暂時無法取得資料時不會阻塞行事曆；追蹤清單管理也會驗證美股上市地並套用請求限制。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Database migrations can now recover safely when a deployment previously applied only part of the calendar-earnings schema.",
          "zh-CN":
            "此前若部署只应用了部分财报日历数据库 schema，migration 现在可以安全地恢复并重试。",
          "zh-TW":
            "先前若部署只套用了部分財報行事曆資料庫 schema，migration 現在可以安全地復原並重試。",
        },
      },
    ],
  },
  {
    version: "1.3.0",
    date: "2026-08-15",
    summary: {
      "en-US": "A new name — astt — and a proper install-to-home-screen flow on mobile.",
      "zh-CN": "更名为 astt，并补齐手机安装为 App 的流程。",
      "zh-TW": "換上新名字 astt，並補齊手機安裝成 App 的流程。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Install astt to your home screen: Android and desktop browsers now offer a one-tap install prompt, and the app ships launcher icons sized for each platform so the installed shortcut looks right. Dismiss it once and it stays dismissed.",
          "zh-CN":
            "可将 astt 安装到主屏幕：Android 与桌面浏览器会显示一键安装提示，并附上各平台适用尺寸的启动图标，安装后的快捷方式不会变形。关闭提示后就不会再出现。",
          "zh-TW":
            "可將 astt 安裝到主畫面：Android 與桌面瀏覽器會顯示一鍵安裝提示，並附上各平台適用尺寸的啟動圖示，安裝後的捷徑不會變形。關閉提示後就不會再出現。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "On iPhone and iPad, opening astt in a browser other than Safari now explains how to install it — switch to Safari and use Add to Home Screen — with a button that copies the link so you don't have to retype it.",
          "zh-CN":
            "在 iPhone、iPad 以非 Safari 的浏览器打开 astt 时，会说明如何安装：切换到 Safari 并选择“添加到主屏幕”，并提供复制链接的按钮，不必手动重输网址。",
          "zh-TW":
            "在 iPhone、iPad 以非 Safari 的瀏覽器開啟 astt 時，會說明如何安裝：改用 Safari 並選擇「加入主畫面」，並提供複製連結的按鈕，不必手動重打網址。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Assets Tracker is now astt, at astt.app. Only the name changed — same project, same data, nothing to migrate. Self-hosted deployments keep their existing container images and settings.",
          "zh-CN":
            "Assets Tracker 更名为 astt，网址为 astt.app。只有名称改变：同一个项目、同一份数据，不需要任何迁移；自托管部署的容器镜像与设置也保持不变。",
          "zh-TW":
            "Assets Tracker 更名為 astt，網址為 astt.app。只有名稱改變：同一個專案、同一份資料，不需要任何遷移；自架部署的容器映像與設定也維持不變。",
        },
      },
    ],
  },
  {
    version: "1.2.0",
    date: "2026-08-09",
    summary: {
      "en-US": "Try the app without an account, plus a sturdier cron and price pipeline.",
      "zh-CN": "无需账户即可试用，并强化计划任务与价格同步流程的稳定性。",
      "zh-TW": "免註冊即可試用，並強化排程與報價流程的穩定度。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Public demo: the login page now offers a one-click demo that needs no account. It creates an isolated workspace with sample data that expires after 24 hours, with a banner showing the remaining time and controls to reset the data or leave at any point.",
          "zh-CN":
            "公开 Demo：登录页新增免注册的一键体验，会创建独立的示例数据工作区，24 小时后自动到期；页面顶部横幅会显示剩余时间，并可隨時重置数据或离开。",
          "zh-TW":
            "公開 Demo：登入頁新增免註冊的一鍵體驗，會建立獨立的範例資料工作區，24 小時後自動到期；頁面上方橫幅會顯示剩餘時間，並可隨時重設資料或離開。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "The nightly cron and price refresh now scale with the number of users: users are paged through under a snapshot budget, snapshot inputs are bulk-loaded, price reads are scoped to accounts instead of scanning the whole cache, and Yahoo/CoinGecko requests are chunked so one bad batch can't fan out.",
          "zh-CN":
            "每日排程与报价更新改为随用户数量水平扩展：在快照预算内分页处理用户、批量加载快照输入、报价查询限制在实际账户，而不是扫描整份缓存，Yahoo/CoinGecko 请求也改为分批，避免单个失败批次扩散。",
          "zh-TW":
            "每日排程與報價更新改為隨使用者數量水平擴充：以快照預算分頁處理使用者、批次載入快照輸入、報價查詢限縮於實際帳戶而非掃描整份快取，Yahoo/CoinGecko 請求也改為分批，避免單一批次失敗擴散。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Identity is no longer derived from request headers, so a crafted request can't act as another user.",
          "zh-CN": "身份不再从请求头推导，因此伪造请求无法冒用其他用户。",
          "zh-TW": "身分不再從請求標頭推導，偽造的請求無法冒用其他使用者。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Analysis ranges are computed in your own timezone rather than UTC, liabilities move cash flow in the right direction, the first day of a recurring rule starts from the correct baseline, expired options are swept on a business day, and holdings are valued in the currency their quote was cached in.",
          "zh-CN":
            "分析区间改按你所在时区计算，而非 UTC；负债的现金流方向修正；定期规则首日按正确基准起算；到期期权改在营业日结算；持仓也改按报价缓存的币种计价。",
          "zh-TW":
            "分析區間改以你所在時區計算而非 UTC；負債的現金流方向修正；定期規則第一天以正確基準起算；到期選擇權改於營業日結算；持倉也改以報價快取的幣別計價。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Data you move in and out keeps its shape: mixed-currency history normalizes without losing precision, imports preserve each snapshot's breakdown currencies, backup export and import round-trip, and editing a recurring rule can no longer race its own materialization.",
          "zh-CN":
            "数据进出不再变形：混合币种的历史标准化不丢失精度、导入会保留各快照的币种组成、备份导出与还原可完整往返，编辑定期规则也不会再与自身的生成流程竞争。",
          "zh-TW":
            "資料進出不再變形：混合幣別的歷史正規化不會損失精度、匯入會保留各快照的幣別組成、備份匯出與還原可完整往返，編輯定期規則也不會再與自身的產生流程競爭。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Failures now surface instead of passing silently: snapshots are taken from a fresh net-worth read rather than a stale cached one, and partially failed snapshot runs and total price-refresh failures are both reported.",
          "zh-CN":
            "失败不再无声通过：快照改由实时净值读取生成，而非过期缓存，并会报告部分失败的快照任务与总价格刷新失败。",
          "zh-TW":
            "失敗不再無聲通過：快照改由即時的淨值讀取產生而非過期快取，部分失敗的快照排程與全面失敗的報價更新都會回報。",
        },
      },
    ],
  },
  {
    version: "1.1.0",
    date: "2026-07-26",
    summary: {
      "en-US": "A financial calendar, linked history charts, and leaner self-host images.",
      "zh-CN": "新增财经日历、联动的历史图表，以及更精简的自托管镜像。",
      "zh-TW": "新增財經行事曆、連動的歷史圖表，以及更精簡的自架映像檔。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Calendar: a new page for earnings, economic releases, dividends, filings, and reminders, with a month grid and a day agenda. It has its own desktop tab and lives in the mobile Plan hub, and entries are included in backup export and restore.",
          "zh-CN":
            "日历：新增页面，可记录财报、经济数据、分红、申报与提醒，并提供月视图与当日日程查看。桌面端有独立标签页，移动端收录于“计划”页面，日历条目也会纳入备份导出与恢复。",
          "zh-TW":
            "行事曆：新增頁面，可記錄財報、經濟數據、配息、申報與提醒，並提供月曆與當日行程檢視。桌面版有獨立分頁，行動版收錄於「計畫」頁，行事曆項目也會納入備份匯出與還原。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Activity heatmap and net-worth trend are now linked on both History and the Dashboard: hovering or selecting a day in the heatmap marks that same day on the trend chart.",
          "zh-CN":
            "历史页与仪表板的活动热力图现在与净值趋势图联动：在热力图上悬停或选中某一天，趋势图会同步标记该日。",
          "zh-TW":
            "歷史頁與儀表板的活動熱力圖現在與淨值趨勢圖連動：在熱力圖上懸停或選取某一天，趨勢圖會同步標記該日。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Self-hosting: container images are slimmer and hardened, built natively per architecture, and published to GitHub Container Registry.",
          "zh-CN":
            "自托管：容器镜像更精简且更安全，改为按架构原生构建，并发布至 GitHub Container Registry。",
          "zh-TW":
            "自行部署：容器映像檔更精簡且更安全，改為各架構原生建置，並發布至 GitHub Container Registry。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Clearer disclosures for figures that can't be recomputed: unresolved exchange rates now raise an app-wide banner, history rows converted from another base currency are labeled, and backdated transactions state that they don't rewrite past snapshots.",
          "zh-CN":
            "对无法重新计算的数字提供更明确的说明：汇率未能获取时会显示全站横幅、历史记录中由其他基准货币换算的行会加注标示，补登交易也会说明不会回写既有快照。",
          "zh-TW":
            "對無法重新計算的數字提供更明確的說明：匯率無法取得時會顯示全站橫幅、歷史紀錄中由其他基準貨幣換算的列會加註標示，補登交易也會說明不會回頭改寫既有快照。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The dashboard net-worth trend chart now matches the History tab, unrealized gain is computed only over holdings with a cost basis, and cost basis values its market leg in the price-cache currency like net worth does.",
          "zh-CN":
            "仪表板的净值趋势图现在与历史页一致；未实现收益仅计算具成本基准的持仓；成本基准的市场部分改按价格缓存币种计价，与净值一致。",
          "zh-TW":
            "儀表板的淨值趨勢圖現在與歷史頁一致；未實現損益僅計算具成本基礎的持倉；成本基礎的市值部分改以價格快取的幣別計價，與淨值一致。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Recurring rules now materialize due occurrences when created or edited and roll over on the Taiwan business day, editing a start date re-anchors the schedule without replaying history, renaming a holding fetches a price for the new symbol, and imported symbols get their prices warmed right away.",
          "zh-CN":
            "定期规则在创建或编辑时会立即生成到期交易，并按台湾营业日换日；调整起始日期会重新锚定排程，不会回放历史；重命名持仓会获取新代码的报价；导入的代码也会立即预热价格缓存。",
          "zh-TW":
            "定期規則在建立或編輯時會立即產生到期的交易，並依台灣營業日換日；調整起始日期會重新錨定排程，不會回放歷史；重新命名持倉會取得新代號的報價；匯入的代號也會立即預熱價格快取。",
        },
      },
    ],
  },
  {
    version: "1.0.1",
    date: "2026-07-15",
    summary: {
      "en-US": "Security and correctness hardening for the first public release.",
      "zh-CN": "为首次公开发布补强安全性与数据正确性。",
      "zh-TW": "為首次公開發布補強安全性與資料正確性。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Self-hosted production no longer exposes preview credentials by default, Vercel production remains Google-only, and high-severity runtime dependency findings have been remediated.",
          "zh-CN":
            "自托管正式环境默认不再开放预览账号登录，Vercel 正式环境维持仅限 Google 登录，并修补高严重度的运行时依赖组件弱点。",
          "zh-TW":
            "自行部署的正式環境預設不再開放預覽帳號登入，Vercel 正式環境維持僅限 Google 登入，並修補高嚴重度的執行期相依套件弱點。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Account currency is now immutable after creation, and recurring investment transactions preserve their execution price while safely rejecting holding/price currency mismatches.",
          "zh-CN":
            "账户创建后不可再变更币种；定期投资交易会保存成交价格，并安全拒绝持仓币种与报价币种不一致的情况。",
          "zh-TW":
            "帳戶建立後不可再變更幣別；定期投資交易會保存成交價格，並安全拒絕持倉幣別與報價幣別不一致的情況。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Daily refreshes now include watch-only stocks, recurring forms use the local calendar date, history heatmap colors treat flat days neutrally, and pull-to-refresh stays active until navigation finishes.",
          "zh-CN":
            "每日更新现在涵盖仅加入观察清单的股票；定期规则表单改用本地日期；历史热力图以中性色显示持平日期；下拉刷新会等待导航完成后再结束。",
          "zh-TW":
            "每日更新現在涵蓋僅加入觀察清單的股票；定期規則表單改用本地日期；歷史熱力圖以中性色顯示持平日期；下拉更新會等待導覽完成後再結束。",
        },
      },
    ],
  },
  {
    version: "1.0.0",
    date: "2026-07-11",
    summary: {
      "en-US": "First stable open-source release, ready for self-hosting.",
      "zh-CN": "首个稳定的开源版本，已可自行部署。",
      "zh-TW": "首個穩定的開源版本，已可自行部署。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Open-source project essentials: the MIT License, contribution guide, security policy, issue templates, and automated dependency updates.",
          "zh-CN":
            "补齐开源项目基础：MIT 许可证、贡献指南、安全性政策、Issue 模板与自动化依赖更新。",
          "zh-TW":
            "補齊開源專案基礎：MIT 授權、貢獻指南、安全性政策、Issue 範本與自動化相依套件更新。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Self-hosting documentation now uses Prisma migrations, and a restored baseline migration lets a fresh PostgreSQL database initialize reliably.",
          "zh-CN":
            "自托管文档改用 Prisma migrations，并补回基础 migration，让全新的 PostgreSQL 数据库能够可靠初始化。",
          "zh-TW":
            "自架文件改用 Prisma migrations，並補回基礎 migration，讓全新的 PostgreSQL 資料庫能可靠初始化。",
        },
      },
    ],
  },
  {
    version: "0.14.0",
    date: "2026-07-06",
    summary: {
      "en-US": "Backup export/import now includes recurring rules and the stock watchlist.",
      "zh-CN": "备份导出/导入现在包含定期规则与股票观察清单。",
      "zh-TW": "備份匯出/匯入現在包含定期規則與股票觀察清單。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Settings backup export and restore now cover recurring cash transactions, recurring investments (DCA rules), and the stock watchlist — previously a restore silently dropped these, so future recurring occurrences stopped generating and the watchlist came back empty.",
          "zh-CN":
            "设置页的备份导出与还原现在涵盖定期现金交易、定期投资（定期定额规则）与股票观察清单 —— 先前还原备份时会悄悄遗失这些数据，导致后续不再生成定期交易，观察清单也会清空。",
          "zh-TW":
            "設定頁的備份匯出與還原現在涵蓋定期現金交易、定期投資（定期定額規則）與股票觀察清單——先前還原備份時會悄悄遺失這些資料，導致往後不再產生定期交易，觀察清單也會清空。",
        },
      },
    ],
  },
  {
    version: "0.13.0",
    date: "2026-07-06",
    summary: {
      "en-US": "New drawdown chart and portfolio concentration card.",
      "zh-CN": "新增回撤图表与投资组合集中度卡片。",
      "zh-TW": "新增回撤圖表與投資組合集中度卡片。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Analysis: a drawdown (underwater) chart showing how far net worth sits below its prior peak, with a max-drawdown readout.",
          "zh-CN": "分析页：新增回撤图表，显示净资产距离前高的跌幅，并标示最大回撤。",
          "zh-TW": "分析頁：新增回撤圖表，顯示淨資產距離前高的跌幅，並標示最大回撤。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Dashboard: a concentration card showing your largest positions as a share of total assets.",
          "zh-CN": "仪表板：新增集中度卡片，显示最大持仓占总资产的比重。",
          "zh-TW": "儀表板：新增集中度卡片，顯示最大持倉佔總資產的比重。",
        },
      },
    ],
  },
  {
    version: "0.12.1",
    date: "2026-07-06",
    summary: {
      "en-US": "Fixed daily snapshots dated a day early for Taiwan-time users.",
      "zh-CN": "修正台湾时区用户的每日快照日期提前一天的问题。",
      "zh-TW": "修正台灣時區使用者的每日快照日期提前一天的問題。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            'The daily snapshot cron runs at 05:30 Taiwan time but stamped snapshots with the UTC calendar day (still "yesterday" at that hour), so the History tab, heatmap, and other calendar views showed each day\'s snapshot dated one day early. Snapshots now bucket by the Taiwan calendar day the cron actually ran on.',
          "zh-CN":
            "每日快照任务在台湾时间 05:30 执行，但此前是按 UTC 历日（此时仍为“昨天”）记录快照日期，导致历史页、热力图等日历视图都会把当天的快照显示为提前一天。现在快照会按任务实际执行时的台湾历日归类。",
          "zh-TW":
            "每日快照排程於台灣時間 05:30 執行，但先前是以 UTC 曆日（此時仍是「昨天」）記錄快照日期，導致歷史紀錄頁、熱力圖等以日曆呈現的畫面都把當天的快照顯示為提前一天。現在快照會依照排程實際執行當下的台灣曆日歸類。",
        },
      },
    ],
  },
  {
    version: "0.12.0",
    date: "2026-07-04",
    summary: {
      "en-US": "New Return Trend chart on the Analysis tab.",
      "zh-CN": "分析页新增投资回报走势图。",
      "zh-TW": "分析頁面新增投資報酬走勢圖。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "The Analysis tab now charts your monthly investment return alongside a cumulative return index, so you can see how your brokerage and crypto performance evolved over the selected range.",
          "zh-CN":
            "分析页现在会以图表呈现每月投资回报率与累计回报指数，让你看到券商与加密货币账户在所选期间的绩效演变。",
          "zh-TW":
            "分析頁面現在會以圖表呈現每月投資報酬率與累積報酬指數，讓你看到券商與加密貨幣帳戶在所選期間的績效演變。",
        },
      },
    ],
  },
  {
    version: "0.11.0",
    date: "2026-07-04",
    summary: {
      "en-US": "New Portfolio Return metric on the Analysis tab.",
      "zh-CN": "分析页新增投资回报率指标。",
      "zh-TW": "分析頁面新增投資報酬率指標。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "The Analysis summary now shows your Portfolio Return for the selected range — how much your brokerage and crypto accounts earned beyond what you deposited.",
          "zh-CN":
            "分析摘要现在会显示所选期间的投资回报率——券商与加密货币账户在扣除存入资金后的实际收益。",
          "zh-TW":
            "分析摘要現在會顯示所選期間的投資報酬率——券商與加密貨幣帳戶在扣除存入資金後的實際收益。",
        },
      },
    ],
  },
  {
    version: "0.10.5",
    date: "2026-07-04",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Analysis charts and KPIs no longer drop the current month for users in Americas (west-of-UTC) timezones — the month range was being read with local date getters off UTC-midnight boundaries, shifting the range back a month and hiding the latest data.",
          "zh-CN":
            "分析图表与关键指标不再对位于美洲（UTC 以西）时区的用户遗漏当月数据 —— 之前月份范围按本地时间读取 UTC 午夜边界日期，导致范围整体往前推一个月而隐藏最新数据。",
          "zh-TW":
            "分析圖表與關鍵指標不再對位於美洲（UTC 以西）時區的使用者遺漏當月資料——先前月份範圍以本地時間讀取 UTC 午夜的邊界日期，導致範圍整體往前推一個月而隱藏最新資料。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "FIRE / retirement projections now group net-worth snapshots by their UTC year, so a January-1 snapshot is no longer misfiled into the previous year on non-UTC servers.",
          "zh-CN":
            "FIRE / 退休预测现在按 UTC 年份汇总净值快照，因此在非 UTC 服务器上，1 月 1 日的快照不再被误归入上一年。",
          "zh-TW":
            "FIRE／退休預測現在以 UTC 年份彙整淨值快照，因此在非 UTC 伺服器上，1 月 1 日的快照不會再被誤歸入前一年。",
        },
      },
    ],
  },
  {
    version: "0.10.4",
    date: "2026-07-03",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "London- and Johannesburg-listed holdings quoted in pence/cents (e.g. `.L` and `.JO` symbols) are now converted to pounds/rand, fixing a roughly 100x overstatement of their value.",
          "zh-CN":
            "以便士/分计价的伦敦及约翰内斯堡上市持股（例如 `.L` 与 `.JO` 代码）现在会换算为英镑/南非兰特，修正此前约 100 倍的价值高估问题。",
          "zh-TW":
            "以便士／分計價的倫敦及約翰尼斯堡上市持股（例如 `.L` 與 `.JO` 代號）現在會換算為英鎊／南非蘭特，修正先前約 100 倍的價值高估問題。",
        },
      },
    ],
  },
  {
    version: "0.10.3",
    date: "2026-07-03",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            'The Goals page no longer errors out when a goal\'s trend is nearly flat against a large remaining gap: the projected "at current pace" date could run millions of years into the future and crash the page, so such out-of-range estimates are now simply omitted.',
          "zh-CN":
            "当某个目标的趋势近乎持平、但距离目标金额仍差距很大时，目标页面不再发生错误：此前“按当前速度”的预估日期可能推算到数百万年后并导致页面崩溃，现在这类超出合理范围的预估会直接忽略不显示。",
          "zh-TW":
            "當某個目標的趨勢近乎持平、但距離目標金額仍差距很大時，目標頁面不會再發生錯誤：先前「依目前速度」的預估日期可能推算到數百萬年後而導致頁面崩潰，現在這類超出合理範圍的預估會直接略過不顯示。",
        },
      },
    ],
  },
  {
    version: "0.10.2",
    date: "2026-07-03",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Dashboard net worth now updates immediately after a price refresh: the cached net-worth read is tagged with prices, so refreshing a watchlist stock you also hold no longer leaves the dashboard showing the old valuation.",
          "zh-CN":
            "刷新价格后，仪表板的净值现在会立即更新：净值的缓存读取已附带价格标记，因此刷新你同时持有的观察股票后，仪表板不再显示旧估值。",
          "zh-TW":
            "刷新價格後，儀表板的淨值現在會立即更新：淨值的快取讀取已加上價格標籤，因此刷新你同時持有的追蹤股票後，儀表板不會再顯示舊的估值。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The Analysis page no longer disagrees with the dashboard after an exchange-rate refresh: its bundled reads are now tagged with exchange-rates, so an FX refresh invalidates them instead of serving stale figures for up to five minutes.",
          "zh-CN":
            "汇率刷新后，分析页不再与仪表板数字不一致：其汇总的读取已附带汇率标记，因此汇率刷新会立即使其失效，而不是在最多五分钟内继续显示过期数字。",
          "zh-TW":
            "匯率刷新後，分析頁不會再與儀表板數字不一致：其彙整的讀取已加上匯率標籤，因此匯率刷新會立即使其失效，而不會在最多五分鐘內顯示過期的數字。",
        },
      },
    ],
  },
  {
    version: "0.10.1",
    date: "2026-07-03",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Analysis cash flow no longer misreads an account's opening deposit as a market loss: a deposit made in the same month as your first snapshot is no longer double-counted, so the first month's market performance and the Cumulative Growth chart stay accurate across the whole range.",
          "zh-CN":
            "分析页的现金流不再把账户的初始存款误判为市场亏损：与第一笔快照同月的存款不再被重复计算，因此第一个月的市场绩效与累计成长图表在整个区间都能保持正确。",
          "zh-TW":
            "分析頁的現金流不再把帳戶的初始存款誤判為市場虧損：與第一筆快照同月的存款不會再被重複計算，第一個月的市場績效與累積成長圖表在整個區間都能保持正確。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The Analysis category trend area chart no longer plunges to zero at a trailing month with no snapshot; the stacked area now breaks at empty months instead.",
          "zh-CN":
            "分析页的类别趋势区域图不再在没有快照的最后一个月骤降到零；堆叠区域现在会在空白月份中斷而不是归零。",
          "zh-TW":
            "分析頁的類別趨勢區域圖不會再在沒有快照的最後一個月驟降到零；堆疊區域現在會在空白月份中斷而非歸零。",
        },
      },
    ],
  },
  {
    version: "0.10.0",
    date: "2026-07-03",
    summary: {
      "en-US": "Backdate manual cash transactions to the day they actually happened.",
      "zh-CN": "手动现金交易可回填实际发生日期。",
      "zh-TW": "手動現金交易可回填實際發生日期。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Manual cash entries can now set an occurrence date: the balance editor gets a date field (defaults to today) and cash transactions can be re-dated when editing, so backdated deposits and withdrawals count toward the right month in Analysis.",
          "zh-CN":
            "手动现金记录现在可以设置发生日期：余额编辑器新增日期字段（默认为今天），编辑现金交易时也可调整日期，补登的存提款会计入分析页正确的月份。",
          "zh-TW":
            "手動現金紀錄現在可以設定發生日期：餘額編輯器新增日期欄位（預設為今天），編輯現金交易時也可調整日期，補登的存提款會計入分析頁正確的月份。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "The account transaction list now shows backdated cash entries under the day they occurred instead of the day they were entered.",
          "zh-CN": "账户交易列表现在会将补登的现金记录显示在实际发生日，而非输入日。",
          "zh-TW": "帳戶交易列表現在會將補登的現金紀錄顯示在實際發生日，而非輸入日。",
        },
      },
    ],
  },
  {
    version: "0.9.2",
    date: "2026-07-03",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Data export/import now preserves each transaction's occurrence date, so recurring and backdated entries keep their correct month in analysis after restoring a backup.",
          "zh-CN":
            "数据导出/导入现在会保留每笔交易的发生日期，还原备份后定期与补登的交易在分析中仍会落在正确的月份。",
          "zh-TW":
            "資料匯出／匯入現在會保留每筆交易的發生日期，還原備份後定期與補登的交易在分析中仍會落在正確的月份。",
        },
      },
    ],
  },
  {
    version: "0.9.1",
    date: "2026-07-02",
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Cash Flow, Cumulative Growth, and Attribution now bucket transactions by their actual occurrence date, so backdated deposits and withdrawals land in the right month.",
          "zh-CN":
            "现金流、累计成长与绩效归因现在按实际发生日期归类交易，补登的存提款会落在正确的月份。",
          "zh-TW":
            "現金流、累積成長與績效歸因現在依實際發生日期歸類交易，補登的存提款會落在正確的月份。",
        },
      },
    ],
  },
  {
    version: "0.9.0",
    date: "2026-07-02",
    summary: {
      "en-US": "Clearer, leaner Analysis charts, plus a cumulative growth view.",
      "zh-CN": "更清晰、更精简的分析图表，并新增累计成长视图。",
      "zh-TW": "更清晰、更精簡的分析圖表，並新增累積成長檢視。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "New Cumulative Growth chart in Analysis shows how much of your net-worth growth came from deposits vs. market gains over the selected range.",
          "zh-CN":
            "分析页新增“累计成长”图表，呈现所选期间内净资产增长有多少来自存入金额、多少来自市场收益。",
          "zh-TW":
            "分析頁新增「累積成長」圖表，呈現所選期間內淨資產成長有多少來自存入金額、多少來自市場收益。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Assets vs. Liabilities is now an area chart with a net-worth line, so the balance-sheet trend reads at a glance.",
          "zh-CN": "“资产与负债”改为带有净资产走势线的面积图，资产负债趋势一眼即懂。",
          "zh-TW": "「資產與負債」改為帶有淨資產走勢線的面積圖，資產負債趨勢一眼即懂。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Streamlined the Analysis tab: Cash Flow Decomposition now carries monthly movement, Category Trend became a stacked area, and the redundant Monthly Change and Top Movers panels were removed.",
          "zh-CN":
            "精简分析页：现金流分解图现在同时呈现每月变化、类别趋势改为堆叠面积图，并移除重复的每月变化与最大变动面板。",
          "zh-TW":
            "精簡分析頁：現金流分解圖現在同時呈現每月變化、類別趨勢改為堆疊面積圖，並移除重複的每月變化與最大變動面板。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The Cash Flow chart now shows the true monthly net change even when deposits and market movement pull in opposite directions.",
          "zh-CN": "即使存入金额与市场变动方向相反，现金流图表现在也能正确显示每月净变化。",
          "zh-TW": "即使存入金額與市場變動方向相反，現金流圖表現在也能正確顯示每月淨變化。",
        },
      },
    ],
  },
  {
    version: "0.8.8",
    date: "2026-07-02",
    summary: {
      "en-US": "Faster page loads through cached dashboard reads.",
      "zh-CN": "通过缓存仪表板读取，加快页面加载速度。",
      "zh-TW": "透過快取儀表板讀取，加快頁面載入速度。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "The dashboard, History, Analysis, and Projections pages now serve their remaining reads from cache, removing live database roundtrips from every page view.",
          "zh-CN":
            "仪表板、历史、分析与预测页剩余的读取现在改由缓存提供，每次浏览页面不再需要实时数据库往返。",
          "zh-TW":
            "儀表板、歷史、分析與預測頁面剩餘的讀取現在改由快取提供，每次瀏覽頁面不再需要即時資料庫往返。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Goal progress projections now read their snapshot history from cache, speeding up the dashboard milestone card and the Goals page.",
          "zh-CN": "目标进度预测现在从缓存读取快照历史，加快仪表板里程碑卡片与目标页的加载。",
          "zh-TW": "目標進度預測現在從快取讀取快照歷史，加快儀表板里程碑卡片與目標頁面的載入。",
        },
      },
    ],
  },
  {
    version: "0.8.7",
    date: "2026-06-24",
    summary: {
      "en-US": "Tidier Analysis tab on mobile.",
      "zh-CN": "移动端分析页更整洁。",
      "zh-TW": "行動版分析頁面更整潔。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "On mobile, the Analysis summary now shows the year-to-date headline up front and folds the range breakdown and methodology behind a tap, so the charts are reachable with less scrolling.",
          "zh-CN":
            "移动版的分析摘要现在优先显示今年至今的重点数字，并将区间明细与计算说明收起于点击之后，让图表更快可见、减少滚动。",
          "zh-TW":
            "行動版的分析摘要現在優先顯示今年迄今的重點數字，並將區間明細與計算說明收合於點按之後，讓圖表更快可見、減少捲動。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Refined spacing and heading hierarchy on the mobile Analysis tab so each section reads as its own group.",
          "zh-CN": "调整移动版分析页的间距与标题层级，让每个区段更像独立分组。",
          "zh-TW": "調整行動版分析頁面的間距與標題層級，讓每個區段更像獨立群組。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "The Analysis time-range selector no longer wraps onto two rows on small screens.",
          "zh-CN": "分析页的时间范围选择器在小屏幕上不再换成两行。",
          "zh-TW": "分析頁面的時間範圍選擇器在小螢幕上不再換成兩行。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US": "Muted helper text on the Analysis tab now meets WCAG AA contrast.",
          "zh-CN": "分析页的次要说明文字现已符合 WCAG AA 对比标准。",
          "zh-TW": "分析頁面的次要說明文字現已符合 WCAG AA 對比標準。",
        },
      },
    ],
  },
  {
    version: "0.8.6",
    date: "2026-06-21",
    summary: {
      "en-US": "Reliable browser error reporting via first-party Sentry tunnel.",
      "zh-CN": "通过第一方 Sentry 通道确保浏览器错误上报正常运行。",
      "zh-TW": "透過第一方 Sentry 通道確保瀏覽器錯誤回報正常運作。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Browser error reports now use a first-party tunnel so privacy tools such as Brave Shields no longer block them.",
          "zh-CN":
            "浏览器错误上报现在通过第一方通道传输，不再被 Brave Shields 等隐私防护工具阻止。",
          "zh-TW":
            "瀏覽器錯誤回報現在透過第一方通道傳送，不再被 Brave Shields 等隱私防護工具阻擋。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Google profile avatars now load when the PWA service worker is active, without triggering Content Security Policy errors.",
          "zh-CN":
            "PWA 服务工作者启用时，Google 个人头像现在可正常加载，不再触发内容安全策略错误。",
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
      "zh-CN": "浅色模式下移动端更清晰易读。",
      "zh-TW": "淺色模式下行動版更清晰易讀。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Gain, loss, and accent values now meet WCAG AA contrast in light mode — green and blue figures on cards are easier to read in bright light.",
          "zh-CN":
            "浅色模式下的涨跌与重点数值现已符合 WCAG AA 对比标准，卡片上的绿色与蓝色数字在强光下更易阅读。",
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
      "zh-CN": "修正侧边栏 Google 个人头像无法加载的问题。",
      "zh-TW": "修正側邊欄 Google 個人頭像無法載入的問題。",
    },
    changes: [
      {
        type: "fixed",
        text: {
          "en-US":
            "Sidebar avatar: Google profile pictures no longer fail to load (the request now omits the referrer that Google's image CDN was rejecting), and a broken avatar falls back to the version link instead of a broken-image icon.",
          "zh-CN":
            "侧边栏头像：Google 个人头像不再加载失败（请求不再带上 Google 图片 CDN 会拒绝的来源信息），并且头像加载失败时会改显示版本链接，而不是破损图标。",
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
      "zh-CN": "分析页更清晰，仪表板状态栏更简洁。",
      "zh-TW": "分析頁更清晰，儀表板狀態列更簡潔。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Analysis section headers now show the active time range (e.g. 'Movement — All') so the selected period is always visible as you scroll.",
          "zh-CN":
            "分析页各区段标题现在会显示当前时间范围（例如“变动 — 全部”），滚动时也能随时确认所选期间。",
          "zh-TW":
            "分析頁各區段標題現在會顯示當前時間範圍（例如「變動 — 全部」），捲動時也能隨時確認所選期間。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Replaced 'Fixed YTD baseline' and 'year-start baseline' with plain language: 'Year to date' and 'Latest snapshot vs. Jan 1'.",
          "zh-CN":
            "将“固定年初至今基线”等专业术语改为更直白的说法：“年初至今”及“最新快照 vs. 1 月 1 日”。",
          "zh-TW":
            "將「固定年初至今基準」等專業術語改為更直白的說法：「年初至今」及「最新快照 vs. 1月1日」。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Dashboard status bar: the snapshot badge now only appears when the daily cron has missed two or more cycles, keeping the bar quiet during normal operation.",
          "zh-CN":
            "仪表板状态栏：快照标签现在只在每日任务连续两次以上未执行时才出现，正常运行时不再占用空间。",
          "zh-TW":
            "儀表板狀態列：快照標籤現在只在每日排程連續兩次以上未執行時才出現，正常運作時不再佔用版面。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Sidebar privacy toggle now shows 'Hide' or 'Show' text next to the eye icon, making the control discoverable without hovering.",
          "zh-CN": "侧边栏隐私切换按钮现在在眼睛图标旁显示“隐藏”或“显示”文字，不需悬停也能一目了然。",
          "zh-TW": "側邊欄隱私切換按鈕現在在眼睛圖示旁顯示「Hide」或「Show」文字，不需滑鼠懸停也能一目了然。",
        },
      },
    ],
  },
  {
    version: "0.8.1",
    date: "2026-06-20",
    summary: {
      "en-US": "Clearer mobile navigation, analysis charts, and labels; settings desktop polish.",
      "zh-CN": "更清晰的移动端导航、分析图表与标签；设置页桌面端优化。",
      "zh-TW": "更清楚的行動版導覽、分析圖表與標籤；設定頁桌面版優化。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Mobile navigation: Goals, Watchlist, and Projections now live together under a single Plan tab.",
          "zh-CN": "移动端导航：目标、观察清单与预测整合于单一“计划”标签页。",
          "zh-TW": "行動版導覽：目標、自選股與財務預測整合於單一「計畫」分頁。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Analysis opens straight to its charts on mobile; History is no longer a separate tab inside Analysis.",
          "zh-CN": "移动端分析页直接显示图表；历史不再作为分析页中的独立标签页。",
          "zh-TW": "行動版分析頁直接顯示圖表；歷史紀錄不再是分析頁中的獨立分頁。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Sharper mobile labels: the header subtitle and activity-heatmap labels are larger and higher contrast.",
          "zh-CN": "移动端标签更清晰：页首副标题与活动热力图标签加大并提高对比。",
          "zh-TW": "行動版標籤更清晰：頁首副標與活動熱力圖標籤加大並提高對比。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Dashboard: removed the exchange-rate status chip to keep the freshness row focused on prices and snapshots.",
          "zh-CN": "仪表板：移除汇率更新状态标签，状态栏聚焦于价格与快照。",
          "zh-TW": "儀表板：移除匯率更新狀態標籤，狀態列聚焦於價格與快照。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Cash-flow chart: Contributions now has its own color, so it no longer reads as a downward move.",
          "zh-CN": "现金流图表：“净流入”改用独立颜色，不再与下跌的颜色混淆。",
          "zh-TW": "現金流圖表：「淨流入」改用獨立顏色，不再與下跌的顏色混淆。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "The Analysis loading placeholder now mirrors the page layout (section headings and chart cards), so content settles in place instead of shifting as it loads.",
          "zh-CN": "分析页加载骨架改为对应实际版面（区段标题与图表卡片），内容加载时不再跳动。",
          "zh-TW": "分析頁載入骨架改為對應實際版面（區段標題與圖表卡片），內容載入時不再跳動。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Settings now lays out in two columns on desktop instead of a single narrow column, so wide screens are no longer mostly empty space.",
          "zh-CN": "设置页在桌面改为双栏排版，不再是单一窄栏，宽屏不再留下大片空白。",
          "zh-TW": "設定頁在桌面改為雙欄排版，不再是單一窄欄，寬螢幕不再留下大片空白。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "On large monitors (1536px and wider) page content uses more of the available width instead of leaving wide side margins.",
          "zh-CN": "在大型屏幕（1536px 及以上）上，页面内容会利用更多可用宽度，不再留下宽边距。",
          "zh-TW": "在大型螢幕（1536px 以上）上，頁面內容會運用更多可用寬度，不再留下寬邊距。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Portfolio Composition treemap: the selection ring on a hovered tile now uses the tile's own color instead of a jarring near-black foreground stroke.",
          "zh-CN": "投资组合热图：鼠标悬停时的选区环线现在使用图块本身的颜色，不再显示突兀的深色边框。",
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
      "zh-CN": "更清爽的移动端页头，以及更直观的主题切换方式。",
      "zh-TW": "更清爽的行動版頁首，以及更直覺的主題切換方式。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Appearance control in Settings: pick Light, Dark, or System directly from the preferences page.",
          "zh-CN": "设置页新增“外观”选项：可直接选择浅色、深色或跟随系统。",
          "zh-TW": "設定頁新增「外觀」選項：可直接選擇淺色、深色或跟隨系統。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Mobile navigation: History is now a primary tab, and Settings lives in the header for quicker access.",
          "zh-CN": "移动端导航：历史改为主要标签页，设置移至页头以便快速打开。",
          "zh-TW": "行動版導覽：歷史改為主要分頁，設定移至頁首以便快速開啟。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "The mobile header theme switcher is now a single icon that opens a compact Light / Dark / System picker, easing header crowding.",
          "zh-CN":
            "移动端页头的主题切换改为单一图标，点击后展开浅色/深色/系统选项，减少页头拥挤。",
          "zh-TW":
            "行動版頁首的主題切換改為單一圖示，點擊後展開淺色／深色／系統選單，減少頁首壅擠。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "History activity heatmap now fades on both edges so it's clear you can scroll in either direction after it jumps to today.",
          "zh-CN": "历史活动热力图两侧都会淡出，滚动至今天后可清楚看出左右都可继续滚动。",
          "zh-TW": "歷史活動熱力圖兩側皆會淡出，捲動至今日後可清楚看出左右皆可繼續捲動。",
        },
      },
    ],
  },
  {
    version: "0.7.0",
    date: "2026-06-17",
    summary: {
      "en-US": "Snapshots can now carry the story behind the numbers.",
      "zh-CN": "快照现在可以记录数字背后的事件脉络。",
      "zh-TW": "快照現在可以記錄數字背後的事件脈絡。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Snapshot labels and notes: annotate major events, corrections, migrations, and other moments directly from History.",
          "zh-CN":
            "新增快照标签与备注：可在历史页直接标记重大事件、修正、账户迁移或其他关键时刻。",
          "zh-TW":
            "新增快照標籤與備註：可在歷史頁直接標記重大事件、修正、帳戶轉移或其他關鍵時刻。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "History now surfaces snapshot context in the ledger, trend chart tooltip, and activity heatmap tooltip, with privacy mode hiding annotation text.",
          "zh-CN":
            "历史页会在分类账、趋势图提示与活动热力图提示中显示快照脉络；隐私模式会隐藏标签与备注文字。",
          "zh-TW":
            "歷史頁會在分類帳、趨勢圖提示與活動熱力圖提示中顯示快照脈絡；隱私模式會隱藏標籤與備註文字。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Snapshot reconciliation warnings flag large drift between the latest snapshot and current reconstructed net worth without changing data automatically.",
          "zh-CN":
            "新增快照对账提醒：当最新快照与当前重建净值差异过大时提示用户，且不会自动修改数据。",
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
      "zh-CN": "定期与交易表单在手机上更贴近原生操作体验。",
      "zh-TW": "定期與交易表單在手機上更貼近原生操作體驗。",
    },
    changes: [
      {
        type: "improved",
        text: {
          "en-US":
            "Add/edit forms for recurring investments, recurring cash, and transactions now open as native bottom sheets on mobile with larger touch targets, and scroll instead of clipping on small screens.",
          "zh-CN":
            "定期投资、定期现金与交易的新增/编辑表单，在手机上改为原生底部弹出视图，并加大可点击区域；在小屏幕上可滚动而不會被裁切。",
          "zh-TW":
            "定期投資、定期現金與交易的新增／編輯表單，在手機上改以原生底部彈出視窗呈現，並加大可點擊範圍；在小螢幕上可捲動而不會被裁切。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US":
            "Long stock names no longer overflow and break the layout of the Add/Edit Recurring Investment dialog.",
          "zh-CN": "较长的股票名称不再溢出并破坏“新增/编辑定期投资”窗口的布局。",
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
      "zh-CN": "新增定期资金流入，并提供查看更新内容的页面。",
      "zh-TW": "新增定期資金流入，並提供查看更新內容的頁面。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Version history page with a release timeline, reachable from Settings and the command palette.",
          "zh-CN": "版本记录页面，以时间轴呈现各版本更新，可从设置或命令面板打开。",
          "zh-TW": "版本紀錄頁面，以時間軸呈現各版本更新，可從設定或指令面板開啟。",
        },
      },
      {
        type: "added",
        text: {
          "en-US":
            "Recurring cash transactions and dollar-cost-averaging investment plans, materialized automatically by the daily snapshot job.",
          "zh-CN": "定期现金交易与定期定额（DCA）投资计划，由每日快照任务自动生成。",
          "zh-TW": "定期現金交易與定期定額（DCA）投資計畫，由每日快照工作自動產生。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US":
            "Every dropdown now follows your display language after a Select localization sweep.",
          "zh-CN": "完成 Select 本地化校对后，所有下拉选单都会遵循显示语言。",
          "zh-TW": "完成 Select 在地化校對，所有下拉選單皆會依顯示語言呈現。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US": "A runtime guard now warns early when Node is too old to run the dev server.",
          "zh-CN": "新增 Node 版本检查，运行环境过旧时会在启动开发服务器前提早警告。",
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
          "zh-CN": "搜索代码时 Yahoo Finance 的 4xx 响应视为预期情况，不再以错误上报至 Sentry。",
          "zh-TW": "搜尋代號時 Yahoo Finance 的 4xx 回應視為預期狀況，不再以錯誤回報至 Sentry。",
        },
      },
      {
        type: "fixed",
        text: {
          "en-US": "Recovered Frankfurter exchange-rate misses no longer report as Sentry errors.",
          "zh-CN": "已恢复的 Frankfurter 汇率缺失不再上报为 Sentry 错误。",
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
          "zh-CN": "工具链由 npm 迁移至 pnpm，采用内容寻址存储，安装更快、体积更小。",
          "zh-TW": "工具鏈由 npm 遷移至 pnpm，採用內容定址儲存，安裝更快、體積更小。",
        },
      },
      {
        type: "improved",
        text: {
          "en-US": "Moved dev-only packages to devDependencies to slim production installs.",
          "zh-CN": "将仅供开发使用的包移至 devDependencies，精简正式环境安装。",
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
      "zh-CN": "设定目标，把握偏离。",
      "zh-TW": "設定目標，掌握偏離。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US":
            "Target allocation with rebalance drift alerts: set targets in Settings, track drift in Analysis, get nudges on the Dashboard.",
          "zh-CN": "目标配置与再平衡偏离提醒：于设置中设定目标、在分析页追踪偏离、于仪表板获取提醒。",
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
          "zh-CN": "分析页新增账户层级的绩效归因，区分市场波动与现金投入。",
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
          "zh-CN": "净值目标与里程碑，并提供进度追踪。",
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
      "zh-CN": "首次发布。",
      "zh-TW": "首次發布。",
    },
    changes: [
      {
        type: "added",
        text: {
          "en-US": "Accounts, holdings, and transactions with multi-currency net worth.",
          "zh-CN": "账户、持仓与交易，支持多币种净值。",
          "zh-TW": "帳戶、持有部位與交易，支援多幣別淨值。",
        },
      },
      {
        type: "added",
        text: {
          "en-US": "Daily snapshots and net worth history that renormalizes to your base currency.",
          "zh-CN": "每日快照与净值历史，并换算为你的基准货币。",
          "zh-TW": "每日快照與淨值歷史，並換算為你的基準貨幣。",
        },
      },
      {
        type: "added",
        text: {
          "en-US": "Live prices from Yahoo Finance with a CoinGecko crypto fallback.",
          "zh-CN": "来自 Yahoo Finance 的实时报价，加密货币以 CoinGecko 备用。",
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
