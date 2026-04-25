"use client";

import { useEffect, useState, startTransition } from "react";
import { Button } from "@/components/ui/button";

export function ConsentBanner() {
  const [show, setShow] = useState(false);

  useEffect(() => {
    // Check if consent has already been given or rejected
    const hasConsentCookie = document.cookie.includes("cookie-consent=");
    if (!hasConsentCookie) {
      startTransition(() => {
        setShow(true);
      });
    }
  }, []);

  const handleAccept = () => {
    // Set cookie for 1 year
    document.cookie = "cookie-consent=true; path=/; max-age=31536000; SameSite=Lax";
    setShow(false);
  };

  const handleReject = () => {
    // Set cookie for 1 year
    document.cookie = "cookie-consent=false; path=/; max-age=31536000; SameSite=Lax";
    setShow(false);
  };

  if (!show) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 p-4 bg-background/80 backdrop-blur-md border-t shadow-lg flex flex-col sm:flex-row items-center justify-between gap-4">
      <div className="text-sm text-muted-foreground flex-1">
        We use essential cookies to make our site work. With your consent, we may also use non-essential cookies to improve user experience and analyze website traffic.
      </div>
      <div className="flex gap-2">
        <Button variant="outline" onClick={handleReject}>
          Reject non-essential
        </Button>
        <Button onClick={handleAccept}>
          Accept
        </Button>
      </div>
    </div>
  );
}
