"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus } from "lucide-react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";

interface Challan { id: string; challanNumber: string; status: string; totalQuantity: number; createdAt: string; }

export default function ChallansPage() {
  const { user } = useAuth();
  const [status, setStatus] = useState("");
  const { data } = useApiGet<{ data: Challan[] }>(`/challans?status=${status}&limit=50`, [status]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Sales challans</h1>
          <p className="mt-1 text-sm text-muted">Draft, confirm, and track stock-out per challan.</p>
        </div>
        {can.manageChallans(user?.role) && (
          <Link href="/dashboard/challans/new" className="focus-ring flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent">
            <Plus size={16} /> New challan
          </Link>
        )}
      </div>

      <div className="mt-6 flex gap-2">
        {["", "draft", "confirmed", "cancelled"].map((s) => (
          <button
            key={s}
            onClick={() => setStatus(s)}
            className={`focus-ring rounded-md border px-3 py-1.5 text-xs font-medium capitalize ${status === s ? "border-ink bg-ink text-paper" : "border-line text-muted hover:bg-ink/5"}`}
          >
            {s || "All"}
          </button>
        ))}
      </div>

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase text-muted">
            <tr><th className="px-4 py-3">Challan #</th><th className="px-4 py-3">Total qty</th><th className="px-4 py-3">Status</th><th className="px-4 py-3">Created</th></tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.data.map((ch) => (
              <tr key={ch.id} className="hover:bg-ink/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/challans/${ch.id}`} className="focus-ring font-mono text-xs font-medium hover:text-accent">{ch.challanNumber}</Link>
                </td>
                <td className="px-4 py-3">{ch.totalQuantity}</td>
                <td className="px-4 py-3"><Badge tone={ch.status}>{ch.status}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{new Date(ch.createdAt).toLocaleDateString()}</td>
              </tr>
            ))}
            {data?.data.length === 0 && <tr><td colSpan={4} className="px-4 py-8 text-center text-muted">No challans yet.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
