import { AuthProvider } from "@/components/providers/auth-provider";
import { DashboardShell } from "@/components/layout/dashboard-shell";

export default function DashboardGroupLayout({ children }: { children: React.ReactNode }) {
  return (
    <AuthProvider>
      <DashboardShell>{children}</DashboardShell>
    </AuthProvider>
  );
}
