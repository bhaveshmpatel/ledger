"use client";

import Link from "next/link";
import { useApiGet } from "@/hooks/use-api";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";

interface Summary {
  customerCount: number;
  productCount: number;
  draftChallans: number;
  confirmedChallans: number;
  lowStock: Array<{ id: string; name: string; sku: string; currentStock: number; minStockAlert: number }>;
  recentChallans: Array<{ id: string; challanNumber: string; status: string; totalQuantity: number }>;
}

export default function DashboardOverviewPage() {
  const { data, loading } = useApiGet<{ data: Summary }>("/dashboard/summary");
  const summary = data?.data;

  return (
    <div>
      <h1 className="font-display text-2xl font-bold">Overview</h1>
      <p className="mt-1 text-sm text-muted">Where the ledger stands right now.</p>

      {loading && <p className="mt-8 text-sm text-muted">Loading...</p>}

      {summary && (
        <>
          <div className="mt-8 grid grid-cols-2 gap-4 sm:grid-cols-4">
            <StatCard label="Customers" value={summary.customerCount} />
            <StatCard label="Products" value={summary.productCount} />
            <StatCard label="Draft challans" value={summary.draftChallans} />
            <StatCard label="Confirmed challans" value={summary.confirmedChallans} />
          </div>

          <div className="mt-10 grid grid-cols-1 gap-8 lg:grid-cols-2">
            <div>
              <h2 className="font-display text-lg font-bold">Low stock watch</h2>
              <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
                {summary.lowStock.length === 0 && <p className="p-4 text-sm text-muted">Nothing below threshold.</p>}
                {summary.lowStock.map((p) => (
                  <Link key={p.id} href={`/dashboard/products/${p.id}`} className="focus-ring flex items-center justify-between px-4 py-3 text-sm hover:bg-ink/5">
                    <span>
                      <span className="font-mono text-xs text-muted">{p.sku}</span> · {p.name}
                    </span>
                    <Badge tone="low">{p.currentStock} / {p.minStockAlert}</Badge>
                  </Link>
                ))}
              </div>
            </div>

            <div>
              <h2 className="font-display text-lg font-bold">Recent challans</h2>
              <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
                {summary.recentChallans.map((ch) => (
                  <Link key={ch.id} href={`/dashboard/challans/${ch.id}`} className="focus-ring flex items-center justify-between px-4 py-3 text-sm hover:bg-ink/5">
                    <span className="font-mono text-xs">{ch.challanNumber}</span>
                    <span className="text-muted">{ch.totalQuantity} units</span>
                    <Badge tone={ch.status}>{ch.status}</Badge>
                  </Link>
                ))}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
