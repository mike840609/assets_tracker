"use client";

import { useCallback, useEffect, useRef, useTransition } from "react";
import { useRouter } from "next/navigation";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";

export function HistoryPullRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const resolveRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!isPending && resolveRef.current) {
      resolveRef.current();
      resolveRef.current = null;
    }
  }, [isPending]);

  const onRefresh = useCallback(() => {
    return new Promise<void>((resolve) => {
      resolveRef.current?.();
      resolveRef.current = resolve;
      startTransition(() => {
        router.refresh();
      });
    });
  }, [router]);

  return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>;
}
