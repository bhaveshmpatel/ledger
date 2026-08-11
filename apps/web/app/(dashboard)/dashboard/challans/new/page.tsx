"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Trash2, Plus } from "lucide-react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth } from "@/lib/auth";
import { api, ApiClientError } from "@/lib/api";

interface Customer { id: string; name: string; businessName: string; }
interface Product { id: string; name: string; sku: string; unitPrice: string; currentStock: number; }
interface Line { productId: string; quantity: string; }

export default function NewChallanPage() {
  const { accessToken } = useAuth();
  const router = useRouter();
  const { data: customersData } = useApiGet<{ data: Customer[] }>("/customers?limit=100");
  const { data: productsData } = useApiGet<{ data: Product[] }>("/products?limit=100");

  const [customerId, setCustomerId] = useState("");
  const [lines, setLines] = useState<Line[]>([{ productId: "", quantity: "1" }]);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();
  const [submitting, setSubmitting] = useState(false);

  const products = productsData?.data ?? [];

  function updateLine(idx: number, patch: Partial<Line>) {
    setLines((ls) => ls.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setFieldErrors(undefined);
    setSubmitting(true);
    try {
      const items = lines.filter((l) => l.productId && l.quantity).map((l) => ({ productId: l.productId, quantity: Number(l.quantity) }));
      const res = await api.post<{ data: { id: string } }>("/challans", { customerId, items }, accessToken!);
      router.push(`/dashboard/challans/${res.data.id}`);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFieldErrors(err.fields);
      } else {
        setError("Failed to create challan");
      }
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="max-w-2xl">
      <h1 className="font-display text-2xl font-bold">New sales challan</h1>
      <p className="mt-1 text-sm text-muted">Saved as a draft — nothing touches stock until you confirm it.</p>

      <form onSubmit={submit} className="mt-8 space-y-6">
        <div>
          <label className="mb-1.5 block text-sm font-medium">Customer</label>
          <select required value={customerId} onChange={(e) => setCustomerId(e.target.value)} className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2 text-sm">
            <option value="">Select a customer</option>
            {customersData?.data.map((c) => <option key={c.id} value={c.id}>{c.name} — {c.businessName}</option>)}
          </select>
        </div>

        <div>
          <div className="mb-1.5 flex items-center justify-between">
            <label className="text-sm font-medium">Products</label>
            <button type="button" onClick={() => setLines((ls) => [...ls, { productId: "", quantity: "1" }])} className="focus-ring flex items-center gap-1 text-xs text-accent hover:underline">
              <Plus size={14} /> Add line
            </button>
          </div>
          <div className="space-y-2">
            {lines.map((line, idx) => {
              const product = products.find((p) => p.id === line.productId);
              return (
                <div key={idx} className="flex items-center gap-2">
                  <select value={line.productId} onChange={(e) => updateLine(idx, { productId: e.target.value })} className="focus-ring flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm">
                    <option value="">Select product</option>
                    {products.map((p) => <option key={p.id} value={p.id}>{p.sku} — {p.name} ({p.currentStock} in stock)</option>)}
                  </select>
                  <input
                    type="number" min={1} value={line.quantity}
                    onChange={(e) => updateLine(idx, { quantity: e.target.value })}
                    className="focus-ring w-24 rounded-md border border-line px-3 py-2 text-sm"
                  />
                  <button type="button" onClick={() => setLines((ls) => ls.filter((_, i) => i !== idx))} className="focus-ring text-muted hover:text-danger">
                    <Trash2 size={16} />
                  </button>
                </div>
              );
            })}
          </div>
        </div>

        {error && (
          <div className="rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
            <p>{error}</p>
            {fieldErrors && (
              <ul className="mt-1 list-inside list-disc font-mono text-xs">
                {Object.entries(fieldErrors).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
              </ul>
            )}
          </div>
        )}

        <button disabled={submitting} className="focus-ring rounded-md bg-ink px-5 py-2.5 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
          {submitting ? "Saving..." : "Save as draft"}
        </button>
      </form>
    </div>
  );
}
