import Link from "next/link";
import { getTranslations } from "next-intl/server";
import { FileQuestion } from "lucide-react";
import { Button } from "@/components/ui/button";

export default async function NotFound() {
  const t = await getTranslations("errors");

  return (
    <div className="flex min-h-svh w-full flex-col items-center justify-center gap-6 p-6 text-center">
      <div className="rounded-full bg-muted p-8 shadow-sm">
        <FileQuestion className="size-10 text-muted-foreground" aria-hidden="true" />
      </div>
      <div className="space-y-2">
        <h1 className="text-3xl font-bold tracking-tight">404</h1>
        <h2 className="text-xl font-semibold">{t("notFoundTitle")}</h2>
        <p className="max-w-md text-sm text-muted-foreground">{t("notFoundDescription")}</p>
      </div>
      <Button render={<Link href="/" />}>{t("backHome")}</Button>
    </div>
  );
}
