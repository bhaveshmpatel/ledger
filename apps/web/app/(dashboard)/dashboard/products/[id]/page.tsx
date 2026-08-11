"use client";

import { useState } from "react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { api, ApiClientError } from "@/lib/api";

interface Product {
  id: string; name: string; sku: string; category: string; unitPrice: string;
  currentStock: number; minStockAlert: number; location: string | null; imageUrl: string | null;
}
interface Movement { id: string; quantityChanged: number; movementType: "IN" | "OUT"; reason: string; createdAt: string; }

export default function ProductDetailPage({ params }: { params: { id: string } }) {
  const { user, accessToken } = useAuth();
  const { data, refetch } = useApiGet<{ data: Product }>(`/products/${params.id}`);
  const { data: movementsData, refetch: refetchMovements } = useApiGet<{ data: Movement[] }>(`/products/${params.id}/movements`);

  // stock adjustment state
  const [qty, setQty] = useState("");
  const [type, setType] = useState<"IN" | "OUT">("IN");
  const [reason, setReason] = useState("");
  const [stockError, setStockError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  // edit state
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editError, setEditError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<{
    name: string; sku: string; category: string;
    unitPrice: string; minStockAlert: string; location: string;
  }>({
    name: "", sku: "", category: "", unitPrice: "", minStockAlert: "", location: "",
  });

  const product = data?.data;

  function startEdit() {
    if (!product) return;
    setForm({
      name: product.name,
      sku: product.sku,
      category: product.category,
      unitPrice: Number(product.unitPrice).toFixed(2),
      minStockAlert: String(product.minStockAlert),
      location: product.location ?? "",
    });
    setEditError(null);
    setFieldErrors({});
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setEditError(null); setFieldErrors({});
    try {
      await api.patch(`/products/${params.id}`, {
        name: form.name,
        sku: form.sku,
        category: form.category,
        unitPrice: parseFloat(form.unitPrice),
        minStockAlert: parseInt(form.minStockAlert, 10),
        location: form.location || undefined,
      }, accessToken!);
      await refetch();
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setEditError(err.message);
        setFieldErrors(err.fields ?? {});
      }
    } finally {
      setSaving(false);
    }
  }

  async function adjustStock(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setStockError(null);
    try {
      await api.post(`/products/${params.id}/movements`, { quantityChanged: qty, movementType: type, reason }, accessToken!);
      setQty(""); setReason("");
      refetch(); refetchMovements();
    } catch (err) {
      setStockError(err instanceof ApiClientError ? err.message : "Failed to adjust stock");
    } finally {
      setSubmitting(false);
    }
  }

  if (!product) return <p className="text-sm text-muted">Loading...</p>;
  const low = product.currentStock <= product.minStockAlert;
  const canEdit = can.manageProducts(user?.role);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{product.name}</h1>
          <p className="mt-1 font-mono text-xs text-muted">{product.sku} · {product.category}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={low ? "low" : "ok"}>{product.currentStock} in stock</Badge>
          {canEdit && !editing && (
            <button
              onClick={startEdit}
              className="focus-ring rounded-md border border-line px-4 py-1.5 text-sm font-medium hover:bg-ink/5"
            >
              Edit
            </button>
          )}
        </div>
      </div>

      <div className="mt-8 grid grid-cols-1 gap-8 lg:grid-cols-3">
        <div className="rounded-lg border border-line bg-white p-5 lg:col-span-1">
          {editing ? (
            <form onSubmit={saveEdit} className="space-y-4">
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Editing product</p>

              {editError && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{editError}</div>
              )}

              <Field label="Name" error={fieldErrors["name"]}>
                <input value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="SKU" error={fieldErrors["sku"]}>
                <input value={form.sku} onChange={e => setForm(f => ({ ...f, sku: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 font-mono text-sm" required />
              </Field>

              <Field label="Category" error={fieldErrors["category"]}>
                <input value={form.category} onChange={e => setForm(f => ({ ...f, category: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Unit Price (₹)" error={fieldErrors["unitPrice"]}>
                <input type="number" step="0.01" min="0" value={form.unitPrice} onChange={e => setForm(f => ({ ...f, unitPrice: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Min Stock Alert" error={fieldErrors["minStockAlert"]}>
                <input type="number" min="0" value={form.minStockAlert} onChange={e => setForm(f => ({ ...f, minStockAlert: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Location" error={fieldErrors["location"]}>
                <input value={form.location} onChange={e => setForm(f => ({ ...f, location: e.target.value }))} placeholder="e.g. Rack A-3" className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" />
              </Field>

              <div className="flex gap-2 pt-2">
                <button type="submit" disabled={saving} className="focus-ring flex-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
                  {saving ? "Saving..." : "Save changes"}
                </button>
                <button type="button" onClick={() => setEditing(false)} className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5">
                  Cancel
                </button>
              </div>
            </form>
          ) : (
            <dl className="space-y-3 text-sm">
              <Row label="Unit price" value={`₹${Number(product.unitPrice).toFixed(2)}`} />
              <Row label="Min stock alert" value={String(product.minStockAlert)} />
              <Row label="Location" value={product.location ?? "—"} />
            </dl>
          )}

          {!editing && can.adjustStock(user?.role) && (
            <form onSubmit={adjustStock} className="mt-6 space-y-3 border-t border-line pt-4">
              <p className="text-xs font-medium uppercase text-muted">Adjust stock</p>
              <div className="flex gap-2">
                <select value={type} onChange={(e) => setType(e.target.value as "IN" | "OUT")} className="focus-ring rounded-md border border-line px-2 py-2 text-sm">
                  <option value="IN">IN</option>
                  <option value="OUT">OUT</option>
                </select>
                <input value={qty} onChange={(e) => setQty(e.target.value)} placeholder="Qty" required className="focus-ring w-20 rounded-md border border-line px-2 py-2 text-sm" />
              </div>
              <input value={reason} onChange={(e) => setReason(e.target.value)} placeholder="Reason (e.g. Purchase Order #12)" required className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" />
              {stockError && <p className="rounded-md bg-danger/10 px-3 py-2 text-xs text-danger">{stockError}</p>}
              <button disabled={submitting} className="focus-ring w-full rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
                {submitting ? "Saving..." : "Log movement"}
              </button>
            </form>
          )}
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Movement log</h2>
          <div className="mt-4 divide-y divide-line rounded-lg border border-line bg-white">
            {movementsData?.data.map((m) => (
              <div key={m.id} className="flex items-center justify-between px-4 py-3 text-sm">
                <span>{m.reason}</span>
                <span className={`font-mono text-xs ${m.movementType === "IN" ? "text-success" : "text-danger"}`}>
                  {m.movementType === "IN" ? "+" : "-"}{m.quantityChanged}
                </span>
                <span className="font-mono text-xs text-muted">{new Date(m.createdAt).toLocaleDateString()}</span>
              </div>
            ))}
            {movementsData?.data.length === 0 && <p className="p-4 text-sm text-muted">No stock movements yet.</p>}
          </div>
        </div>
      </div>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <dt className="text-xs uppercase tracking-wide text-muted">{label}</dt>
      <dd className="mt-0.5">{value}</dd>
    </div>
  );
}

function Field({ label, error, children }: { label: string; error?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="mb-1 block text-xs font-medium uppercase tracking-wide text-muted">{label}</label>
      {children}
      {error && <p className="mt-1 text-xs text-red-600">{error}</p>}
    </div>
  );
}
