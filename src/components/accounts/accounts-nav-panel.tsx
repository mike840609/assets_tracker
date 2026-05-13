import Link from "next/link";
import type { SerializedAccountWithHoldings } from "@/lib/types";

const CATEGORY_ICONS: Record<string, string> = {
  BANK: "🏦",
  BROKERAGE: "📈",
  CRYPTO_WALLET: "🪙",
  PROPERTY: "🏠",
  VEHICLE: "🚗",
  CREDIT_CARD: "💳",
  LOAN: "📋",
  MORTGAGE: "🏡",
  OTHER: "📁",
};

export function AccountsNavPanel({
  accounts,
  currentId,
}: {
  accounts: SerializedAccountWithHoldings[];
  currentId: string;
}) {
  const assets = accounts.filter((a) => a.type === "ASSET");
  const liabilities = accounts.filter((a) => a.type === "LIABILITY");

  return (
    <aside className="hidden md:flex flex-col w-44 xl:w-52 shrink-0 gap-1 pt-0.5 sticky top-6 self-start">
      <p className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground px-2 pb-1">
        Accounts
      </p>
      {assets.length > 0 && (
        <div className="space-y-0.5">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 pt-1 pb-0.5">
            Assets
          </p>
          {assets.map((account) => (
            <NavItem key={account.id} account={account} isActive={account.id === currentId} />
          ))}
        </div>
      )}
      {liabilities.length > 0 && (
        <div className="space-y-0.5 mt-2">
          <p className="text-[10px] uppercase tracking-wider text-muted-foreground/60 px-2 pt-1 pb-0.5">
            Liabilities
          </p>
          {liabilities.map((account) => (
            <NavItem key={account.id} account={account} isActive={account.id === currentId} />
          ))}
        </div>
      )}
    </aside>
  );
}

function NavItem({
  account,
  isActive,
}: {
  account: SerializedAccountWithHoldings;
  isActive: boolean;
}) {
  const icon = CATEGORY_ICONS[account.category] ?? "📁";
  return (
    <Link
      href={`/accounts/${account.id}`}
      transitionTypes={["nav-forward"]}
      className={`flex items-center gap-2 px-2 py-1.5 rounded-lg text-sm transition-colors ${
        isActive
          ? "bg-primary/10 text-primary font-medium"
          : "text-muted-foreground hover:bg-muted/60 hover:text-foreground"
      }`}
    >
      <span className="shrink-0">{icon}</span>
      <span className="truncate min-w-0">{account.name}</span>
    </Link>
  );
}
