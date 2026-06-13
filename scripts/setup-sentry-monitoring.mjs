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

function dashboardWidget(title, displayType, fields, conditions, layout) {
  return {
    title,
    displayType,
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

function dashboardPayload(projectId) {
  return {
    title: DASHBOARD_TITLE,
    projects: [Number(projectId)],
    environment: ["production"],
    period: "24h",
    utc: true,
    is_favorited: true,
    widgets: [
      dashboardWidget("Production errors", "big_number", ["count()"], "level:error", {
        x: 0,
        y: 0,
        w: 3,
        h: 2,
      }),
      dashboardWidget("Affected users", "big_number", ["count_unique(user)"], "level:error", {
        x: 3,
        y: 0,
        w: 3,
        h: 2,
      }),
      dashboardWidget("Errors by route", "table", ["transaction", "count()"], "level:error", {
        x: 0,
        y: 2,
        w: 3,
        h: 3,
      }),
      dashboardWidget("Errors by release", "table", ["release", "count()"], "level:error", {
        x: 3,
        y: 2,
        w: 3,
        h: 3,
      }),
      dashboardWidget(
        "Cron failures",
        "table",
        ["message", "count()"],
        'message:"cron.snapshot.failed" OR message:"cron.snapshot.audit_failed"',
        { x: 0, y: 5, w: 3, h: 3 },
      ),
      dashboardWidget(
        "DB failures",
        "table",
        ["message", "count()"],
        'message:"health.db_unreachable" OR error.type:*Prisma*',
        { x: 3, y: 5, w: 3, h: 3 },
      ),
      dashboardWidget(
        "Market providers",
        "table",
        ["message", "count()"],
        'message:"price.yahoo.*" OR message:"price.coingecko.failed" OR message:"rates.fetch.failed"',
        { x: 0, y: 8, w: 3, h: 3 },
      ),
      dashboardWidget(
        "Browser render errors",
        "table",
        ["transaction", "browser.name", "count()"],
        "runtime:browser",
        {
          x: 3,
          y: 8,
          w: 3,
          h: 3,
        },
      ),
      dashboardWidget(
        "Backend p95 latency",
        "line",
        ["p95(transaction.duration)", "transaction"],
        "transaction:/api/health OR transaction:/api/refresh OR transaction:/api/cron/snapshot",
        { x: 0, y: 11, w: 3, h: 3 },
      ),
      dashboardWidget(
        "Page p95 latency",
        "line",
        ["p95(transaction.duration)", "transaction"],
        "transaction:/ OR transaction:/accounts OR transaction:/accounts/* OR transaction:/analysis OR transaction:/history",
        { x: 3, y: 11, w: 3, h: 3 },
      ),
    ],
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
  const dashboard =
    existingDashboard ??
    (await sentryFetch(`/organizations/${org}/dashboards/`, {
      method: "POST",
      body: JSON.stringify(dashboardPayload(projectInfo.id)),
    }));

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
