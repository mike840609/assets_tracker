#!/usr/bin/env node

const API_BASE_URL = process.env.SENTRY_API_BASE_URL ?? "https://sentry.io";
const DASHBOARD_TITLE = "Assets Tracker - Production Health";
const APPLY = process.argv.includes("--apply");

const requiredEnv = ["SENTRY_AUTH_TOKEN", "SENTRY_ORG", "SENTRY_PROJECT"];

function requireEnv() {
  const missing = requiredEnv.filter((key) => !process.env[key]);
  if (missing.length > 0) {
    throw new Error(`Missing required env vars: ${missing.join(", ")}`);
  }
}

function apiPath(path) {
  return `${API_BASE_URL.replace(/\/$/, "")}/api/0${path}`;
}

async function sentryFetch(path, init = {}) {
  const res = await fetch(apiPath(path), {
    ...init,
    headers: {
      Authorization: `Bearer ${process.env.SENTRY_AUTH_TOKEN}`,
      "Content-Type": "application/json",
      ...(init.headers ?? {}),
    },
  });

  const text = await res.text();
  const body = text ? JSON.parse(text) : null;
  if (!res.ok) {
    throw new Error(`${init.method ?? "GET"} ${path} failed (${res.status}): ${text}`);
  }
  return body;
}

function listFromResponse(body) {
  if (Array.isArray(body)) return body;
  if (Array.isArray(body?.results)) return body.results;
  return [];
}

function getAlertActions() {
  if (process.env.SENTRY_ALERT_ACTIONS_JSON) {
    const parsed = JSON.parse(process.env.SENTRY_ALERT_ACTIONS_JSON);
    if (!Array.isArray(parsed)) {
      throw new Error("SENTRY_ALERT_ACTIONS_JSON must be a JSON array.");
    }
    return parsed;
  }

  if (process.env.SENTRY_ALERT_USER_ID) {
    return [
      {
        type: "email",
        targetType: "user",
        targetIdentifier: process.env.SENTRY_ALERT_USER_ID,
      },
    ];
  }

  if (process.env.SENTRY_ALERT_TEAM_ID) {
    return [
      {
        type: "email",
        targetType: "team",
        targetIdentifier: process.env.SENTRY_ALERT_TEAM_ID,
      },
    ];
  }

  return [];
}

function dashboardWidget(spec, layout) {
  const { title, displayType, fields, conditions, widgetType = "error-events" } = spec;
  return {
    title,
    displayType,
    // Sentry defaults un-typed widgets to the errors dataset; p95(transaction.duration)
    // only resolves on the transactions dataset, so latency widgets must opt out.
    widgetType,
    interval: "5m",
    limit: 10,
    layout: {
      minH: layout.h,
      ...layout,
    },
    queries: [
      {
        name: "",
        fields,
        columns: fields.filter((field) => !field.includes("(")),
        aggregates: fields.filter((field) => field.includes("(")),
        conditions,
        limit: 10,
        orderby: fields.includes("count()") ? "-count()" : "",
      },
    ],
  };
}

// Row-based two-column layout on Sentry's 6-col grid (each widget is half-width).
// Widgets are paired in declaration order; both cells in a row share the same y
// and a uniform height (the taller of the pair), so the left and right columns
// stay aligned row-for-row. A trailing odd widget sits alone in the left column.
// Height: big_number widgets are kept at 2 so their auto-scaled font matches
// across KPIs; a spec may set an explicit `h` to share a KPI row (see below).
const widgetHeight = (spec) => spec.h ?? (spec.displayType === "big_number" ? 2 : 3);

function layoutWidgets(specs) {
  const widgets = [];
  let y = 0;
  for (let i = 0; i < specs.length; i += 2) {
    const row = specs.slice(i, i + 2);
    const rowH = Math.max(...row.map(widgetHeight));
    row.forEach((spec, col) => {
      widgets.push(dashboardWidget(spec, { x: col * 3, y, w: 3, h: rowH }));
    });
    y += rowH;
  }
  return widgets;
}

// The full set documented in docs/SENTRY_MONITORING_PLAN.md "Recommended layout".
// Order follows the plan's reading order; layoutWidgets() places them two-per-row.
const WIDGET_SPECS = [
  {
    title: "Production errors",
    displayType: "big_number",
    fields: ["count()"],
    conditions: "level:error",
  },
  {
    title: "Affected users",
    displayType: "big_number",
    fields: ["count_unique(user)"],
    conditions: "level:error",
  },
  {
    title: "Latest release errors",
    displayType: "big_number",
    fields: ["count()"],
    conditions: "level:error release:latest",
  },
  // Only populated when SENTRY_CAPTURE_WARNINGS=true forwards warnings as events.
  // h:2 keeps it level with the "Latest release errors" KPI it shares a row with,
  // so that big-number stays at height 2 and renders the same font as the others.
  {
    title: "Warning volume",
    displayType: "area",
    fields: ["count()"],
    conditions: "level:warning",
    h: 2,
  },
  {
    title: "Errors by route",
    displayType: "table",
    fields: ["transaction", "count()"],
    conditions: "level:error",
  },
  {
    title: "Errors by release",
    displayType: "table",
    fields: ["release", "count()"],
    conditions: "level:error",
  },
  {
    title: "Errors by runtime",
    displayType: "table",
    fields: ["runtime", "count()"],
    conditions: "level:error",
  },
  {
    title: "Cron failures",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"cron.snapshot.failed" OR message:"cron.snapshot.audit_failed"',
  },
  {
    title: "DB failures",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"health.db_unreachable" OR error.type:*Prisma*',
  },
  {
    title: "Import/export failures",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"export.failed" OR message:"import.failed"',
  },
  {
    title: "Market providers",
    displayType: "table",
    fields: ["message", "count()"],
    conditions:
      'message:"price.yahoo.*" OR message:"price.coingecko.failed" OR message:"rates.fetch.failed"',
  },
  {
    title: "FX unresolved pairs",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"rates.unresolved"',
  },
  {
    title: "Slow Prisma operations",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"prisma.slow_query"',
  },
  {
    title: "Browser render errors",
    displayType: "table",
    fields: ["transaction", "browser.name", "release", "count()"],
    conditions: "level:error runtime:browser",
  },
  {
    title: "Navigation/chunk errors",
    displayType: "table",
    fields: ["transaction", "count()"],
    conditions: "runtime:browser error.type:ChunkLoadError",
  },
  {
    title: "CSP violations",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"csp.violation"',
  },
  // p95 widgets use the spans dataset (the transactions dataset is deprecated in
  // Sentry EAP) filtered to transaction-root spans, and need tracing enabled
  // (SENTRY_TRACES_SAMPLE_RATE > 0 — Plan Phase 4). They render empty until then.
  {
    title: "Backend p95 latency",
    displayType: "line",
    fields: ["transaction", "p95(span.duration)"],
    conditions:
      "is_transaction:true (transaction:/api/health OR transaction:/api/refresh OR transaction:/api/cron/snapshot)",
    widgetType: "spans",
  },
  {
    title: "Page p95 latency",
    displayType: "line",
    fields: ["transaction", "p95(span.duration)"],
    conditions:
      "is_transaction:true (transaction:/ OR transaction:/accounts OR transaction:/accounts/* OR transaction:/analysis OR transaction:/history)",
    widgetType: "spans",
  },
  {
    title: "CWV budget misses",
    displayType: "table",
    fields: ["message", "count()"],
    conditions: 'message:"cwv.budget_exceeded"',
  },
];

function dashboardPayload(projectId) {
  return {
    title: DASHBOARD_TITLE,
    projects: [Number(projectId)],
    environment: ["production"],
    period: "24h",
    utc: true,
    is_favorited: true,
    widgets: layoutWidgets(WIDGET_SPECS),
  };
}

function metricAlertPayloads(projectSlug, actions = []) {
  return [
    {
      name: "Assets Tracker - Production error spike",
      aggregate: "count()",
      query: "level:error",
      timeWindow: 5,
      threshold: 10,
    },
    {
      name: "Assets Tracker - API error spike",
      aggregate: "count()",
      query: "level:error transaction:/api/*",
      timeWindow: 10,
      threshold: 5,
    },
    {
      name: "Assets Tracker - Cron snapshot failed",
      aggregate: "count()",
      query: 'message:"cron.snapshot.failed"',
      timeWindow: 5,
      threshold: 0,
    },
    {
      name: "Assets Tracker - DB unreachable",
      aggregate: "count()",
      query: 'message:"health.db_unreachable"',
      timeWindow: 5,
      threshold: 0,
    },
  ].map((rule) => ({
    name: rule.name,
    projects: [projectSlug],
    environment: "production",
    dataset: "events",
    queryType: 0,
    aggregate: rule.aggregate,
    query: rule.query,
    timeWindow: rule.timeWindow,
    thresholdType: 0,
    resolveThreshold: 0,
    triggers: [
      {
        label: "critical",
        alertThreshold: rule.threshold,
        actions,
      },
    ],
  }));
}

async function getExistingDashboard(org) {
  const dashboards = listFromResponse(await sentryFetch(`/organizations/${org}/dashboards/`));
  return dashboards.find((dashboard) => dashboard.title === DASHBOARD_TITLE);
}

async function getExistingMetricAlerts(org) {
  return listFromResponse(await sentryFetch(`/organizations/${org}/alert-rules/`));
}

async function main() {
  if (!APPLY) {
    console.log(
      "Dry run. Re-run with --apply after setting SENTRY_AUTH_TOKEN, SENTRY_ORG, and SENTRY_PROJECT.",
    );
    console.log(
      JSON.stringify(
        { dashboardTitle: DASHBOARD_TITLE, metricAlerts: metricAlertPayloads("<project>") },
        null,
        2,
      ),
    );
    return;
  }

  requireEnv();
  const org = process.env.SENTRY_ORG;
  const project = process.env.SENTRY_PROJECT;
  const alertActions = getAlertActions();

  const projectInfo = await sentryFetch(`/projects/${org}/${project}/`);
  const existingDashboard = await getExistingDashboard(org);
  // PUT replaces the existing dashboard's widget set with the current spec (the
  // widgets carry no id, so Sentry recreates them); POST creates it on first run.
  // Without the update branch a re-run would no-op against a stale dashboard.
  const dashboard = existingDashboard
    ? await sentryFetch(`/organizations/${org}/dashboards/${existingDashboard.id}/`, {
        method: "PUT",
        body: JSON.stringify(dashboardPayload(projectInfo.id)),
      })
    : await sentryFetch(`/organizations/${org}/dashboards/`, {
        method: "POST",
        body: JSON.stringify(dashboardPayload(projectInfo.id)),
      });

  const alertResults = [];
  if (alertActions.length === 0) {
    console.warn("Skipping metric alerts because no alert action was configured.");
    console.warn(
      "Set SENTRY_ALERT_USER_ID, SENTRY_ALERT_TEAM_ID, or SENTRY_ALERT_ACTIONS_JSON to create alert rules.",
    );
  } else {
    const existingAlerts = await getExistingMetricAlerts(org);
    for (const payload of metricAlertPayloads(project, alertActions)) {
      const existingAlert = existingAlerts.find((rule) => rule.name === payload.name);
      alertResults.push(
        existingAlert ??
          (await sentryFetch(`/organizations/${org}/alert-rules/`, {
            method: "POST",
            body: JSON.stringify(payload),
          })),
      );
    }
  }

  console.log(
    JSON.stringify(
      {
        dashboard: { id: dashboard.id, title: dashboard.title },
        metricAlerts: alertResults.map((rule) => ({ id: rule.id, name: rule.name })),
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
