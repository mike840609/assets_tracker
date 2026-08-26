"use client";

export function RetryButton() {
  return (
    <button
      type="button"
      onClick={() => location.reload()}
      className="inline-flex h-11 md:h-8 items-center justify-center rounded-md bg-primary px-4 text-sm font-medium text-primary-foreground"
    >
      Retry / 重試
    </button>
  );
}
