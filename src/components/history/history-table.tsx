"use client";

import { useMemo } from "react";
import Link from "next/link";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { buttonVariants } from "@/components/ui/button";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { formatCurrency } from "@/lib/currencies";
import { CalendarClock } from "lucide-react";

type SnapshotRow = {
  id: string;
  date: string;
  netWorth: number;
  totalAssets: number;
  totalLiabilities: number;
};

type Props = {
  snapshots: SnapshotRow[];
  baseCurrency: string;
};

export function HistoryTable({ snapshots, baseCurrency }: Props) {
  const t = useTranslations("history");

  const rows = useMemo(() => {
    return [...snapshots].reverse().map((snap, idx, arr) => ({
      ...snap,
      change: arr[idx + 1] ? snap.netWorth - arr[idx + 1].netWorth : null,
    }));
  }, [snapshots]);

  return (
    <Card>
      <CardHeader className="pb-2">
        <CardTitle className="text-base font-medium">{t("title")}</CardTitle>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <div className="py-12 text-center">
            <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-full bg-muted">
              <CalendarClock className="h-6 w-6 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">{t("noData")}</p>
            <Link href="/" className={cn(buttonVariants({ variant: "outline" }), "mt-4")}>
              {t("goDashboard")}
            </Link>
          </div>
        ) : (
          <div className="max-h-[480px] overflow-y-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>{t("colDate")}</TableHead>
                  <TableHead className="text-right">{t("colNetWorth")}</TableHead>
                  <TableHead className="text-right">{t("colAssets")}</TableHead>
                  <TableHead className="text-right">{t("colLiabilities")}</TableHead>
                  <TableHead className="text-right">{t("colChange")}</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {rows.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="text-sm">
                      {new Date(row.date + "T00:00:00").toLocaleDateString(undefined, {
                        year: "numeric",
                        month: "short",
                        day: "numeric",
                      })}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.netWorth, baseCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.totalAssets, baseCurrency)}
                    </TableCell>
                    <TableCell className="text-right tabular-nums">
                      {formatCurrency(row.totalLiabilities, baseCurrency)}
                    </TableCell>
                    <TableCell
                      className={cn(
                        "text-right tabular-nums font-medium",
                        row.change === null || row.change === 0
                          ? "text-muted-foreground"
                          : row.change > 0
                            ? "text-emerald-600 dark:text-emerald-400"
                            : "text-red-500 dark:text-red-400"
                      )}
                    >
                      {row.change === null
                        ? "—"
                        : (row.change >= 0 ? "+" : "") +
                          formatCurrency(row.change, baseCurrency)}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
