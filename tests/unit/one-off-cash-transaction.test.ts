import { describe, expect, it, vi } from "vitest";

describe("submitOneOffCashTransaction", () => {
  it("posts a dated cash transaction and runs success refresh work", async () => {
    const { submitOneOffCashTransaction } =
      await import("@/components/accounts/account-stat-cards");
    const fetcher = vi.fn(async () => new Response(JSON.stringify({ data: { id: "tx1" } })));
    const onSuccess = vi.fn();

    await submitOneOffCashTransaction({
      accountId: "acc1",
      type: "DEPOSIT",
      amount: "1,234.50",
      occurrenceDate: "2026-07-06",
      note: "Paycheck",
      fetcher,
      onSuccess,
    });

    expect(fetcher).toHaveBeenCalledWith("/api/accounts/acc1/cash-transactions", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        type: "DEPOSIT",
        amount: 1234.5,
        occurrenceDate: "2026-07-06",
        note: "Paycheck",
      }),
    });
    expect(onSuccess).toHaveBeenCalledOnce();
  });
});
