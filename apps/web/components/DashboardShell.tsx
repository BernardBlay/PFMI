"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import SideNav from "@/components/ui/SideNav";
import TopNav from "@/components/ui/TopNav";
import EmergencyAlert from "@/components/EmergencyAlert";
import { supabase } from "@/lib/db";
import type { Alert } from "@/lib/db";
import type { User } from "@supabase/supabase-js";

interface Props {
  children: React.ReactNode;
  criticalAlert: Alert | null;
  pageTitle?: string;
}

export default function DashboardShell({
  children,
  criticalAlert,
  pageTitle,
}: Props) {
  const [emergencyOpen, setEmergencyOpen] = useState(false);
  const [activeAlert, setActiveAlert] = useState<Alert | null>(criticalAlert);
  const [user, setUser] = useState<User | null>(null);
  const router = useRouter();

  useEffect(() => {
    let mounted = true;

    const checkUser = async () => {
      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session) {
        if (mounted) setUser(session.user);
      } else {
        const mockUserStr = typeof window !== "undefined" ? localStorage.getItem("pfmi-mock-user") : null;
        if (mockUserStr) {
          try {
            const mockUser = JSON.parse(mockUserStr);
            if (mounted) setUser(mockUser);
            return;
          } catch (e) {
            console.error("Failed to parse mock user session", e);
          }
        }

        // Always redirect to login page if unauthenticated
        router.push("/login");
        return;
      }
    };

    checkUser();

    // Subscribe to auth state updates
    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      if (mounted) {
        if (session) {
          setUser(session.user);
        } else {
          const mockUserStr = typeof window !== "undefined" ? localStorage.getItem("pfmi-mock-user") : null;
          if (mockUserStr) {
            try {
              setUser(JSON.parse(mockUserStr));
              return;
            } catch (e) {}
          }
          setUser(null);
          router.push("/login");
        }
      }
    });

    return () => {
      mounted = false;
      subscription.unsubscribe();
    };
  }, [router]);

  const openEmergency = () => {
    setActiveAlert(criticalAlert);
    setEmergencyOpen(true);
  };

  return (
    <>
      <SideNav onReportFault={openEmergency} user={user} />
      <div className="ml-64 flex flex-col min-h-screen">
        <TopNav onEmergencyClick={openEmergency} pageTitle={pageTitle} user={user} />
        <main className="flex-1 p-6 bg-background overflow-auto">
          {children}
        </main>
      </div>

      {emergencyOpen && (
        <EmergencyAlert
          alert={activeAlert}
          onClose={() => setEmergencyOpen(false)}
          onResolved={() => setActiveAlert(null)}
        />
      )}
    </>
  );
}
