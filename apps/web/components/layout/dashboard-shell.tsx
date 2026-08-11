"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Users2, Boxes, FileStack, LogOut, Shield } from "lucide-react";
import { useAuth } from "@/lib/auth";

const NAV = [
  { href: "/dashboard",           label: "Overview",   icon: LayoutGrid, roles: ["admin", "sales", "warehouse", "accounts"] },
  { href: "/dashboard/customers", label: "Customers",  icon: Users2,     roles: ["admin", "sales", "warehouse", "accounts"] },
  { href: "/dashboard/products",  label: "Products",   icon: Boxes,      roles: ["admin", "sales", "warehouse", "accounts"] },
  { href: "/dashboard/challans",  label: "Challans",   icon: FileStack,  roles: ["admin", "sales", "warehouse", "accounts"] },
  { href: "/dashboard/users",     label: "Users",      icon: Shield,     roles: ["admin"] },
];

export function DashboardShell({ children }: { children: React.ReactNode }) {
  const { user, loading, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your ledger...</div>;
  }
  if (!user) return null;

  return (
    <div className="flex min-h-screen bg-paper">
      <aside className="flex w-60 shrink-0 flex-col border-r border-line bg-white">
        <div className="border-b border-line px-5 py-5">
          <span className="font-display text-lg font-bold">Ledger</span>
        </div>
        <nav className="flex-1 space-y-1 px-3 py-4">
          {NAV.filter((item) => item.roles.includes(user.role)).map((item) => {
            const active = pathname === item.href || (item.href !== "/dashboard" && pathname?.startsWith(item.href));
            return (
              <Link
                key={item.href}
                href={item.href}
                className={`focus-ring flex items-center gap-3 rounded-md px-3 py-2 text-sm transition ${
                  active ? "bg-ink text-paper" : "text-ink/80 hover:bg-ink/5"
                }`}
              >
                <item.icon size={16} />
                {item.label}
              </Link>
            );
          })}
        </nav>
        <div className="border-t border-line px-5 py-4">
          <p className="text-sm font-medium">{user.name}</p>
          <p className="font-mono text-xs uppercase text-muted">{user.role}</p>
          <button
            onClick={() => logout()}
            className="focus-ring mt-3 flex items-center gap-2 text-xs text-muted hover:text-danger"
          >
            <LogOut size={14} /> Sign out
          </button>
        </div>
      </aside>
      <main className="flex-1 overflow-y-auto">
        <div className="mx-auto max-w-6xl px-8 py-8">{children}</div>
      </main>
    </div>
  );
}
