import { prisma } from "@/lib/prisma";
import { AccountsList } from "@/components/accounts/accounts-list";
import { serializeAccountWithHoldings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountsPage() {
  const accounts = await prisma.account.findMany({
    include: { holdings: true },
    orderBy: { createdAt: "desc" },
  });

  const serialized = accounts.map(serializeAccountWithHoldings);

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Accounts</h2>
      <AccountsList accounts={serialized} />
    </div>
  );
}
