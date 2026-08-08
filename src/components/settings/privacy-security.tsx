"use client";

import { useState } from "react";
import Link from "next/link";
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
  isDemo: boolean;
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

export function PrivacySecurity({ isDemo, userEmail, signOutAction }: PrivacySecurityProps) {
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

          {isDemo ? (
            <>
              <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <p className="text-sm font-medium">{t("demo.temporarySessionTitle")}</p>
                  <p className="text-sm text-muted-foreground">
                    {t("demo.temporarySessionDescription")}
                  </p>
                </div>
                <div className="flex w-full gap-2 sm:w-auto">
                  <form action={signOutAction} className="flex-1">
                    <Button type="submit" variant="outline" className="h-11 w-full md:h-8">
                      {t("demo.exit")}
                    </Button>
                  </form>
                  <Button render={<Link href="/login?from=demo" />} className="h-11 flex-1 md:h-8">
                    {t("demo.signIn")}
                  </Button>
                </div>
              </div>
              <div className="p-4 text-sm text-muted-foreground">
                {t("demo.backupRequiresAccount")}
              </div>
            </>
          ) : (
            <FormalSessionAndBackupRows
              userEmail={userEmail}
              signOutAction={signOutAction}
              onExport={handleExport}
              isExporting={isExporting}
            />
          )}

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

function FormalSessionAndBackupRows({
  userEmail,
  signOutAction,
  onExport,
  isExporting,
}: {
  userEmail?: string | null;
  signOutAction: () => Promise<void>;
  onExport: () => Promise<void>;
  isExporting: boolean;
}) {
  const t = useTranslations("settings");

  return (
    <>
      <div className="flex flex-col gap-4 border-b p-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex gap-3">
          <RowIcon>
            <KeyRoundIcon className="size-4" aria-hidden="true" />
          </RowIcon>
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("privacy.signedInSecurely")}</p>
            <p className="max-w-[55ch] text-sm text-muted-foreground">
              {userEmail
                ? t("privacy.sessionDescriptionWithEmail", { email: userEmail })
                : t("privacy.sessionDescription")}
            </p>
          </div>
        </div>
        <form action={signOutAction} className="w-full sm:w-auto">
          <Button type="submit" variant="outline" className="h-11 md:h-8 w-full sm:min-w-[150px]">
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
          onClick={onExport}
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
    </>
  );
}
