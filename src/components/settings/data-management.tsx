"use client";

import { useState, useRef } from "react";
import { useLocale, useTranslations } from "next-intl";
import { toast } from "sonner";
import { UploadIcon, Loader2Icon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

const CONFIRMATION_TEXT = "REPLACE";

type ImportPreview = {
  version: string | null;
  exportedAt: string | null;
  fileName: string;
  fileSize: string;
  accounts: number;
  holdings: number;
  transactions: number;
  snapshots: number;
  goals: number;
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function formatFileSize(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function countArray(value: unknown) {
  return Array.isArray(value) ? value.length : 0;
}

function buildImportPreview(data: unknown, file: File): ImportPreview | null {
  if (!isRecord(data) || !Array.isArray(data.accounts)) return null;

  let holdings = 0;
  let transactions = 0;

  for (const account of data.accounts) {
    if (!isRecord(account)) continue;
    const accountHoldings = Array.isArray(account.holdings) ? account.holdings : [];
    holdings += accountHoldings.length;
    transactions += countArray(account.cashTransactions);

    for (const holding of accountHoldings) {
      if (isRecord(holding)) transactions += countArray(holding.transactions);
    }
  }

  return {
    version: typeof data.version === "string" ? data.version : null,
    exportedAt: typeof data.exportedAt === "string" ? data.exportedAt : null,
    fileName: file.name,
    fileSize: formatFileSize(file.size),
    accounts: data.accounts.length,
    holdings,
    transactions,
    snapshots: countArray(data.snapshots),
    goals: countArray(data.goals),
  };
}

export function DataManagement() {
  const t = useTranslations("dataManagement");
  const locale = useLocale();
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const [parsedImport, setParsedImport] = useState<unknown>(null);
  const [confirmation, setConfirmation] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const resetImportSelection = () => {
    setShowConfirm(false);
    setSelectedFile(null);
    setImportPreview(null);
    setParsedImport(null);
    setConfirmation("");
    if (fileInputRef.current) fileInputRef.current.value = "";
  };

  const formattedExportDate = (() => {
    if (!importPreview?.exportedAt) return t("noExportDate");
    const date = new Date(importPreview.exportedAt);
    if (Number.isNaN(date.getTime())) return t("noExportDate");
    return new Intl.DateTimeFormat(locale, {
      dateStyle: "medium",
      timeStyle: "short",
    }).format(date);
  })();

  const confirmationMatches = confirmation.trim() === CONFIRMATION_TEXT;

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        toast.error(t("invalidFile"));
        resetImportSelection();
        return;
      }

      try {
        const content = await file.text();
        const parsed = JSON.parse(content);
        const preview = buildImportPreview(parsed, file);

        if (!preview) {
          setImportError(t("invalidBackupDescription"));
          setShowErrorDialog(true);
          resetImportSelection();
          return;
        }

        setSelectedFile(file);
        setParsedImport(parsed);
        setImportPreview(preview);
        setConfirmation("");
        setShowConfirm(true);
      } catch {
        setImportError(t("parseError"));
        setShowErrorDialog(true);
        resetImportSelection();
      }
    }
  };

  const handleImport = async () => {
    if (!selectedFile || !parsedImport || !confirmationMatches) return;

    try {
      setIsImporting(true);
      setShowConfirm(false);
      setImportError(null);

      const response = await fetch("/api/settings/data", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(parsedImport),
      });

      if (!response.ok) {
        const body = await response.json();
        throw new Error(body.error?.message || "Import failed");
      }

      setShowSuccessDialog(true);
    } catch (error: unknown) {
      // eslint-disable-next-line no-console
      console.error(error);
      setImportError((error instanceof Error ? error.message : null) || t("importFailed"));
      setShowErrorDialog(true);
    } finally {
      setIsImporting(false);
    }
  };

  return (
    <div className="space-y-3 w-full">
      <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
            <div className="flex-1 space-y-1">
              <p className="text-sm font-medium">{t("import")}</p>
              <p className="text-sm text-muted-foreground">{t("importDescription")}</p>
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
                disabled={isImporting}
                className="w-full min-w-[200px]"
              >
                {isImporting ? (
                  <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
                ) : (
                  <UploadIcon className="mr-2 h-4 w-4" />
                )}
                {t("importButton")}
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      <Dialog
        open={showConfirm}
        onOpenChange={(open) => {
          if (open) {
            setShowConfirm(true);
          } else if (!isImporting) {
            resetImportSelection();
          }
        }}
      >
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="h-5 w-5" />
              {t("confirmImportTitle")}
            </DialogTitle>
            <DialogDescription className="text-muted-foreground">
              {t("confirmImportDescription")}
            </DialogDescription>
          </DialogHeader>
          {importPreview && (
            <div className="space-y-4">
              <div className="rounded-lg border bg-muted/30 p-3">
                <div className="space-y-1">
                  <p className="text-sm font-medium break-all">{importPreview.fileName}</p>
                  <p className="text-xs text-muted-foreground">
                    {t("backupFileMeta", {
                      size: importPreview.fileSize,
                      version: importPreview.version ?? t("unknownVersion"),
                    })}
                  </p>
                </div>
                <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-2 text-sm sm:grid-cols-3">
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("exportedAt")}</dt>
                    <dd className="font-medium">{formattedExportDate}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("accountsCount")}</dt>
                    <dd className="font-medium tabular-nums">{importPreview.accounts}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("holdingsCount")}</dt>
                    <dd className="font-medium tabular-nums">{importPreview.holdings}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("transactionsCount")}</dt>
                    <dd className="font-medium tabular-nums">{importPreview.transactions}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("snapshotsCount")}</dt>
                    <dd className="font-medium tabular-nums">{importPreview.snapshots}</dd>
                  </div>
                  <div>
                    <dt className="text-xs text-muted-foreground">{t("goalsCount")}</dt>
                    <dd className="font-medium tabular-nums">{importPreview.goals}</dd>
                  </div>
                </dl>
              </div>
              <div className="rounded-lg border border-destructive/20 bg-destructive/5 p-3 text-sm text-destructive">
                {t("replaceWarning")}
              </div>
              <div className="space-y-2">
                <Label htmlFor="replace-confirmation">{t("typeToConfirmLabel")}</Label>
                <Input
                  id="replace-confirmation"
                  value={confirmation}
                  onChange={(event) => setConfirmation(event.target.value)}
                  autoComplete="off"
                  aria-describedby="replace-confirmation-help"
                />
                <p id="replace-confirmation-help" className="text-xs text-muted-foreground">
                  {t("typeToConfirmHelp", { confirmation: CONFIRMATION_TEXT })}
                </p>
              </div>
            </div>
          )}
          <DialogFooter>
            <Button variant="outline" onClick={resetImportSelection} disabled={isImporting}>
              {t("cancel")}
            </Button>
            <Button
              variant="destructive"
              onClick={handleImport}
              disabled={!confirmationMatches || isImporting}
            >
              {isImporting ? (
                <Loader2Icon className="mr-2 h-4 w-4 animate-spin" aria-hidden="true" />
              ) : null}
              {isImporting ? t("replacingData") : t("replaceAllData")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog
        open={showErrorDialog}
        onOpenChange={(open) => {
          setShowErrorDialog(open);
          if (!open) {
            setImportError(null);
            resetImportSelection();
          }
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
                resetImportSelection();
              }}
              className="w-full sm:w-auto"
            >
              {t("close")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      <Dialog open={showSuccessDialog} onOpenChange={setShowSuccessDialog}>
        <DialogContent className="sm:max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-primary">
              <CheckCircleIcon className="h-5 w-5 text-primary" />
              {t("importSuccessTitle")}
            </DialogTitle>
            <DialogDescription className="py-2 text-foreground font-medium">
              {t("importSuccessMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button className="w-full" onClick={() => window.location.reload()}>
              {t("done")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
