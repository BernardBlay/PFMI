import { db } from "@/lib/db";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  // Don't let a missing/unreachable database take down the whole dashboard
  const criticalAlert = await db.getMostCriticalAlert().catch(() => null);

  return (
    <DashboardShell criticalAlert={criticalAlert}>
      {children}
    </DashboardShell>
  );
}
