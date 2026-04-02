import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const settings = await prisma.setting.upsert({
    where: { id: "app_settings" },
    update: {},
    create: { id: "app_settings", baseCurrency: "USD" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      <SettingsForm currentCurrency={settings.baseCurrency} />
    </div>
  );
}
