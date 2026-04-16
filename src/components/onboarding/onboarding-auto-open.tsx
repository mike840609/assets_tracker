"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { TutorialDialog } from "./tutorial-dialog";

/**
 * Mounts in the layout for first-time users only (rendered by OnboardingCheck RSC).
 * Starts the dialog open and marks onboarding complete when the user closes it.
 */
export function OnboardingAutoOpen() {
  const router = useRouter();
  const [open, setOpen] = useState(true);

  async function handleClose() {
    setOpen(false);
    try {
      await fetch("/api/onboarding", { method: "DELETE" });
    } catch {
      // Fail silently — worst case the dialog appears again next session
    }
    // Soft-refresh all RSCs so OnboardingCheck finds onboardingCompleted: true
    // and stops rendering this component.
    router.refresh();
  }

  return <TutorialDialog open={open} onOpenChange={handleClose} />;
}
