# Vercel Firewall Setup (P2)

Companion to `docs/firewall_rules.json`. Hobby plan allows **3 custom firewall rules**; the rule set below is consolidated to fit that cap. Rules 1 and 2 overlap intentionally (e.g. `/wp-admin/install.php` matches both) — the firewall short-circuits on first match, so duplication is harmless and gives redundant coverage.

Two paths to install: dashboard or REST API.

## A. Dashboard (recommended for first-time setup)

1. Open https://vercel.com/mike840609s-projects/asset-tracker/settings/firewall
2. Under **Custom Rules**, click **New Rule** and create each entry below in order.

### Rule 1 — `block-extensions-and-dotfiles`

- **If**: Path, Matches Regex, value: `\.(php|aspx?|jsp|cgi|env|git|svn|htaccess|htpasswd)($|\?|/)`
- **Then**: Deny (403)
- **Why**: Broadest single rule. Catches `/wp-admin/install.php`, `/xmlrpc.php`, any `*.php`/`*.asp`/`*.aspx`/`*.jsp`/`*.cgi`, `/.env`, `/.git/config`, `/.svn/...`, `/.htaccess`, `/.htpasswd`. The app is Next.js — none of those extensions are legitimate routes.

### Rule 2 — `block-bot-prefixes`

- **If**: Path, Matches Regex, value: `^/(wp-admin|wp-login|wp-content|wp-includes|wordpress|xmlrpc|cmd_|phpmyadmin|pma|adminer|vendor/phpunit|cgi-bin)`
- **Then**: Deny (403)
- **Why**: Catches what doesn't end in a tell-tale extension. `/cmd_sco` (observed 2026-05-17), `/wp-admin/`, `/wp-content/uploads/...`, `/phpmyadmin/`, `/adminer.php`, `/vendor/phpunit/...` would not be caught by rule 1 alone.

### Rule 3 — `rate-limit-public-pages`

- **If**: Path, Matches Regex, value: `^/(login|privacy|terms)$` **AND** Method, Equals, value: `GET`
- **Then**: Rate Limit — **30 requests / 60 seconds per IP**
- **Why**: Addresses the 5×/sec `/privacy` bursts observed in the 2026-05-17 logs (a scraper grabbing sub-resources per page load) without blocking humans. 30 / 60s is well above any real user pattern.

Rules apply immediately on the edge — no deploy needed.

## B. REST API (for repeatable / scripted setup)

```bash
# Requires a Vercel token with Firewall scope.
export VERCEL_TOKEN=...   # never commit this
export TEAM_ID=team_ImEsp9hzYaqzaPz5VmE6LTiW
export PROJECT_ID=prj_soY30S7ki1x38gmeZXCancJD1PVA

# The Vercel REST docs describe the exact wire-format expected by the
# firewall config endpoint:
#   https://vercel.com/docs/rest-api/reference/endpoints/security
# The JSON in this repo is the conceptual spec, not the wire-format —
# you may need to transform `conditionGroup`/`action` to match the
# current API schema before POSTing.
curl -X POST "https://api.vercel.com/v1/security/firewall/config?teamId=${TEAM_ID}&projectId=${PROJECT_ID}" \
  -H "Authorization: Bearer ${VERCEL_TOKEN}" \
  -H "Content-Type: application/json" \
  --data-binary @docs/firewall_rules.json
```

## Verification

After applying, wait ~2 min for edge propagation then:

```bash
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/wp-admin/install.php  # 403 (rules 1 & 2)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/cmd_sco                # 403 (rule 2)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/.env                   # 403 (rule 1)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/xmlrpc.php             # 403 (rules 1 & 2)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/anything.php           # 403 (rule 1)
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/login                  # 200
curl -s -o /dev/null -w "%{http_code}\n" https://astt.app/                        # 302 (redirects to /login)
```

Then inspect:

- Dashboard → Project → Firewall → Logs — confirm those paths show as **Denied**.
- MCP runtime logs: `mcp__claude_ai_Vercel__get_runtime_logs source=["edge-middleware"] since=1d` — those paths should no longer appear (firewall is upstream of middleware).
- Track the resulting Active-CPU drop in Vercel → Project → Usage and record in `docs/LOG.md`.

## Drift management

The dashboard is the source of truth at runtime, but `firewall_rules.json` is the **review-able spec**. After any dashboard change, re-export and commit so the repo stays in sync. The `description` field on each rule is the trail explaining why it exists — keep it current.

If you need a 4th rule later (Pro plan or above), revisit the deleted rules from the original 5-rule draft (see git history for `firewall_rules.json`): a split `block-wordpress-probes` (rule 1 of the original) and a split `block-dotfile-and-source-probes` (rule 2 of the original) are good candidates to break out for clearer reporting.
