"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { RefreshCw, Camera, Clock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { toast } from "sonner";
import { formatDistanceToNow } from "date-fns";

interface DashboardActionsProps {
  baseCurrency: string;
  lastPriceUpdate?: string | null; // ISO string
  lastSnapshotDate?: string | null; // ISO string
}

export function DashboardActions({
  baseCurrency,
  lastPriceUpdate,
  lastSnapshotDate,
}: DashboardActionsProps) {
  const router = useRouter();
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  async function handleRefreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      const data = await res.json();

      // Also refresh exchange rates
      await fetch("/api/exchange-rates/refresh", { method: "POST" });

      toast.success(`Updated ${data.updated} prices & exchange rates`);
      router.refresh();
    } catch {
      toast.error("Failed to refresh prices");
    } finally {
      setRefreshing(false);
    }
  }

  async function handleSnapshot() {
    setSnapshotting(true);
    try {
      await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency }),
      });
      toast.success("Snapshot saved");
      router.refresh();
    } catch {
      toast.error("Failed to take snapshot");
    } finally {
      setSnapshotting(false);
    }
  }

  const priceAge = lastPriceUpdate
    ? formatDistanceToNow(new Date(lastPriceUpdate), { addSuffix: true })
    : null;

  const snapshotAge = lastSnapshotDate
    ? formatDistanceToNow(new Date(lastSnapshotDate), { addSuffix: true })
    : null;

  return (
    <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3 justify-between">
      {/* Timestamps */}
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
        {priceAge && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            Prices updated {priceAge}
          </span>
        )}
        {snapshotAge && (
          <span className="inline-flex items-center gap-1">
            <Camera className="h-3 w-3" />
            Snapshot {snapshotAge}
          </span>
        )}
        {!priceAge && !snapshotAge && (
          <span className="inline-flex items-center gap-1">
            <Clock className="h-3 w-3" />
            No price data yet
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={handleRefreshPrices}
          disabled={refreshing}
          className="gap-1.5"
        >
          <RefreshCw className={`h-3.5 w-3.5 ${refreshing ? "animate-spin" : ""}`} />
          {refreshing ? "Refreshing..." : "Refresh Prices"}
        </Button>
        <Button
          variant="outline"
          size="sm"
          onClick={handleSnapshot}
          disabled={snapshotting}
          className="gap-1.5"
        >
          <Camera className={`h-3.5 w-3.5 ${snapshotting ? "animate-pulse" : ""}`} />
          {snapshotting ? "Saving..." : "Snapshot"}
        </Button>
      </div>
    </div>
  );
}
