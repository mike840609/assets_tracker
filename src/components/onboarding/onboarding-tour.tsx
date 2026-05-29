"use client";

import { useTranslations } from "next-intl";
import { Wallet, Landmark, LineChart, Sparkles } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Drawer, DrawerContent, DrawerHeader, DrawerTitle } from "@/components/ui/drawer";
import { useIsMobile } from "@/hooks/use-is-mobile";
import { useOnboarding } from "@/components/onboarding/onboarding-context";
import {
  OnboardingCarousel,
  type OnboardingSlide,
} from "@/components/onboarding/onboarding-carousel";

export function OnboardingTour() {
  const t = useTranslations("onboarding");
  const isMobile = useIsMobile();
  const { open, closeTour } = useOnboarding();

  const slides: OnboardingSlide[] = [
    { icon: Wallet, title: t("slide1Title"), description: t("slide1Description") },
    { icon: Landmark, title: t("slide2Title"), description: t("slide2Description") },
    { icon: LineChart, title: t("slide3Title"), description: t("slide3Description") },
    { icon: Sparkles, title: t("slide4Title"), description: t("slide4Description") },
  ];

  const labels = {
    back: t("back"),
    next: t("next"),
    skip: t("skip"),
    done: t("done"),
  };

  const carousel = <OnboardingCarousel slides={slides} labels={labels} onDone={closeTour} />;

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={(o) => !o && closeTour()}>
        <DrawerContent showCloseButton={false}>
          <DrawerHeader className="items-center text-center">
            <DrawerTitle>{t("title")}</DrawerTitle>
          </DrawerHeader>
          {carousel}
        </DrawerContent>
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && closeTour()}>
      <DialogContent className="sm:max-w-md p-0">
        <DialogHeader className="px-6 pt-6">
          <DialogTitle className="text-center">{t("title")}</DialogTitle>
        </DialogHeader>
        {carousel}
      </DialogContent>
    </Dialog>
  );
}
