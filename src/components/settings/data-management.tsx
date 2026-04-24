"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DownloadIcon,
  UploadIcon,
  Loader2Icon,
  AlertTriangleIcon,
  CheckCircleIcon,
  PlusCircleIcon,
  RefreshCwIcon,
  MinusCircleIcon,
} from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { ImportPreview } from "@/app/api/settings/data/preview/route";

export function DataManagement() {
  const t = useTranslations("dataManagement");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [isPreviewing, setIsPreviewing] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [showPreviewDialog, setShowPreviewDialog] = useState(false);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [pendingJson, setPendingJson] = useState<unknown>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      const response = await fetch("/api/settings/data");
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `assets-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      toast.error(t("exportFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (file.type !== "application/json" && !file.name.endsWith(".json")) {
      toast.error(t("invalidFile"));
      return;
    }

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const content = ev.target?.result as string;
        let json: unknown;
        try {
          json = JSON.parse(content);
        } catch {
          setImportError(t("parseError"));
          setShowErrorDialog(true);
          return;
        }

        setIsPreviewing(true);
        const res = await fetch("/api/settings/data/preview", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(json),
        });

        if (!res.ok) {
          const body = await res.json().catch(() => ({}));
          throw new Error(body?.error?.message || t("previewFailed"));
        }

        const { data } = await res.json();
        setPendingJson(json);
        setPreview(data as ImportPreview);
        setShowPreviewDialog(true);
      } catch (err) {
        console.error(err);
        setImportError(err instanceof Error ? err.message : t("previewFailed"));
        setShowErrorDialog(true);
      } finally {
        setIsPreviewing(false);
        // Reset input so the same file can be re-selected
        if (fileInputRef.current) fileInputRef.current.value = "";
      }
    };
    reader.readAsText(file);
  };

  const handleConfirmImport = async () => {
    if (!pendingJson) return;

    try {
      setIsImporting(true);
      setShowPreviewDialog(false);

      const response = await fetch("/api/settings/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(pendingJson),
      });

      if (!response.ok) {
        const body = await response.json().catch(() => ({}));
        throw new Error(body?.error?.message || t("importFailed"));
      }

      setShowSuccessDialog(true);
    } catch (err) {
      console.error(err);
      setImportError(err instanceof Error ? err.message : t("importFailed"));
      setShowErrorDialog(true);
    } finally {
      setIsImporting(false);
      setPendingJson(null);
      setPreview(null);
    }
  };

  const handleCancelPreview = () => {
    setShowPreviewDialog(false);
    setPendingJson(null);
    setPreview(null);
  };

  return (
    <div className="space-y-3 w-full">
      <h3 className="text-lg font-semibold text-foreground">
        {t("title")}
      </h3>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b gap-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{t("export")}</p>
              <p className="text-sm text-muted-foreground">{t("exportDescription")}</p>
            </div>
            <Button
              onClick={handleExport}
              disabled={isExporting}
              className="w-full sm:w-auto min-w-[200px]"
            >
              {isExporting ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <DownloadIcon className="mr-2 h-4 w-4" />
              )}
              {t("export")}
            </Button>
          </div>

          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{t("import")}</p>
              <p className="text-sm text-muted-foreground">
                {t("importDescription")}
              </p>
            </div>
            <div className="flex flex-col gap-2 w-full sm:w-auto">
              <input
                type="file"
                ref={fileInputRef}
                onChange={handleFileChange}
                accept=".json,application/json"
                className="hidden"
              />
              <Button
                variant="outline"
                onClick={() => fileInputRef.current?.click()}
                disabled={isImporting || isPreviewing}
                className="w-full min-w-[200px]"
              >
                {isImporting || isPreviewing ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="mr-2 h-4 w-4" />
                )}
                {isPreviewing ? t("previewLoading") : t("importButton")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Preview / diff dialog */}
      <Dialog open={showPreviewDialog} onOpenChange={(open) => { if (!open) handleCancelPreview(); }}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>{t("previewTitle")}</DialogTitle>
            <DialogDescription>{t("previewDescription")}</DialogDescription>
          </DialogHeader>

          {preview && (
            <div className="space-y-4 py-2">
              {preview.totalChanges === 0 ? (
                <p className="text-sm text-muted-foreground">{t("previewNoChanges")}</p>
              ) : (
                <>
                  {/* Accounts summary */}
                  <DiffSection
                    label={t("previewAccounts")}
                    rows={[
                      { icon: "new", count: preview.accounts.new.length, label: t("previewNew", { count: preview.accounts.new.length }) },
                      { icon: "updated", count: preview.accounts.updated.length, label: t("previewUpdated", { count: preview.accounts.updated.length }) },
                      { icon: "unchanged", count: preview.accounts.unchanged.length, label: t("previewUnchanged", { count: preview.accounts.unchanged.length }) },
                    ]}
                    details={[
                      preview.accounts.new.length > 0 && {
                        badge: t("previewNewAccountsLabel"),
                        names: preview.accounts.new,
                      },
                      preview.accounts.updated.length > 0 && {
                        badge: t("previewUpdatedAccountsLabel"),
                        names: preview.accounts.updated,
                      },
                    ].filter(Boolean) as { badge: string; names: string[] }[]}
                  />

                  {/* Holdings summary */}
                  <DiffSection
                    label={t("previewHoldings")}
                    rows={[
                      { icon: "new", count: preview.holdings.new, label: t("previewNew", { count: preview.holdings.new }) },
                      { icon: "updated", count: preview.holdings.updated, label: t("previewUpdated", { count: preview.holdings.updated }) },
                      { icon: "unchanged", count: preview.holdings.unchanged, label: t("previewUnchanged", { count: preview.holdings.unchanged }) },
                    ]}
                  />

                  {/* Snapshots summary */}
                  {(preview.snapshots.new > 0 || preview.snapshots.unchanged > 0) && (
                    <DiffSection
                      label={t("previewSnapshots")}
                      rows={[
                        { icon: "new", count: preview.snapshots.new, label: t("previewNew", { count: preview.snapshots.new }) },
                        { icon: "unchanged", count: preview.snapshots.unchanged, label: t("previewUnchanged", { count: preview.snapshots.unchanged }) },
                      ]}
                    />
                  )}
                </>
              )}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={handleCancelPreview}>
              {t("cancel")}
            </Button>
            <Button onClick={handleConfirmImport} disabled={isImporting}>
              {isImporting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {t("previewConfirm")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Error dialog */}
      <Dialog
        open={showErrorDialog}
        onOpenChange={(open) => {
          setShowErrorDialog(open);
          if (!open) setImportError(null);
        }}
      >
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="h-5 w-5" />
              {t("importErrorTitle")}
            </DialogTitle>
            <DialogDescription className="py-2 text-foreground font-medium">
              {importError}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowErrorDialog(false);
                setImportError(null);
              }}
              className="w-full sm:w-auto"
            >
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Success dialog */}
      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              {t("importSuccessTitle")}
            </DialogTitle>
            <DialogDescription className="py-2 text-foreground font-medium">
              {t("importSuccessMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => window.location.reload()}>
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Internal helpers ──────────────────────────────────────────────────────────

type IconType = "new" | "updated" | "unchanged";

function DiffIcon({ type }: { type: IconType }) {
  if (type === "new")
    return <PlusCircleIcon className="h-4 w-4 text-green-500 shrink-0" />;
  if (type === "updated")
    return <RefreshCwIcon className="h-4 w-4 text-amber-500 shrink-0" />;
  return <MinusCircleIcon className="h-4 w-4 text-muted-foreground shrink-0" />;
}

function DiffSection({
  label,
  rows,
  details,
}: {
  label: string;
  rows: { icon: IconType; count: number; label: string }[];
  details?: { badge: string; names: string[] }[];
}) {
  const visibleRows = rows.filter((r) => r.count > 0);
  if (visibleRows.length === 0) return null;

  return (
    <div className="space-y-1">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        {label}
      </p>
      <div className="space-y-1">
        {visibleRows.map((row) => (
          <div key={row.icon} className="flex items-center gap-2 text-sm">
            <DiffIcon type={row.icon} />
            <span>{row.label}</span>
          </div>
        ))}
      </div>
      {details && details.length > 0 && (
        <div className="mt-1 space-y-1">
          {details.map((d) => (
            <div key={d.badge} className="flex flex-wrap gap-1 items-center">
              <span className="text-xs font-medium text-muted-foreground w-14 shrink-0">
                {d.badge}:
              </span>
              {d.names.map((name) => (
                <span
                  key={name}
                  className="text-xs bg-muted rounded px-1.5 py-0.5 max-w-[200px] truncate"
                  title={name}
                >
                  {name}
                </span>
              ))}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
