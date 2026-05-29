import { Progress } from "@/components/ui/progress";

/**
 * Small fixed-width allocation/weight bar used in the accounts list and holdings
 * table. Wraps the Progress primitive so both surfaces share one accessible bar.
 */
export function AllocationBar({ value, label }: { value: number; label?: string }) {
  return <Progress value={Math.min(value, 100)} aria-label={label} className="h-1 w-14" />;
}
