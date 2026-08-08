"use client";

import { useEffect, useRef } from "react";
import { useTranslations } from "next-intl";
import { useRouter } from "next/navigation";
import { toast } from "sonner";

const TOAST_CODES = new Set(["DEMO_RATE_LIMITED", "DEMO_QUOTA_EXHAUSTED", "DEMO_RESTRICTED"]);

export function DemoResponseBoundary() {
  const router = useRouter();
  const t = useTranslations("demo.apiErrors");
  const notifiedCodes = useRef(new Set<string>());

  useEffect(() => {
    const originalFetch = window.fetch;
    window.fetch = async (input, init) => {
      const response = await originalFetch(input, init);
      const requestUrl = new URL(
        typeof input === "string" || input instanceof URL ? input : input.url,
        window.location.href,
      );
      if (
        requestUrl.origin !== window.location.origin ||
        !requestUrl.pathname.startsWith("/api/")
      ) {
        return response;
      }
      if (response.ok || !response.headers.get("content-type")?.includes("application/json")) {
        return response;
      }
      const payload = (await response
        .clone()
        .json()
        .catch(() => null)) as {
        error?: { code?: string };
      } | null;
      const code = payload?.error?.code;
      if (response.status === 410 && code === "DEMO_EXPIRED") router.replace("/demo/expired");
      if (response.status === 503 && code === "DEMO_DISABLED") router.replace("/demo/expired");
      if (code && TOAST_CODES.has(code) && !notifiedCodes.current.has(code)) {
        notifiedCodes.current.add(code);
        toast.error(t(code));
      }
      return response;
    };
    return () => {
      window.fetch = originalFetch;
    };
  }, [router, t]);

  return null;
}
