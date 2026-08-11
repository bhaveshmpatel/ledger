"use client";

import { useState } from "react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { api, ApiClientError } from "@/lib/api";

interface Customer {
  id: string; name: string; businessName: string; mobile: string; email: string | null;
  gstNumber: string | null; customerType: string; address: string; status: string; followUpDate: string | null;
}
interface Note { id: string; note: string; createdAt: string; }

const TYPES = ["retail", "wholesale", "distributor"] as const;
const STATUSES = ["lead", "active", "inactive"] as const;

export default function CustomerDetailPage({ params }: { params: { id: string } }) {
  const { user, accessToken } = useAuth();
  const { data, refetch } = useApiGet<{ data: Customer }>(`/customers/${params.id}`);
  const { data: notesData, refetch: refetchNotes } = useApiGet<{ data: Note[] }>(`/customers/${params.id}/notes`);
  const [note, setNote] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [form, setForm] = useState<Partial<Customer>>({});
  const customer = data?.data;

  function startEdit() {
    if (!customer) return;
    setForm({
      name: customer.name,
      businessName: customer.businessName,
      mobile: customer.mobile,
      email: customer.email ?? "",
      gstNumber: customer.gstNumber ?? "",
      customerType: customer.customerType,
      address: customer.address,
      status: customer.status,
      followUpDate: customer.followUpDate ?? "",
    });
    setError(null);
    setFieldErrors({});
    setEditing(true);
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault();
    setSaving(true); setError(null); setFieldErrors({});
    try {
      await api.patch(`/customers/${params.id}`, form, accessToken!);
      await refetch();
      setEditing(false);
    } catch (err) {
      if (err instanceof ApiClientError) {
        setError(err.message);
        setFieldErrors(err.fields ?? {});
      }
    } finally {
      setSaving(false);
    }
  }

  async function addNote(e: React.FormEvent) {
    e.preventDefault();
    if (!note.trim()) return;
    setSubmitting(true);
    try {
      await api.post(`/customers/${params.id}/notes`, { note }, accessToken!);
      setNote("");
      refetchNotes();
    } finally {
      setSubmitting(false);
    }
  }

  if (!customer) return <p className="text-sm text-muted">Loading...</p>;

  const canEdit = can.manageCustomers(user?.role);

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">{customer.name}</h1>
          <p className="mt-1 text-sm text-muted">{customer.businessName}</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge tone={customer.status}>{customer.status}</Badge>
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
              <p className="text-xs font-bold uppercase tracking-widest text-accent">Editing customer</p>

              {error && (
                <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">
                  {error}
                </div>
              )}

              <Field label="Name" error={fieldErrors["name"]}>
                <input value={form.name ?? ""} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Business Name" error={fieldErrors["businessName"]}>
                <input value={form.businessName ?? ""} onChange={e => setForm(f => ({ ...f, businessName: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Mobile" error={fieldErrors["mobile"]}>
                <input value={form.mobile ?? ""} onChange={e => setForm(f => ({ ...f, mobile: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Email" error={fieldErrors["email"]}>
                <input type="email" value={form.email ?? ""} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" />
              </Field>

              <Field label="GST Number" error={fieldErrors["gstNumber"]}>
                <input value={form.gstNumber ?? ""} onChange={e => setForm(f => ({ ...f, gstNumber: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" />
              </Field>

              <Field label="Customer Type" error={fieldErrors["customerType"]}>
                <select value={form.customerType ?? "retail"} onChange={e => setForm(f => ({ ...f, customerType: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm">
                  {TYPES.map(t => <option key={t} value={t}>{t}</option>)}
                </select>
              </Field>

              <Field label="Status" error={fieldErrors["status"]}>
                <select value={form.status ?? "lead"} onChange={e => setForm(f => ({ ...f, status: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm">
                  {STATUSES.map(s => <option key={s} value={s}>{s}</option>)}
                </select>
              </Field>

              <Field label="Address" error={fieldErrors["address"]}>
                <textarea value={form.address ?? ""} onChange={e => setForm(f => ({ ...f, address: e.target.value }))} rows={3} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
              </Field>

              <Field label="Follow-up Date" error={fieldErrors["followUpDate"]}>
                <input type="date" value={form.followUpDate ?? ""} onChange={e => setForm(f => ({ ...f, followUpDate: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" />
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
              <Row label="Mobile" value={customer.mobile} />
              <Row label="Email" value={customer.email ?? "—"} />
              <Row label="GST number" value={customer.gstNumber ?? "—"} />
              <Row label="Type" value={customer.customerType} />
              <Row label="Address" value={customer.address} />
              <Row label="Follow-up" value={customer.followUpDate ?? "—"} />
            </dl>
          )}
        </div>

        <div className="lg:col-span-2">
          <h2 className="font-display text-lg font-bold">Follow-up notes</h2>
          {can.manageCustomers(user?.role) && (
            <form onSubmit={addNote} className="mt-3 flex gap-2">
              <input
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="Log a call, visit, or update..."
                className="focus-ring flex-1 rounded-md border border-line px-3 py-2 text-sm"
              />
              <button disabled={submitting} className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
                Add
              </button>
            </form>
          )}
          <div className="mt-4 space-y-3">
            {notesData?.data.map((n) => (
              <div key={n.id} className="rounded-md border border-line bg-white p-3 text-sm">
                <p>{n.note}</p>
                <p className="mt-1 font-mono text-xs text-muted">{new Date(n.createdAt).toLocaleString()}</p>
              </div>
            ))}
            {notesData?.data.length === 0 && <p className="text-sm text-muted">No notes yet.</p>}
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
