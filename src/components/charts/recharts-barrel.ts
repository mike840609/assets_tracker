// Single re-entry point for all recharts imports.
// Turbopack treats this as one chunk boundary, preventing duplication
// across route bundles.
export * from "recharts";
export type * from "recharts";
