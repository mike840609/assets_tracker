# astt

[![CI](https://github.com/mike840609/assets_tracker/actions/workflows/ci.yml/badge.svg)](https://github.com/mike840609/assets_tracker/actions/workflows/ci.yml)
[![E2E](https://github.com/mike840609/assets_tracker/actions/workflows/e2e.yml/badge.svg?branch=master&event=push)](https://github.com/mike840609/assets_tracker/actions/workflows/e2e.yml?query=branch%3Amaster+event%3Apush)
[![Release](https://img.shields.io/github/v/release/mike840609/assets_tracker)](https://github.com/mike840609/assets_tracker/releases/latest)
[![GHCR](https://img.shields.io/badge/GHCR-container-blue?logo=docker)](https://github.com/mike840609/assets_tracker/pkgs/container/assets_tracker)
[![License: MIT](https://img.shields.io/badge/license-MIT-blue.svg)](./LICENSE)
[![PRs welcome](https://img.shields.io/badge/PRs-welcome-brightgreen.svg)](./CONTRIBUTING.md)
[![Ask DeepWiki](https://deepwiki.com/badge.svg)](https://deepwiki.com/mike840609/assets_tracker)

[English](./README.md) | [繁體中文](./README.zh-TW.md)

**開源、可自行部署的淨資產與投資組合追蹤工具。**

支援多幣別，讓你集中追蹤淨資產、投資、現金、不動產、負債與長期財務目標，同時保有自己的資料控制權。

> 原名 Assets Tracker，同一個專案，現以 **astt** 為品牌名。

[線上展示](https://astt.app) · [快速開始](#快速開始) · [用 AI 安裝](#用-ai-安裝) · [文件](#文件) · [安全政策](./SECURITY.md) · [參與貢獻](./CONTRIBUTING.md)

![astt 桌面與行動版儀表板](./public/readme-hero.jpg)

## 為什麼選擇 astt？

- **資料由你掌握** — 可透過 Docker 與 PostgreSQL 自行部署，或使用 Vercel 與 Neon。
- **統一財務視圖** — 整合銀行、券商、加密錢包、不動產、負債與選擇權部位。
- **原生多幣別支援** — 保留原始餘額與幣別，並用偏好的基準幣別查看歷史資料。
- **即時市場資料** — 從支援的資料來源更新股票、ETF、加密貨幣、選擇權與匯率。
- **規劃與自動化** — 支援定期收支、定期投資、每日快照、財務目標與 FIRE 推估。
- **桌面與行動裝置** — 響應式介面、主題、英文／繁體中文與可安裝 PWA。

## 操作展示

<table>
  <tr>
    <th width="70%">桌面版</th>
    <th width="30%">行動版</th>
  </tr>
  <tr>
    <td><img src="./public/readme-demo-desktop.gif" alt="astt 桌面版儀表板操作展示"></td>
    <td><img src="./public/readme-demo-mobile.png" alt="astt 行動版儀表板"></td>
  </tr>
</table>

## 快速開始

正式自行部署可直接使用 Docker Compose：

```bash
./scripts/setup-env.sh   # 產生 .env 與各項 secret
docker compose --profile full up --no-build -d
```

腳本會印出登入用的密碼。它不會覆寫既有的 `.env`；只要任一 secret 仍是
`.env.example` 的佔位字串，應用就不會啟動。

環境變數、HTTPS、備份、升級、Vercel + Neon 與其他正式部署細節，請見[部署與自行託管](./docs/DEPLOYMENT.md)。

想在本機開發 astt？請見[開發流程](./docs/DEVELOPMENT.md)。

## 用 AI 安裝

想把安裝交給 AI coding agent？把以下 prompt 貼給你的 agent：

> 請依循指南安裝 astt：https://raw.githubusercontent.com/mike840609/assets_tracker/master/docs/INSTALL_WITH_AI.md

指南涵蓋本機開發與正式自行部署。

## 工具比較

<details>
<summary><b>astt 與 Ghostfolio、Firefly III、Actual Budget 的比較</b></summary>

astt 專注於淨值與投資追蹤。若你主要需要複式記帳或信封預算，[Firefly III](https://github.com/firefly-iii/firefly-iii) 與 [Actual Budget](https://github.com/actualbudget/actual) 是很好的選擇——以下是各工具的定位：

|                                     | astt              | [Ghostfolio](https://github.com/ghostfolio/ghostfolio) | [Firefly III](https://github.com/firefly-iii/firefly-iii) | [Actual Budget](https://github.com/actualbudget/actual) |
| ----------------------------------- | ----------------- | ------------------------------------------------------ | --------------------------------------------------------- | ------------------------------------------------------- |
| 主要定位                            | 淨值＋投資        | 投資組合                                               | 記帳與預算                                                | 信封預算                                                |
| 即時市場資料（股票、ETF、加密貨幣） | ✅                | ✅                                                     | —                                                         | —                                                       |
| 選擇權部位                          | ✅                | —                                                      | —                                                         | —                                                       |
| 多幣別帳戶與歷史                    | ✅                | ✅                                                     | ✅                                                        | —                                                       |
| 定期規則                            | ✅ 現金＋定期定額 | —                                                      | ✅ 現金                                                   | ✅ 現金                                                 |
| 目標與 FIRE 推估                    | ✅                | ✅                                                     | —                                                         | —                                                       |
| 預算／複式記帳                      | —                 | —                                                      | ✅                                                        | ✅                                                      |
| 授權條款                            | MIT               | AGPL-3.0                                               | AGPL-3.0                                                  | MIT                                                     |

<sub>整理自各專案 2026 年 7 月的公開文件——最新功能請以各專案官網為準。</sub>

</details>

## 文件

- [使用 AI 代理安裝](./docs/INSTALL_WITH_AI.md)
- [部署與自行託管](./docs/DEPLOYMENT.md)
- [開發流程](./docs/DEVELOPMENT.md)
- [架構說明](./docs/ARCHITECTURE.md)
- [資料庫與 migrations](./docs/DATABASE.md)
- [CI 政策](./docs/CI.md)
- [版本管理](./docs/VERSIONING.md)
- [環境變數參考](./.env.example)

## 支援與安全性

可透過 [GitHub Issues](https://github.com/mike840609/assets_tracker/issues) 回報可重現的錯誤或提出功能需求。安全漏洞請依照[安全政策](./SECURITY.md)私下回報。

## 資料責任

astt 是個人財務追蹤軟體，不構成財務、稅務或投資建議。自行部署者需自行負責部署環境、資料、備份、憑證與存取控制的安全。

## 授權

本專案採用 [MIT License](./LICENSE)，© 2026 Mike Tsai。
