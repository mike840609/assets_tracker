export default function SettingsLoading() {
  return (
    <div className="space-y-6 animate-pulse">
      {/* Header */}
      <div className="h-8 w-28 rounded-lg bg-muted" />

      {/* Settings form */}
      <div className="rounded-xl border border-border/50 bg-card p-6 space-y-4">
        <div className="h-5 w-32 rounded bg-muted" />
        <div className="h-10 w-full max-w-xs rounded-md bg-muted/60" />
        <div className="h-9 w-20 rounded-md bg-muted/60" />
      </div>

      {/* Danger zone */}
      <div className="mt-8 border-t pt-8 space-y-4">
        <div className="h-5 w-28 rounded bg-red-200/40 dark:bg-red-800/20" />
        <div className="h-9 w-24 rounded-md bg-muted/60" />
      </div>
    </div>
  );
}
