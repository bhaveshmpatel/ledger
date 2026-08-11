"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { LayoutGrid, Users2, Boxes, FileStack, LogOut, Shield, Menu, X } from "lucide-react";
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
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);

  useEffect(() => {
    if (!loading && !user) router.replace("/login");
  }, [loading, user, router]);

  // Close mobile menu on route change
  useEffect(() => {
    setMobileMenuOpen(false);
  }, [pathname]);

  if (loading) {
    return <div className="flex min-h-screen items-center justify-center text-sm text-muted">Loading your ledger...</div>;
  }
  if (!user) return null;

  const SidebarContent = () => (
    <>
      <div className="flex items-center justify-between border-b border-line px-5 py-5">
        <span className="font-display text-lg font-bold">Ledger</span>
        <button className="md:hidden p-1 text-muted hover:bg-ink/5 rounded" onClick={() => setMobileMenuOpen(false)}>
          <X size={20} />
        </button>
      </div>
      <nav className="flex-1 space-y-1 overflow-y-auto px-3 py-4">
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
      <div className="border-t border-line px-5 py-4 shrink-0">
        <p className="text-sm font-medium">{user.name}</p>
        <p className="font-mono text-xs uppercase text-muted">{user.role}</p>
        <button
          onClick={() => logout()}
          className="focus-ring mt-3 flex items-center gap-2 text-xs text-muted hover:text-danger"
        >
          <LogOut size={14} /> Sign out
        </button>
      </div>
    </>
  );

  return (
    <div className="flex h-screen bg-paper overflow-hidden flex-col md:flex-row">
      {/* Mobile Top Header */}
      <header className="flex h-14 items-center justify-between border-b border-line bg-white px-4 md:hidden shrink-0">
        <span className="font-display text-lg font-bold">Ledger</span>
        <button className="p-2 text-ink hover:bg-ink/5 rounded-md" onClick={() => setMobileMenuOpen(true)}>
          <Menu size={20} />
        </button>
      </header>

      {/* Desktop Sidebar */}
      <aside className="hidden h-full w-60 shrink-0 flex-col border-r border-line bg-white md:flex">
        <SidebarContent />
      </aside>

      {/* Mobile Off-canvas Sidebar */}
      {mobileMenuOpen && (
        <div className="fixed inset-0 z-50 flex md:hidden">
          {/* Backdrop */}
          <div className="fixed inset-0 bg-ink/40 backdrop-blur-sm" onClick={() => setMobileMenuOpen(false)} />
          {/* Drawer */}
          <aside className="relative flex w-[280px] max-w-[80vw] flex-col bg-white shadow-xl h-full animate-in slide-in-from-left">
            <SidebarContent />
          </aside>
        </div>
      )}

      {/* Main Content */}
      <main className="flex-1 h-full overflow-y-auto">
        <div className="mx-auto max-w-6xl p-4 sm:p-8">{children}</div>
      </main>
    </div>
  );
}
