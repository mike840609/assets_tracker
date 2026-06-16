export default function ChangelogLoading() {
  return (
    <div className="mx-auto w-full max-w-2xl space-y-8 pb-16">
      <div className="space-y-3">
        <div className="h-9 w-44 animate-pulse rounded-lg bg-muted" />
        <div className="h-5 w-72 max-w-full animate-pulse rounded bg-muted/70" />
        <div className="h-6 w-32 animate-pulse rounded-full bg-muted/70" />
      </div>

      <ol className="relative space-y-9">
        <span aria-hidden className="absolute left-[5px] top-2.5 bottom-3 w-px bg-border" />
        {[0, 1, 2].map((i) => (
          <li key={i} className="relative space-y-3 pl-8">
            <span
              aria-hidden
              className="absolute left-0 top-[5px] h-[11px] w-[11px] rounded-full border-2 border-background bg-muted"
            />
            <div className="flex items-baseline gap-2.5">
              <div className="h-5 w-16 animate-pulse rounded bg-muted" />
              <div className="h-4 w-24 animate-pulse rounded bg-muted/70" />
            </div>
            <div className="space-y-2">
              {[0, 1].map((j) => (
                <div key={j} className="grid grid-cols-[4.75rem_1fr] gap-3">
                  <div className="h-5 animate-pulse rounded-full bg-muted" />
                  <div className="h-5 w-full max-w-md animate-pulse rounded bg-muted/70" />
                </div>
              ))}
            </div>
          </li>
        ))}
      </ol>
    </div>
  );
}
