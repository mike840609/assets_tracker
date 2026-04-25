"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { DownloadIcon, Trash2Icon, AlertTriangleIcon, Loader2Icon } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export function GdprManagement() {
  const t = useTranslations("gdprManagement");

  const [isExporting, setIsExporting] = useState(false);
  const [showExportConfirm, setShowExportConfirm] = useState(false);

  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  const handleExport = async () => {
    try {
      setIsExporting(true);
      setShowExportConfirm(false);
      
      const response = await fetch("/api/user/export", {
        method: "POST",
      });
      
      if (!response.ok) throw new Error("Export failed");

      const blob = await response.blob();
      const url = window.URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = `gdpr-export-${new Date().toISOString().split("T")[0]}.json`;
      document.body.appendChild(a);
      a.click();
      window.URL.revokeObjectURL(url);
      document.body.removeChild(a);
    } catch (error) {
      console.error(error);
      toast.error(t("exportFailed", { fallback: "Failed to export data" }));
    } finally {
      setIsExporting(false);
    }
  };

  const handleDeleteAccount = async () => {
    try {
      setIsDeleting(true);
      
      const response = await fetch("/api/user", {
        method: "DELETE",
      });
      
      if (!response.ok) throw new Error("Delete failed");
      
      // Successfully deleted, now sign out and redirect
      toast.success(t("deleteSuccess", { fallback: "Account successfully deleted" }));
      setShowDeleteConfirm(false);
      
      // In next-auth, calling the signOut endpoint or router refresh helps
      // For app router, we can use window.location
      window.location.href = "/api/auth/signout?callbackUrl=/";
    } catch (error) {
      console.error(error);
      toast.error(t("deleteFailed", { fallback: "Failed to delete account" }));
      setIsDeleting(false);
    }
  };

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 border-b border-red-500/20 gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {t("exportData", { fallback: "Export Personal Data" })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("exportDataDescription", { fallback: "Download a copy of all your personal data (GDPR Article 15)." })}
          </p>
        </div>
        <Button
          variant="outline"
          onClick={() => setShowExportConfirm(true)}
          disabled={isExporting}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {isExporting ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <DownloadIcon className="mr-2 h-4 w-4" />
          )}
          {t("exportButton", { fallback: "Request Data Export" })}
        </Button>
      </div>
      
      <div className="flex flex-col sm:flex-row sm:items-center justify-between p-4 gap-4">
        <div className="flex-1 space-y-1">
          <p className="text-sm font-medium text-red-600 dark:text-red-400">
            {t("deleteAccount", { fallback: "Delete Account" })}
          </p>
          <p className="text-sm text-muted-foreground">
            {t("deleteAccountDescription", { fallback: "Permanently delete your account and all associated data. This action cannot be undone." })}
          </p>
        </div>
        <Button
          variant="destructive"
          onClick={() => setShowDeleteConfirm(true)}
          disabled={isDeleting}
          className="w-full sm:w-auto min-w-[200px]"
        >
          {isDeleting ? (
            <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />
          ) : (
            <Trash2Icon className="mr-2 h-4 w-4" />
          )}
          {t("deleteButton", { fallback: "Delete Account" })}
        </Button>
      </div>

      {/* Export Confirmation */}
      <Dialog open={showExportConfirm} onOpenChange={setShowExportConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{t("exportConfirmTitle", { fallback: "Export Personal Data" })}</DialogTitle>
            <DialogDescription className="py-2">
              {t("exportConfirmDescription", { fallback: "This will compile a JSON archive containing all of your account information, transactions, holdings, and settings. Proceed with export?" })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowExportConfirm(false)}>
              {t("cancel", { fallback: "Cancel" })}
            </Button>
            <Button onClick={handleExport} disabled={isExporting}>
              {isExporting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {t("confirmExportButton", { fallback: "Yes, Export Data" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Delete Confirmation */}
      <Dialog open={showDeleteConfirm} onOpenChange={setShowDeleteConfirm}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2 text-destructive">
              <AlertTriangleIcon className="h-5 w-5" />
              {t("deleteConfirmTitle", { fallback: "Delete Account" })}
            </DialogTitle>
            <DialogDescription className="py-2 text-foreground font-medium">
              {t("deleteConfirmDescription", { fallback: "Are you absolutely sure? This will permanently erase your account and all associated data. This action cannot be reversed." })}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowDeleteConfirm(false)}>
              {t("cancel", { fallback: "Cancel" })}
            </Button>
            <Button variant="destructive" onClick={handleDeleteAccount} disabled={isDeleting}>
              {isDeleting && <Loader2Icon className="mr-2 h-4 w-4 animate-spin" />}
              {t("confirmDeleteButton", { fallback: "Yes, permanently delete" })}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
