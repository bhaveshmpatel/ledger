"use client";

import { useState } from "react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { api, ApiClientError } from "@/lib/api";

interface Item { id: string; productName: string; productSku: string; unitPrice: string; quantity: number; productId: string; }
interface Product { id: string; name: string; sku: string; unitPrice: string; currentStock: number; }
interface Customer { id: string; name: string; businessName: string; }
interface Challan {
  id: string; challanNumber: string; status: string; totalQuantity: number; createdAt: string;
  customer: { name: string; businessName: string }; items: Item[];
}

export default function ChallanDetailPage({ params }: { params: { id: string } }) {
  const { user, accessToken } = useAuth();
  const { data, refetch } = useApiGet<{ data: Challan }>(`/challans/${params.id}`);
  const { data: customersData } = useApiGet<{ data: Customer[] }>(`/customers?limit=100`);
  const { data: productsData } = useApiGet<{ data: Product[] }>(`/products?limit=100`);

  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string> | undefined>();
  const [busy, setBusy] = useState(false);

  // edit mode
  const [editing, setEditing] = useState(false);
  const [editCustomerId, setEditCustomerId] = useState("");
  const [editItems, setEditItems] = useState<{ productId: string; quantity: number }[]>([]);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);

  const challan = data?.data;
  const customers = customersData?.data ?? [];
  const products = productsData?.data ?? [];

  function startEdit() {
    if (!challan) return;
    // Find customer id by matching name — fetch full challan data has customer embedded
    // We'll pass customerId via a hidden lookup
    setEditCustomerId(""); // will be set from select
    setEditItems(
      challan.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
    );
    setEditError(null);
    setEditing(true);
  }

  function addEditItem() {
    setEditItems(items => [...items, { productId: "", quantity: 1 }]);
  }

  function removeEditItem(idx: number) {
    setEditItems(items => items.filter((_, i) => i !== idx));
  }

  function updateEditItem(idx: number, field: "productId" | "quantity", value: string | number) {
    setEditItems(items => items.map((item, i) =>
      i === idx ? { ...item, [field]: field === "quantity" ? Number(value) : value } : item
    ));
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    if (editItems.some(i => !i.productId)) {
      setEditError("Please select a product for each line item.");
      return;
    }
    if (editItems.length === 0) {
      setEditError("Add at least one product.");
      return;
    }
    setSaving(true); setEditError(null);
    try {
      const body: Record<string, unknown> = { items: editItems };
      if (editCustomerId) body.customerId = editCustomerId;
      await api.patch(`/challans/${params.id}`, body, accessToken!);
      await refetch();
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiClientError) setEditError(err.message);
    } finally {
      setSaving(false);
    }
  }

  async function confirm() {
    setBusy(true); setError(null); setFieldErrors(undefined);
    try {
      await api.post(`/challans/${params.id}/confirm`, undefined, accessToken!);
      refetch();
    } catch (err) {
      if (err instanceof ApiClientError) { setError(err.message); setFieldErrors(err.fields); }
    } finally { setBusy(false); }
  }

  async function cancel() {
    setBusy(true); setError(null);
    try {
      await api.post(`/challans/${params.id}/cancel`, undefined, accessToken!);
      refetch();
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
    } finally { setBusy(false); }
  }

  async function downloadPdf() {
    setBusy(true); setError(null);
    try {
      const API_URL = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000/api/v1";
      const res = await fetch(`${API_URL}/challans/${params.id}/pdf`, {
        headers: { Authorization: `Bearer ${accessToken}` },
        credentials: "include",
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        setError((body as any)?.error?.message ?? "Failed to generate PDF");
        return;
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      window.open(url, "_blank", "noopener");
    } catch {
      setError("Could not fetch PDF. Check your connection.");
    } finally {
      setBusy(false);
    }
  }

  if (!challan) return <p className="text-sm text-muted">Loading...</p>;
  const total = challan.items.reduce((sum, i) => sum + i.quantity * Number(i.unitPrice), 0);
  const canManage = can.manageChallans(user?.role);
  const isDraft = challan.status === "draft";

  return (
    <div className="max-w-3xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-mono text-2xl font-bold">{challan.challanNumber}</h1>
          <p className="mt-1 text-sm text-muted">{challan.customer.name} · {challan.customer.businessName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={challan.status}>{challan.status}</Badge>
          {canManage && isDraft && !editing && (
            <button
              onClick={startEdit}
              className="focus-ring rounded-md border border-line px-4 py-1.5 text-sm font-medium hover:bg-ink/5"
            >
              Edit draft
            </button>
          )}
        </div>
      </div>

      {/* ── Edit form (draft only) ─────────────────────────────────── */}
      {editing && (
        <form onSubmit={saveEdit} className="mt-6 rounded-lg border border-accent/30 bg-accent/5 p-5">
          <p className="mb-4 text-xs font-bold uppercase tracking-widest text-accent">Editing draft challan</p>

          {editError && (
            <div className="mb-4 rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</div>
          )}

          {/* Customer override */}
          <div className="mb-4">
            <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">Change Customer (optional)</label>
            <select
              value={editCustomerId}
              onChange={e => setEditCustomerId(e.target.value)}
              className="focus-ring w-full rounded-md border border-line bg-white px-3 py-2 text-sm"
            >
              <option value="">— keep current: {challan.customer.name} ({challan.customer.businessName}) —</option>
              {customers.map(c => (
                <option key={c.id} value={c.id}>{c.name} — {c.businessName}</option>
              ))}
            </select>
          </div>

          {/* Line items */}
          <p className="mb-2 text-xs font-medium uppercase tracking-wide text-muted">Line Items</p>
          <div className="space-y-2">
            {editItems.map((item, idx) => (
              <div key={idx} className="flex items-center gap-2">
                <select
                  value={item.productId}
                  onChange={e => updateEditItem(idx, "productId", e.target.value)}
                  className="focus-ring flex-1 rounded-md border border-line bg-white px-3 py-2 text-sm"
                  required
                >
                  <option value="">Select product...</option>
                  {products.map(p => (
                    <option key={p.id} value={p.id}>
                      {p.name} [{p.sku}] — ₹{Number(p.unitPrice).toFixed(2)} · {p.currentStock} in stock
                    </option>
                  ))}
                </select>
                <input
                  type="number"
                  min="1"
                  value={item.quantity}
                  onChange={e => updateEditItem(idx, "quantity", e.target.value)}
                  className="focus-ring w-20 rounded-md border border-line px-2 py-2 text-sm"
                  required
                />
                <button
                  type="button"
                  onClick={() => removeEditItem(idx)}
                  className="rounded-md border border-red-200 px-2 py-2 text-xs text-red-500 hover:bg-red-50"
                >
                  ✕
                </button>
              </div>
            ))}
          </div>

          <button
            type="button"
            onClick={addEditItem}
            className="mt-3 text-xs text-accent hover:underline"
          >
            + Add line item
          </button>

          <div className="mt-4 flex gap-2">
            <button type="submit" disabled={saving} className="focus-ring flex-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
              {saving ? "Saving..." : "Save draft"}
            </button>
            <button type="button" onClick={() => setEditing(false)} className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5">
              Cancel
            </button>
          </div>
        </form>
      )}

      {/* ── Items table ─────────────────────────────────────────────── */}
      {!editing && (
        <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
          <table className="w-full text-sm min-w-[600px]">
            <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase text-muted">
              <tr><th className="px-4 py-2">SKU</th><th className="px-4 py-2">Product</th><th className="px-4 py-2">Qty</th><th className="px-4 py-2">Rate</th><th className="px-4 py-2">Amount</th></tr>
            </thead>
            <tbody className="divide-y divide-line">
              {challan.items.map((i) => (
                <tr key={i.id}>
                  <td className="px-4 py-2 font-mono text-xs">{i.productSku}</td>
                  <td className="px-4 py-2">{i.productName}</td>
                  <td className="px-4 py-2">{i.quantity}</td>
                  <td className="px-4 py-2 font-mono text-xs">₹{Number(i.unitPrice).toFixed(2)}</td>
                  <td className="px-4 py-2 font-mono text-xs">₹{(i.quantity * Number(i.unitPrice)).toFixed(2)}</td>
                </tr>
              ))}
            </tbody>
          </table>
          <div className="border-t border-line px-4 py-3 text-right font-mono text-sm font-medium">Total: ₹{total.toFixed(2)}</div>
        </div>
      )}

      {/* ── Error display ───────────────────────────────────────────── */}
      {error && (
        <div className="mt-4 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">
          <p>{error}</p>
          {fieldErrors && (
            <ul className="mt-1 list-inside list-disc font-mono text-xs">
              {Object.entries(fieldErrors).map(([k, v]) => <li key={k}>{k}: {v}</li>)}
            </ul>
          )}
        </div>
      )}

      {/* ── Action buttons ─────────────────────────────────────────── */}
      <div className="mt-6 flex flex-wrap gap-3">
        {isDraft && canManage && !editing && (
          <button onClick={confirm} disabled={busy} className="focus-ring rounded-md bg-success px-4 py-2 text-sm font-medium text-paper hover:opacity-90 disabled:opacity-60">
            Confirm challan
          </button>
        )}
        {challan.status !== "cancelled" && canManage && !editing && (
          <button onClick={cancel} disabled={busy} className="focus-ring rounded-md border border-danger px-4 py-2 text-sm font-medium text-danger hover:bg-danger/10 disabled:opacity-60">
            Cancel challan
          </button>
        )}
        {can.exportInvoice(user?.role) && !editing && (
          <button onClick={downloadPdf} disabled={busy} className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5 disabled:opacity-60">
            Export PDF
          </button>
        )}
      </div>
    </div>
  );
}
