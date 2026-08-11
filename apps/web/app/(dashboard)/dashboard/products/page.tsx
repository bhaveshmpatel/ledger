"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";

interface Product {
  id: string; name: string; sku: string; category: string; unitPrice: string;
  currentStock: number; minStockAlert: number; location: string | null;
}

export default function ProductsPage() {
  const { user, accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [showForm, setShowForm] = useState(false);
  const { data, refetch } = useApiGet<{ data: Product[] }>(`/products?search=${encodeURIComponent(search)}&limit=50`, [search]);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Products</h1>
          <p className="mt-1 text-sm text-muted">Catalog and live stock levels.</p>
        </div>
        {can.manageProducts(user?.role) && (
          <button onClick={() => setShowForm((v) => !v)} className="focus-ring flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent">
            <Plus size={16} /> New product
          </button>
        )}
      </div>

      <div className="mt-6 flex items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
        <Search size={16} className="text-muted" />
        <input value={search} onChange={(e) => setSearch(e.target.value)} placeholder="Search by name" className="focus-ring w-full text-sm outline-none" />
      </div>

      {showForm && <NewProductForm token={accessToken!} onCreated={() => { setShowForm(false); refetch(); }} />}

      <div className="mt-6 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">SKU</th><th className="px-4 py-3">Name</th><th className="px-4 py-3">Category</th>
              <th className="px-4 py-3">Price</th><th className="px-4 py-3">Stock</th><th className="px-4 py-3">Location</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.data.map((p) => {
              const low = p.currentStock <= p.minStockAlert;
              return (
                <tr key={p.id} className="hover:bg-ink/[0.02]">
                  <td className="px-4 py-3 font-mono text-xs">{p.sku}</td>
                  <td className="px-4 py-3">
                    <Link href={`/dashboard/products/${p.id}`} className="focus-ring font-medium hover:text-accent">{p.name}</Link>
                  </td>
                  <td className="px-4 py-3 text-muted">{p.category}</td>
                  <td className="px-4 py-3 font-mono text-xs">₹{Number(p.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-3"><Badge tone={low ? "low" : "ok"}>{p.currentStock} in stock</Badge></td>
                  <td className="px-4 py-3 text-muted">{p.location ?? "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function NewProductForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [form, setForm] = useState({ name: "", sku: "", category: "", unitPrice: "", currentStock: "0", minStockAlert: "0", location: "" });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/products", form, token);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create product");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-3">
      {(["name", "sku", "category", "unitPrice", "currentStock", "minStockAlert", "location"] as const).map((field) => (
        <div key={field}>
          <label className="mb-1.5 block text-sm font-medium capitalize">{field.replace(/([A-Z])/g, " $1")}</label>
          <input
            value={(form as any)[field]}
            onChange={(e) => setForm({ ...form, [field]: e.target.value })}
            required={field !== "location"}
            className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm"
          />
        </div>
      ))}
      {error && <p className="sm:col-span-3 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="sm:col-span-3">
        <button disabled={submitting} className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
          {submitting ? "Saving..." : "Save product"}
        </button>
      </div>
    </form>
  );
}
