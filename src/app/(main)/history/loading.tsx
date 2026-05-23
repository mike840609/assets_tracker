export default function HistoryLoading() {
  return (
    <div className="space-y-4 md:space-y-8">
      {/* Title — matches LargeTitleHeading (text-4xl md:text-3xl) */}
      <div className="h-10 md:h-9 w-28 rounded-lg skeleton-shimmer" />

      {/* Trend chart card — matches TrendChart's own Card (no outer wrapper) */}
      <div className="bg-card border border-border/50 rounded-xl shadow-sm">
        <div className="px-4 pt-4 pb-2 space-y-4">
          <div className="h-5 w-40 rounded skeleton-shimmer" />
          <div className="h-[300px] rounded-lg skeleton-shimmer" />
        </div>
      </div>

      {/* History table card */}
      <div className="bg-card border border-border/50 rounded-xl p-1 card-gradient">
        <div className="p-5 space-y-3">
          <div className="flex items-center justify-between mb-2">
            <div className="h-5 w-40 rounded skeleton-shimmer" />
            <div className="flex gap-1">
              {[...Array(5)].map((_, i) => (
                <div key={i} className="h-7 w-10 rounded-md skeleton-shimmer" />
              ))}
            </div>
          </div>
          {[...Array(7)].map((_, i) => (
            <div key={i} className="h-10 rounded skeleton-shimmer" />
          ))}
        </div>
      </div>
    </div>
  );
}
