"use client";

import { useState, useRef } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DownloadIcon, UploadIcon, Loader2Icon, AlertTriangleIcon, CheckCircleIcon } from "lucide-react";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function DataManagement() {
  const t = useTranslations("dataManagement");
  const [isExporting, setIsExporting] = useState(false);
  const [isImporting, setIsImporting] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);
  const [importError, setImportError] = useState<string | null>(null);
  const [showErrorDialog, setShowErrorDialog] = useState(false);
  const [showSuccessDialog, setShowSuccessDialog] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
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
      a.download = `asset-tracker-backup-${new Date().toISOString().split("T")[0]}.json`;
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
    if (file) {
      if (file.type !== "application/json" && !file.name.endsWith(".json")) {
        toast.error(t("invalidFile"));
        return;
      }
      setSelectedFile(file);
      setShowConfirm(true);
    }
  };

  const handleImport = async () => {
    if (!selectedFile) return;

    try {
      setIsImporting(true);
      setShowConfirm(false);
      setImportError(null);

      const reader = new FileReader();
      reader.onload = async (e) => {
        try {
          const content = e.target?.result as string;
          let json;
          try {
            json = JSON.parse(content);
          } catch (pErr) {
            setImportError(t("parseError"));
            setShowErrorDialog(true);
            setIsImporting(false);
            return;
          }

          const response = await fetch("/api/settings/data", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(json),
          });

          if (!response.ok) {
            const body = await response.json();
            throw new Error(body.error?.message || "Import failed");
          }

          setShowSuccessDialog(true);
          setIsImporting(false);
        } catch (err: any) {
          console.error(err);
          setImportError(err.message || t("importFailed"));
          setShowErrorDialog(true);
          setIsImporting(false);
        }
      };
      reader.readAsText(selectedFile);
    } catch (error) {
      console.error(error);
      setImportError(t("importFailed"));
      setShowErrorDialog(true);
      setIsImporting(false);
    }
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

      <Dialog open={showConfirm} onOpenChange={setShowConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="h-5 w-5" />
              {t("title")}
            </DialogTitle>
            <DialogDescription className="py-2 text-foreground font-medium">
              {t("confirmImport")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => {
                setShowConfirm(false);
                setSelectedFile(null);
                if (fileInputRef.current) fileInputRef.current.value = "";
              }}
            >
              {t("cancel")}
            </Button>
            <Button variant="destructive" onClick={handleImport}>
              {t("importButton")}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

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
                if (fileInputRef.current) fileInputRef.current.value = "";
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
              <CheckCircleIcon className="h-5 w-5 text-green-500" />
              {t("importSuccessTitle")}
            </DialogTitle>
            <DialogDescription className="py-2 text-foreground font-medium">
              {t("importSuccessMessage")}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              className="w-full"
              onClick={() => window.location.reload()}
            >
              OK
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
