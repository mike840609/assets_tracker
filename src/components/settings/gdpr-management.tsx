"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import { Trash2Icon, AlertTriangleIcon, Loader2Icon } from "lucide-react";

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
  const [isDeleting, setIsDeleting] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

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
