"use client";

import { useState } from "react";
import { useTranslations } from "next-intl";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { TutorialDialog } from "./tutorial-dialog";

/**
 * A settings card that lets users replay the onboarding tutorial at any time.
 * Opening the dialog from here does not affect onboardingCompleted in the DB.
 */
export function TutorialCard() {
  const t = useTranslations("onboarding");
  const [open, setOpen] = useState(false);

  return (
    <Card className="max-w-lg">
      <CardHeader>
        <CardTitle>{t("tourTitle")}</CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        <p className="text-sm text-muted-foreground">{t("tourDescription")}</p>
        <Button variant="outline" onClick={() => setOpen(true)}>
          {t("takeTour")}
        </Button>
        <TutorialDialog open={open} onOpenChange={setOpen} />
      </CardContent>
    </Card>
  );
}
