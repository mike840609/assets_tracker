import { getTranslations } from "next-intl/server";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SmartphoneIcon } from "lucide-react";

function ShareIcon() {
  return (
    <svg
      viewBox="0 0 50 50"
      xmlns="http://www.w3.org/2000/svg"
      className="h-4 w-4 shrink-0"
      fill="#007AFF"
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
    <div className="max-w-lg">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <SmartphoneIcon className="h-5 w-5" />
            {t("title")}
          </CardTitle>
          <p className="text-sm text-muted-foreground">{t("description")}</p>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            {t("platform")}
          </p>
          <ol className="list-decimal list-inside space-y-2">
            <li className="text-sm">{t("step1")}</li>
            <li className="text-sm">
              <span className="inline-flex items-center gap-1.5">
                {t("step2Before")}
                <ShareIcon />
                {t("step2After")}
              </span>
            </li>
            <li className="text-sm">{t("step3")}</li>
            <li className="text-sm">{t("step4")}</li>
          </ol>
        </CardContent>
      </Card>
    </div>
  );
}
