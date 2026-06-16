"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { toast } from "sonner";
import {
  DatabaseBackupIcon,
  DownloadIcon,
  EyeIcon,
  EyeOffIcon,
  KeyRoundIcon,
  Loader2Icon,
  LogOutIcon,
  ShieldCheckIcon,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { usePrivacyMode } from "@/components/layout/privacy-mode-context";

type PrivacySecurityProps = {
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
};

function RowIcon({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground">
      {children}
    </div>
  );
}

export function PrivacySecurity({ userEmail, signOutAction }: PrivacySecurityProps) {
  const t = useTranslations("settings");
  const { privacyMode, togglePrivacyMode } = usePrivacyMode();
  const [isExporting, setIsExporting] = useState(false);

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
      toast.success(t("privacy.backupStarted"));
    } catch (error) {
      // eslint-disable-next-line no-console
      console.error(error);
      toast.error(t("privacy.backupFailed"));
    } finally {
      setIsExporting(false);
    }
  };

  return (
    <section className="space-y-3 w-full">
      <h3 className="text-lg font-semibold text-foreground">{t("privacy.title")}</h3>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-0">
          <div className="flex flex-col gap-3 border-b bg-muted/20 p-4 sm:flex-row sm:items-start sm:justify-between">
            <div className="flex gap-3">
              <RowIcon>
                <ShieldCheckIcon className="size-4" aria-hidden="true" />
              </RowIcon>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("privacy.summaryTitle")}</p>
                <p className="max-w-[60ch] text-sm text-muted-foreground">
                  {t("privacy.summaryDescription")}
                </p>
              </div>
            </div>
            <Badge
              variant="secondary"
              className="self-start bg-primary/10 text-primary-ink dark:bg-primary/15"
            >
              {t("privacy.privateByDefault")}
            </Badge>
          </div>

          <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <RowIcon>
                {privacyMode ? (
                  <EyeOffIcon className="size-4" aria-hidden="true" />
                ) : (
                  <EyeIcon className="size-4" aria-hidden="true" />
                )}
              </RowIcon>
              <div className="space-y-1">
                <div className="flex flex-wrap items-center gap-2">
                  <p className="text-sm font-medium">{t("privacy.privacyMode")}</p>
                  <Badge
                    variant="secondary"
                    className={
                      privacyMode ? "bg-primary/10 text-primary-ink dark:bg-primary/15" : undefined
                    }
                  >
                    {privacyMode ? t("privacy.balancesHidden") : t("privacy.balancesVisible")}
                  </Badge>
                </div>
                <p className="max-w-[55ch] text-sm text-muted-foreground">
                  {t("privacy.privacyModeDescription")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={togglePrivacyMode}
              aria-pressed={privacyMode}
              className="h-11 md:h-8 w-full sm:w-auto sm:min-w-[150px]"
            >
              {privacyMode ? t("privacy.showBalances") : t("privacy.hideBalances")}
            </Button>
          </div>

          <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <RowIcon>
                <KeyRoundIcon className="size-4" aria-hidden="true" />
              </RowIcon>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("privacy.signedInWithGoogle")}</p>
                <p className="max-w-[55ch] text-sm text-muted-foreground">
                  {userEmail
                    ? t("privacy.sessionDescriptionWithEmail", { email: userEmail })
                    : t("privacy.sessionDescription")}
                </p>
              </div>
            </div>
            <form action={signOutAction} className="w-full sm:w-auto">
              <Button
                type="submit"
                variant="outline"
                className="h-11 md:h-8 w-full sm:min-w-[150px]"
              >
                <LogOutIcon className="mr-2 size-4" aria-hidden="true" />
                {t("signOut")}
              </Button>
            </form>
          </div>

          <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex gap-3">
              <RowIcon>
                <DatabaseBackupIcon className="size-4" aria-hidden="true" />
              </RowIcon>
              <div className="space-y-1">
                <p className="text-sm font-medium">{t("privacy.exportBackup")}</p>
                <p className="max-w-[55ch] text-sm text-muted-foreground">
                  {t("privacy.exportBackupDescription")}
                </p>
              </div>
            </div>
            <Button
              type="button"
              variant="outline"
              onClick={handleExport}
              disabled={isExporting}
              aria-busy={isExporting}
              className="h-11 md:h-8 w-full sm:w-auto sm:min-w-[150px]"
            >
              {isExporting ? (
                <Loader2Icon className="mr-2 size-4 animate-spin" aria-hidden="true" />
              ) : (
                <DownloadIcon className="mr-2 size-4" aria-hidden="true" />
              )}
              {isExporting ? t("privacy.preparingBackup") : t("privacy.exportBackupAction")}
            </Button>
          </div>

          <div className="flex gap-3 p-4">
            <RowIcon>
              <ShieldCheckIcon className="size-4" aria-hidden="true" />
            </RowIcon>
            <div className="space-y-1">
              <p className="text-sm font-medium">{t("privacy.yourData")}</p>
              <p className="max-w-[60ch] text-sm text-muted-foreground">
                {t("privacy.yourDataDescription")}
              </p>
            </div>
          </div>
        </CardContent>
      </Card>
    </section>
  );
}
