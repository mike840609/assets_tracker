import { prisma } from "@/lib/prisma";
import { SettingsForm } from "@/components/settings/settings-form";
import { auth, signOut } from "@/auth";
import { Button } from "@/components/ui/button";

export const dynamic = "force-dynamic";

export default async function SettingsPage() {
  const session = await auth();
  if (!session?.user?.id) return null;
  const userId = session.user.id;

  const settings = await prisma.setting.upsert({
    where: { userId },
    update: {},
    create: { userId, baseCurrency: "USD" },
  });

  return (
    <div className="space-y-6">
      <h2 className="text-2xl font-bold tracking-tight">Settings</h2>
      <SettingsForm currentCurrency={settings.baseCurrency} />
      
      <div className="mt-8 border-t pt-8">
        <h3 className="text-lg font-medium text-red-500 mb-4">Danger Zone</h3>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <Button variant="destructive" type="submit">
            Sign Out
          </Button>
        </form>
      </div>
    </div>
  );
}
