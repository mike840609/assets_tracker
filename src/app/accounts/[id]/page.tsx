import { prisma } from "@/lib/prisma";
import { notFound } from "next/navigation";
import { AccountDetail } from "@/components/accounts/account-detail";
import { serializeAccountWithHoldings } from "@/lib/types";

export const dynamic = "force-dynamic";

export default async function AccountDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = await params;
  const account = await prisma.account.findUnique({
    where: { id },
    include: { holdings: true },
  });

  if (!account) notFound();

  const prices = await prisma.priceCache.findMany({
    where: {
      symbol: { in: account.holdings.map((h) => h.symbol) },
    },
  });

  const priceMap = Object.fromEntries(
    prices.map((p) => [p.symbol, Number(p.price)])
  );

  const serialized = serializeAccountWithHoldings(account);

  return (
    <div className="space-y-6">
      <AccountDetail account={serialized} priceMap={priceMap} />
    </div>
  );
}
