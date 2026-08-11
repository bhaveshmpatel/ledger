"use client";

import Link from "next/link";
import { useApiGet } from "@/hooks/use-api";
import { StatCard } from "@/components/ui/stat-card";
import { Badge } from "@/components/ui/badge";
import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";

interface Summary {
  customerCount: number;
  productCount: number;
  draftChallans: number;
  confirmedChallans: number;
  lowStock: Array<{ id: string; name: string; sku: string; currentStock: number; minStockAlert: number }>;
  recentChallans: Array<{ id: string; challanNumber: string; status: string; totalQuantity: number }>;
  salesHistory: Array<{ date: string; units: number }>;
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

          <div className="mt-10">
            <h2 className="font-display text-lg font-bold">Sales over 30 days (Confirmed units)</h2>
            <div className="mt-4 h-72 rounded-lg border border-line bg-white p-5">
              {summary.salesHistory?.length === 0 ? (
                <div className="flex h-full items-center justify-center text-sm text-muted">No confirmed sales data.</div>
              ) : (
                <ResponsiveContainer width="100%" height="100%">
                  <AreaChart data={summary.salesHistory}>
                    <defs>
                      <linearGradient id="colorUnits" x1="0" y1="0" x2="0" y2="1">
                        <stop offset="5%" stopColor="#171717" stopOpacity={0.1} />
                        <stop offset="95%" stopColor="#171717" stopOpacity={0} />
                      </linearGradient>
                    </defs>
                    <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E5E5E5" />
                    <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#737373" }} dy={10} />
                    <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: "#737373" }} dx={-10} />
                    <Tooltip
                      contentStyle={{ borderRadius: "8px", border: "1px solid #E5E5E5", boxShadow: "0 4px 6px -1px rgb(0 0 0 / 0.1)" }}
                      itemStyle={{ color: "#171717", fontWeight: 600 }}
                    />
                    <Area type="monotone" dataKey="units" stroke="#171717" strokeWidth={2} fillOpacity={1} fill="url(#colorUnits)" />
                  </AreaChart>
                </ResponsiveContainer>
              )}
            </div>
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
