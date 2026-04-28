"use client";

import { useCallback } from "react";
import { useRouter } from "next/navigation";
import { PullToRefresh } from "@/components/layout/pull-to-refresh";

export function AnalysisPullRefresh({ children }: { children: React.ReactNode }) {
  const router = useRouter();

  const onRefresh = useCallback(async () => {
    router.refresh();
  }, [router]);

  return <PullToRefresh onRefresh={onRefresh}>{children}</PullToRefresh>;
}
