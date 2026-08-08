import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";

type DemoPolicy = "allow" | "deny" | "market-refresh";
type MarketDataPolicy = "refresh-credit";

const expectedPolicies: Record<string, Record<string, DemoPolicy>> = {
  "src/app/api/accounts/[id]/cash-transactions/route.ts": { POST: "allow" },
  "src/app/api/accounts/[id]/holdings/route.ts": {
    DELETE: "allow",
    GET: "allow",
    PATCH: "allow",
    POST: "allow",
  },
  "src/app/api/accounts/[id]/recurring-cash-transactions/[recurringId]/route.ts": {
    DELETE: "allow",
    PATCH: "allow",
  },
  "src/app/api/accounts/[id]/recurring-cash-transactions/route.ts": {
    GET: "allow",
    POST: "allow",
  },
  "src/app/api/accounts/[id]/recurring-investments/[recurringId]/route.ts": {
    DELETE: "allow",
    PATCH: "allow",
  },
  "src/app/api/accounts/[id]/recurring-investments/route.ts": {
    GET: "allow",
    POST: "allow",
  },
  "src/app/api/accounts/[id]/route.ts": {
    DELETE: "allow",
    GET: "allow",
    PATCH: "allow",
  },
  "src/app/api/accounts/[id]/transactions/[transactionId]/route.ts": {
    DELETE: "allow",
    PATCH: "allow",
  },
  "src/app/api/accounts/[id]/transactions/route.ts": { GET: "allow" },
  "src/app/api/accounts/reorder/route.ts": { PATCH: "allow" },
  "src/app/api/accounts/route.ts": { DELETE: "allow", GET: "allow", POST: "allow" },
  "src/app/api/calendar-entries/[id]/route.ts": { DELETE: "allow", PATCH: "allow" },
  "src/app/api/calendar-entries/route.ts": { GET: "allow", POST: "allow" },
  "src/app/api/goals/[id]/route.ts": { DELETE: "allow", PATCH: "allow" },
  "src/app/api/goals/reorder/route.ts": { PATCH: "allow" },
  "src/app/api/goals/route.ts": { GET: "allow", POST: "allow" },
  "src/app/api/refresh/route.ts": { POST: "market-refresh" },
  "src/app/api/settings/data/route.ts": { GET: "deny", POST: "deny" },
  "src/app/api/settings/route.ts": { GET: "allow", PATCH: "allow" },
  "src/app/api/snapshots/[id]/route.ts": { PATCH: "allow" },
  "src/app/api/snapshots/route.ts": { GET: "allow" },
  "src/app/api/stocks/[id]/route.ts": { DELETE: "allow", PATCH: "allow" },
  "src/app/api/stocks/quote/route.ts": { GET: "allow" },
  "src/app/api/stocks/refresh/route.ts": { POST: "market-refresh" },
  "src/app/api/stocks/reorder/route.ts": { PATCH: "allow" },
  "src/app/api/stocks/route.ts": { GET: "allow", POST: "allow" },
};

function routeFiles(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) return routeFiles(path);
    return entry.name === "route.ts" ? [path] : [];
  });
}

function readPolicies(path: string): Record<string, DemoPolicy | undefined> | undefined {
  const source = readFileSync(path, "utf8");
  if (!source.includes('from "@/lib/api-handler"')) return undefined;

  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const policies: Record<string, DemoPolicy | undefined> = {};
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !/^(GET|POST|PATCH|DELETE|PUT)$/.test(declaration.name.text)
      ) {
        continue;
      }
      const initializer = declaration.initializer;
      if (!initializer || !ts.isCallExpression(initializer)) continue;
      if (!ts.isIdentifier(initializer.expression) || initializer.expression.text !== "withAuth")
        continue;
      const options = initializer.arguments[1];
      if (!options || !ts.isObjectLiteralExpression(options)) {
        policies[declaration.name.text] = undefined;
        continue;
      }
      const demo = options.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          ((ts.isIdentifier(property.name) && property.name.text === "demo") ||
            (ts.isStringLiteral(property.name) && property.name.text === "demo")),
      );
      policies[declaration.name.text] =
        demo && ts.isStringLiteral(demo.initializer)
          ? (demo.initializer.text as DemoPolicy)
          : undefined;
    }
  }
  return policies;
}

function readMarketDataPolicies(
  path: string,
): Record<string, MarketDataPolicy | undefined> | undefined {
  const source = readFileSync(path, "utf8");
  if (!source.includes('from "@/lib/api-handler"')) return undefined;

  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  const policies: Record<string, MarketDataPolicy | undefined> = {};
  for (const statement of sourceFile.statements) {
    if (!ts.isVariableStatement(statement)) continue;
    if (!statement.modifiers?.some((modifier) => modifier.kind === ts.SyntaxKind.ExportKeyword)) {
      continue;
    }
    for (const declaration of statement.declarationList.declarations) {
      if (
        !ts.isIdentifier(declaration.name) ||
        !/^(GET|POST|PATCH|DELETE|PUT)$/.test(declaration.name.text)
      ) {
        continue;
      }
      const initializer = declaration.initializer;
      if (!initializer || !ts.isCallExpression(initializer)) continue;
      if (!ts.isIdentifier(initializer.expression) || initializer.expression.text !== "withAuth") {
        continue;
      }
      const options = initializer.arguments[1];
      if (!options || !ts.isObjectLiteralExpression(options)) continue;
      const marketData = options.properties.find(
        (property): property is ts.PropertyAssignment =>
          ts.isPropertyAssignment(property) &&
          ((ts.isIdentifier(property.name) && property.name.text === "marketData") ||
            (ts.isStringLiteral(property.name) && property.name.text === "marketData")),
      );
      if (marketData && ts.isStringLiteral(marketData.initializer)) {
        policies[declaration.name.text] = marketData.initializer.text as MarketDataPolicy;
      }
    }
  }
  return policies;
}

function readFunction(path: string, functionName: string): string {
  const source = readFileSync(path, "utf8");
  const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
  let match: ts.FunctionDeclaration | undefined;
  const visit = (node: ts.Node) => {
    if (ts.isFunctionDeclaration(node) && node.name?.text === functionName) match = node;
    if (!match) ts.forEachChild(node, visit);
  };
  visit(sourceFile);
  if (!match) throw new Error(`Missing cached reader ${functionName} in ${path}`);
  return match.getText(sourceFile);
}

describe("public Demo route policy", () => {
  it("declares the exact policy for every withAuth route export", () => {
    const actual = Object.fromEntries(
      routeFiles(join(process.cwd(), "src/app/api"))
        .map((path) => [relative(process.cwd(), path), readPolicies(path)] as const)
        .filter((entry): entry is readonly [string, Record<string, DemoPolicy | undefined>] =>
          Boolean(entry[1]),
        ),
    );

    expect(actual).toEqual(expectedPolicies);
  });

  it("requires a database refresh credit for every Demo route that performs a live stock lookup", () => {
    const actual = Object.fromEntries(
      routeFiles(join(process.cwd(), "src/app/api"))
        .map((path) => [relative(process.cwd(), path), readMarketDataPolicies(path)] as const)
        .filter((entry): entry is readonly [string, Record<string, MarketDataPolicy | undefined>] =>
          Boolean(entry[1]),
        )
        .filter(([, policies]) => Object.keys(policies).length > 0),
    );

    expect(actual).toEqual({
      "src/app/api/stocks/quote/route.ts": { GET: "refresh-credit" },
      "src/app/api/stocks/route.ts": { POST: "refresh-credit" },
    });
  });

  it.each([
    ["src/lib/services/account-service.ts", "countActiveAccountsInner", ["accounts:${userId}"]],
    [
      "src/lib/services/calendar-entry-service.ts",
      "getCalendarEntriesInRange",
      ["calendar-entries:${userId}"],
    ],
    [
      "src/lib/services/exchange-rate-service.ts",
      "getUnresolvedRatePairs",
      ["accounts:${userId}", "goals:${userId}", "history:${userId}"],
    ],
    ["src/lib/services/goal-service.ts", "fetchUserGoalsInner", ["goals:${userId}"]],
    [
      "src/lib/services/history-service.ts",
      "getNormalizedHistory",
      ["history:${userId}", "accounts:${userId}"],
    ],
    [
      "src/lib/services/history-service.ts",
      "fetchFullHistoryCached",
      ["history:${userId}", "accounts:${userId}"],
    ],
    [
      "src/lib/services/history-service.ts",
      "getSnapshotReconciliationWarning",
      ["history:${userId}", "accounts:${userId}"],
    ],
    [
      "src/lib/services/history-service.ts",
      "getAccountMonthlyCashFlow",
      ["history:${userId}", "accounts:${userId}"],
    ],
    ["src/lib/services/history-service.ts", "hasForeignCurrencySnapshots", ["history:${userId}"]],
    [
      "src/lib/services/net-worth-service.ts",
      "fetchUserAccountsWithHoldingsInner",
      ["accounts:${userId}"],
    ],
    [
      "src/lib/services/net-worth-service.ts",
      "fetchUserArchivedAccountsWithHoldingsInner",
      ["accounts:${userId}"],
    ],
    [
      "src/lib/services/net-worth-service.ts",
      "getCachedNetWorthSummaryInner",
      ["net-worth:${userId}", "accounts:${userId}"],
    ],
    [
      "src/lib/services/projection-service.ts",
      "getProjectionData",
      ["history:${userId}", "accounts:${userId}"],
    ],
    ["src/lib/services/settings-service.ts", "findSettings", ["settings:${userId}"]],
    ["src/lib/services/stock-watch-service.ts", "getCachedTrackedStocks", ["stocks:${userId}"]],
    [
      "src/components/dashboard/dashboard-content.tsx",
      "fetchPreviousSnapshotInner",
      ["history:${userId}"],
    ],
  ])(
    "keeps Demo-readable cache %s#%s reachable through scoped tags",
    (path, functionName, tags) => {
      const source = readFunction(join(process.cwd(), path), functionName);
      expect(source).toContain('"use cache"');
      for (const tag of tags) expect(source).toContain(`cacheTag(\`${tag}\`)`);
    },
  );
});
