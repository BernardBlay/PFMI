import { db } from "@/lib/db";
import DashboardShell from "@/components/DashboardShell";

export default async function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const criticalAlert = await db.getMostCriticalAlert();

  return (
    <DashboardShell criticalAlert={criticalAlert}>
      {children}
    </DashboardShell>
  );
}
