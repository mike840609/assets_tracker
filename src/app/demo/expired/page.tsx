import { after } from "next/server";
import Link from "next/link";
import { redirect } from "next/navigation";
import { Clock3 } from "lucide-react";
import { DemoLoginButton } from "@/components/demo/demo-login-button";
import { Button } from "@/components/ui/button";
import { getAuthContext } from "@/lib/auth-session";
import { deleteExpiredDemoUser } from "@/lib/demo/demo-service";
import { isPublicDemoEnabled } from "@/lib/env";
import { getTranslations } from "next-intl/server";

export default async function DemoExpiredPage() {
  const context = await getAuthContext();
  if (context.status === "active" && context.principal.kind === "formal") redirect("/");
  if (context.status === "demo-expired") {
    after(() => deleteExpiredDemoUser(context.userId, new Date()));
  }
  const t = await getTranslations("demo.expired");

  return (
    <main className="flex min-h-dvh items-center justify-center bg-background p-4">
      <section className="w-full max-w-md space-y-6 rounded-2xl border border-border bg-card p-6 text-card-foreground shadow-lg sm:p-8">
        <div className="space-y-3 text-center">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-200">
            <Clock3 aria-hidden="true" className="size-6" />
          </div>
          <h1 className="text-2xl font-bold">{t("title")}</h1>
          <p className="text-sm leading-6 text-muted-foreground">{t("description")}</p>
        </div>
        {isPublicDemoEnabled ? (
          <DemoLoginButton variant="restart" />
        ) : (
          <p className="rounded-lg bg-muted p-3 text-center text-sm text-muted-foreground">
            {t("disabled")}
          </p>
        )}
        <div className="space-y-3">
          <Button
            variant="outline"
            className="h-11 w-full"
            render={<Link href="/login?from=demo" />}
          >
            {t("signIn")}
          </Button>
          <p className="text-center text-xs text-muted-foreground">
            <Link href="/privacy" className="underline underline-offset-4 hover:text-foreground">
              {t("privacy")}
            </Link>
          </p>
        </div>
      </section>
    </main>
  );
}
