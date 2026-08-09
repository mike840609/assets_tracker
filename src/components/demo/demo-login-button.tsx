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
      {/* ponytail: border carries the visibility, not the fill — the neutral fill steps
          are ~1.1:1 against the glass card in both themes, the border clears 3:1 */}
      <Button
        type="submit"
        variant="secondary"
        disabled={pending}
        className="h-12 w-full rounded-xl border border-muted-foreground/90"
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
