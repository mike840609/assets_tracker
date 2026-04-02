"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CURRENCIES } from "@/lib/currencies";
import { toast } from "sonner";

export function SettingsForm({ currentCurrency }: { currentCurrency: string }) {
  const router = useRouter();
  const [currency, setCurrency] = useState(currentCurrency);
  const [saving, setSaving] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [snapshotting, setSnapshotting] = useState(false);

  async function saveCurrency() {
    setSaving(true);
    try {
      await fetch("/api/settings", {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: currency }),
      });
      toast.success("Base currency updated");
      router.refresh();
    } catch {
      toast.error("Failed to update currency");
    } finally {
      setSaving(false);
    }
  }

  async function refreshPrices() {
    setRefreshing(true);
    try {
      const res = await fetch("/api/prices/refresh", { method: "POST" });
      const data = await res.json();
      toast.success(`Updated ${data.updated} prices`);
      router.refresh();
    } catch {
      toast.error("Failed to refresh prices");
    } finally {
      setRefreshing(false);
    }
  }

  async function takeSnapshot() {
    setSnapshotting(true);
    try {
      await fetch("/api/snapshots", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ baseCurrency: currency }),
      });
      toast.success("Snapshot created");
      router.refresh();
    } catch {
      toast.error("Failed to create snapshot");
    } finally {
      setSnapshotting(false);
    }
  }

  return (
    <div className="space-y-6 max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle>Base Currency</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <Select value={currency} onValueChange={(v) => v && setCurrency(v)}>
            <SelectTrigger>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              {CURRENCIES.map((c) => (
                <SelectItem key={c.code} value={c.code}>
                  {c.code} — {c.name} ({c.symbol})
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button onClick={saveCurrency} disabled={saving || currency === currentCurrency}>
            {saving ? "Saving..." : "Save"}
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Data Actions</CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={refreshPrices}
            disabled={refreshing}
          >
            {refreshing ? "Refreshing..." : "Refresh All Prices"}
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={() =>
              fetch("/api/exchange-rates/refresh", { method: "POST" })
                .then(() => toast.success("Exchange rates refreshed"))
                .catch(() => toast.error("Failed"))
            }
          >
            Refresh Exchange Rates
          </Button>
          <Button
            variant="outline"
            className="w-full justify-start"
            onClick={takeSnapshot}
            disabled={snapshotting}
          >
            {snapshotting ? "Creating..." : "Take Net Worth Snapshot"}
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
