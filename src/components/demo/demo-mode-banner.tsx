"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useLocale, useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { LogOut, RefreshCcw, UserRound } from "lucide-react";
import { toast } from "sonner";
import {
  exitPublicDemoAction,
  resetPublicDemoAction,
  type DemoResetActionState,
} from "@/app/demo/actions";
import { demoAnnouncementThreshold } from "@/lib/demo/demo-time";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";

const INITIAL_DEMO_RESET_ACTION_STATE: DemoResetActionState = {
  errorCode: null,
  completedResets: 0,
};

function formatRemaining(locale: string, remainingMs: number) {
  const formatter = new Intl.RelativeTimeFormat(locale, { numeric: "auto" });
  const remainingMinutes = Math.ceil(remainingMs / 60_000);
  if (remainingMinutes < 60) return formatter.format(remainingMinutes, "minute");
  return formatter.format(Math.ceil(remainingMinutes / 60), "hour");
}

export function DemoModeBanner({ expiresAt }: { expiresAt: string }) {
  const t = useTranslations("demo");
  const locale = useLocale();
  const router = useRouter();
  const [now, setNow] = useState<number | null>(null);
  const [mounted, setMounted] = useState(false);
  const [resetDialogOpen, setResetDialogOpen] = useState(false);
  const [announcement, setAnnouncement] = useState("");
  const [resetState, resetAction, resetting] = useActionState(
    resetPublicDemoAction,
    INITIAL_DEMO_RESET_ACTION_STATE,
  );
  const lastAnnouncedThreshold = useRef<string | null>(null);
  const completedResets = useRef(0);
  const expiryMs = Date.parse(expiresAt);
  const timeIsReady = mounted && now !== null;
  const remainingMs = now === null ? null : Math.max(0, expiryMs - now);
  const exactExpiry = timeIsReady
    ? new Intl.DateTimeFormat(locale, {
        dateStyle: "medium",
        timeStyle: "short",
      }).format(new Date(expiryMs))
    : null;

  useEffect(() => {
    const initialFrame = window.requestAnimationFrame(() => {
      setMounted(true);
      setNow(Date.now());
    });
    const interval = window.setInterval(() => setNow(Date.now()), 30_000);
    const expiryTimeout = window.setTimeout(
      () => setNow(Date.now()),
      Math.max(0, expiryMs - Date.now()),
    );
    return () => {
      window.cancelAnimationFrame(initialFrame);
      window.clearInterval(interval);
      window.clearTimeout(expiryTimeout);
    };
  }, [expiryMs]);

  useEffect(() => {
    if (remainingMs === 0) router.replace("/demo/expired");
  }, [remainingMs, router]);

  useEffect(() => {
    if (remainingMs === null) return;
    const threshold = demoAnnouncementThreshold(remainingMs);
    if (threshold && lastAnnouncedThreshold.current !== threshold) {
      lastAnnouncedThreshold.current = threshold;
      setAnnouncement(t(`banner.announcements.${threshold}`));
    }
  }, [remainingMs, t]);

  const timeDetails =
    mounted && now !== null && exactExpiry !== null ? (
      <>
        {t("banner.expiry", { expiry: exactExpiry })} ·{" "}
        {t("banner.remaining", { duration: formatRemaining(locale, Math.max(0, expiryMs - now)) })}
      </>
    ) : (
      t("banner.loading")
    );

  useEffect(() => {
    if (resetState.errorCode === "DEMO_EXPIRED" || resetState.errorCode === "DEMO_DISABLED") {
      router.replace("/demo/expired");
      return;
    }
    if (resetState.completedResets > completedResets.current) {
      completedResets.current = resetState.completedResets;
      setResetDialogOpen(false);
      toast.success(t("reset.success"));
      router.replace("/");
      router.refresh();
    }
  }, [resetState, router, t]);

  const actions = () => (
    <>
      <AlertDialogTrigger
        render={
          <Button
            type="button"
            variant="outline"
            className="h-9 w-full bg-background/70 text-amber-950"
          >
            <RefreshCcw aria-hidden="true" />
            {t("banner.actions.reset")}
          </Button>
        }
      />
      <Link
        href="/login?from=demo"
        className="inline-flex h-9 w-full items-center justify-center gap-1.5 rounded-lg border border-amber-800/25 bg-background/70 px-2 text-sm font-medium text-amber-950 transition-colors hover:bg-background focus-visible:outline-none focus-visible:ring-3 focus-visible:ring-amber-600/50 dark:text-amber-100"
      >
        <UserRound aria-hidden="true" className="size-4" />
        {t("banner.actions.signIn")}
      </Link>
      <form action={exitPublicDemoAction} className="w-full">
        <Button
          type="submit"
          variant="outline"
          className="h-9 w-full bg-background/70 text-amber-950"
        >
          <LogOut aria-hidden="true" />
          {t("banner.actions.exit")}
        </Button>
      </form>
    </>
  );

  return (
    <AlertDialog open={resetDialogOpen} onOpenChange={setResetDialogOpen}>
      <section className="bg-amber-200 text-amber-950 shadow-sm dark:bg-amber-950 dark:text-amber-100 md:sticky md:top-0 md:z-40">
        <form id="demo-reset-form" action={resetAction} />
        <p className="sr-only" aria-live="polite">
          {announcement}
        </p>
        <div className="hidden min-h-12 items-center justify-between gap-4 px-4 py-2 md:flex">
          <p className="text-sm font-medium">
            {t("banner.title")} · {timeDetails}
          </p>
          <div className="flex min-w-[24rem] gap-2">{actions()}</div>
        </div>
        <div className="md:hidden">
          <p className="px-3 py-2 text-center text-xs font-semibold">
            {t("banner.title")} · {timeDetails}
          </p>
          <div className="grid grid-cols-3 gap-2 border-t border-amber-900/15 px-3 py-2">
            {actions()}
          </div>
        </div>
        {resetState.errorCode ? (
          <p role="alert" className="px-3 pb-2 text-center text-xs font-medium text-destructive">
            {t(`login.errors.${resetState.errorCode}`)}
          </p>
        ) : null}
      </section>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>{t("reset.title")}</AlertDialogTitle>
          <AlertDialogDescription>{t("reset.description")}</AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={resetting}>{t("reset.cancel")}</AlertDialogCancel>
          <AlertDialogAction
            form="demo-reset-form"
            type="submit"
            variant="destructive"
            disabled={resetting}
          >
            {resetting ? t("reset.resetting") : t("reset.confirm")}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
