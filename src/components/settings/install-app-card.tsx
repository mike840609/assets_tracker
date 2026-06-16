import { getTranslations } from "next-intl/server";
import { Card, CardContent } from "@/components/ui/card";

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 50 50"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 shrink-0 text-[#007AFF] dark:text-[#0A84FF]"
      fill="currentColor"
      aria-hidden="true"
    >
      <path d="M30.3 13.7L25 8.4l-5.3 5.3-1.4-1.4L25 5.6l6.7 6.7z" />
      <path d="M24 7h2v21h-2z" />
      <path d="M35 40H15c-1.7 0-3-1.3-3-3V19c0-1.7 1.3-3 3-3h7v2h-7c-.6 0-1 .4-1 1v18c0 .6.4 1 1 1h20c.6 0 1-.4 1-1V19c0-.6-.4-1-1-1h-7v-2h7c1.7 0 3 1.3 3 3v18c0 1.7-1.3 3-3 3z" />
    </svg>
  );
}

export async function InstallAppCard() {
  const t = await getTranslations("installApp");

  return (
    <section className="space-y-3 w-full">
      <h3 className="text-lg font-semibold text-foreground">{t("title")}</h3>
      <Card className="overflow-hidden p-0">
        <CardContent className="p-4 space-y-4">
          <div className="space-y-1">
            <p className="text-sm font-medium">{t("platform")}</p>
            <p className="text-sm text-muted-foreground">{t("description")}</p>
          </div>
          <ol className="list-decimal list-inside space-y-2 text-sm text-muted-foreground bg-muted/30 p-4 rounded-md">
            <li>{t("step1")}</li>
            <li>
              <span className="inline-flex items-center gap-1.5">
                {t("step2Before")}
                <ShareIcon />
                {t("step2After")}
              </span>
            </li>
            <li>{t("step3")}</li>
            <li>{t("step4")}</li>
          </ol>
        </CardContent>
      </Card>
    </section>
  );
}
