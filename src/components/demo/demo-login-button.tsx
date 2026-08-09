"use client";

import { useActionState } from "react";
import { useTranslations } from "next-intl";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { startPublicDemoAction, type DemoActionState } from "@/app/demo/actions";

const INITIAL_DEMO_ACTION_STATE: DemoActionState = { errorCode: null };

export function DemoLoginButton({ variant = "start" }: { variant?: "start" | "restart" }) {
  const t = useTranslations("demo.login");
  const [state, action, pending] = useActionState(startPublicDemoAction, INITIAL_DEMO_ACTION_STATE);
  return (
    <form action={action} className="space-y-2">
      {/* ponytail: same class list as the Google button in login/page.tsx, minus the logo */}
      <Button
        type="submit"
        disabled={pending}
        className="flex h-12 w-full items-center justify-center gap-3 rounded-xl border border-border bg-background text-sm font-medium tracking-wide text-foreground shadow-sm transition-all hover:-translate-y-0.5 hover:bg-secondary hover:shadow-md"
      >
        {pending ? <Loader2 className="mr-2 size-4 animate-spin" aria-hidden="true" /> : null}
        {pending ? t("preparing") : t(variant === "restart" ? "restartButton" : "button")}
      </Button>
      <p className="text-center text-xs text-muted-foreground">{t("description")}</p>
      {state.errorCode ? (
        <p role="alert" className="text-center text-xs text-destructive">
          {t(`errors.${state.errorCode}`)}
        </p>
      ) : null}
    </form>
  );
}
