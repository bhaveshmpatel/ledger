"use client";

import { useState } from "react";
import Link from "next/link";
import { Plus, Search } from "lucide-react";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { Badge } from "@/components/ui/badge";
import { api } from "@/lib/api";
import { Pagination } from "@/components/ui/pagination";

interface Customer {
  id: string;
  name: string;
  businessName: string;
  mobile: string;
  customerType: string;
  status: string;
  followUpDate: string | null;
}

export default function CustomersPage() {
  const { user, accessToken } = useAuth();
  const [search, setSearch] = useState("");
  const [status, setStatus] = useState("");
  const [customerType, setCustomerType] = useState("");
  const [page, setPage] = useState(1);
  const [showForm, setShowForm] = useState(false);

  const { data, loading, refetch } = useApiGet<{ data: Customer[], meta: { totalPages: number } }>(
    `/customers?search=${encodeURIComponent(search)}&status=${status}&type=${customerType}&page=${page}&limit=10`,
    [search, status, customerType, page]
  );

  return (
    <div>
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold">Customers</h1>
          <p className="mt-1 text-sm text-muted">Leads, active accounts, and follow-ups.</p>
        </div>
        {can.manageCustomers(user?.role) && (
          <button
            onClick={() => setShowForm((v) => !v)}
            className="focus-ring flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent"
          >
            <Plus size={16} /> New customer
          </button>
        )}
      </div>

      <div className="mt-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="flex flex-1 items-center gap-2 rounded-md border border-line bg-white px-3 py-2">
          <Search size={16} className="text-muted" />
          <input
            value={search}
            onChange={(e) => { setSearch(e.target.value); setPage(1); }}
            placeholder="Search by name, business, or mobile"
            className="focus-ring w-full text-sm outline-none"
          />
        </div>
        <div className="flex gap-2">
          <select
            value={status}
            onChange={(e) => { setStatus(e.target.value); setPage(1); }}
            className="focus-ring rounded-md border border-line bg-white px-3 py-2 text-sm capitalize outline-none"
          >
            <option value="">All statuses</option>
            <option value="lead">Lead</option>
            <option value="active">Active</option>
            <option value="inactive">Inactive</option>
          </select>
          <select
            value={customerType}
            onChange={(e) => { setCustomerType(e.target.value); setPage(1); }}
            className="focus-ring rounded-md border border-line bg-white px-3 py-2 text-sm capitalize outline-none"
          >
            <option value="">All types</option>
            <option value="retail">Retail</option>
            <option value="wholesale">Wholesale</option>
            <option value="distributor">Distributor</option>
          </select>
        </div>
      </div>

      {showForm && (
        <NewCustomerForm
          token={accessToken!}
          onCreated={() => {
            setShowForm(false);
            refetch();
          }}
        />
      )}

      <div className="mt-6 overflow-x-auto rounded-lg border border-line bg-white">
        <table className="w-full text-sm min-w-[800px]">
          <thead className="border-b border-line bg-ink/[0.02] text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Business</th>
              <th className="px-4 py-3">Mobile</th>
              <th className="px-4 py-3">Type</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Follow-up</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {data?.data.map((c) => (
              <tr key={c.id} className="hover:bg-ink/[0.02]">
                <td className="px-4 py-3">
                  <Link href={`/dashboard/customers/${c.id}`} className="focus-ring font-medium hover:text-accent">
                    {c.name}
                  </Link>
                </td>
                <td className="px-4 py-3 text-muted">{c.businessName}</td>
                <td className="px-4 py-3 font-mono text-xs">{c.mobile}</td>
                <td className="px-4 py-3 capitalize text-muted">{c.customerType}</td>
                <td className="px-4 py-3"><Badge tone={c.status}>{c.status}</Badge></td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{c.followUpDate ?? "—"}</td>
              </tr>
            ))}
            {!loading && data?.data.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-muted">No customers yet.</td></tr>
            )}
          </tbody>
        </table>
        {data?.meta && (
          <Pagination page={page} totalPages={data.meta.totalPages} onPageChange={setPage} />
        )}
      </div>
    </div>
  );
}

function NewCustomerForm({ token, onCreated }: { token: string; onCreated: () => void }) {
  const [form, setForm] = useState({
    name: "", mobile: "", email: "", businessName: "", gstNumber: "",
    customerType: "retail", address: "", status: "lead", followUpDate: "",
  });
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await api.post("/customers", form, token);
      onCreated();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create customer");
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <form onSubmit={submit} className="mt-6 grid grid-cols-1 gap-4 rounded-lg border border-line bg-white p-5 sm:grid-cols-2">
      <Input label="Name" value={form.name} onChange={(v) => setForm({ ...form, name: v })} required />
      <Input label="Business name" value={form.businessName} onChange={(v) => setForm({ ...form, businessName: v })} required />
      <Input label="Mobile" value={form.mobile} onChange={(v) => setForm({ ...form, mobile: v })} required />
      <Input label="Email" value={form.email} onChange={(v) => setForm({ ...form, email: v })} />
      <Input label="GST number" value={form.gstNumber} onChange={(v) => setForm({ ...form, gstNumber: v })} />
      <Select label="Type" value={form.customerType} onChange={(v) => setForm({ ...form, customerType: v })} options={["retail", "wholesale", "distributor"]} />
      <Select label="Status" value={form.status} onChange={(v) => setForm({ ...form, status: v })} options={["lead", "active", "inactive"]} />
      <Input label="Follow-up date" type="date" value={form.followUpDate} onChange={(v) => setForm({ ...form, followUpDate: v })} />
      <div className="sm:col-span-2">
        <label className="mb-1.5 block text-sm font-medium">Address</label>
        <textarea value={form.address} onChange={(e) => setForm({ ...form, address: e.target.value })} required className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" rows={2} />
      </div>
      {error && <p className="sm:col-span-2 rounded-md bg-danger/10 px-3 py-2 text-sm text-danger">{error}</p>}
      <div className="sm:col-span-2">
        <button disabled={submitting} className="focus-ring rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
          {submitting ? "Saving..." : "Save customer"}
        </button>
      </div>
    </form>
  );
}

function Input({ label, value, onChange, type = "text", required }: { label: string; value: string; onChange: (v: string) => void; type?: string; required?: boolean }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <input type={type} required={required} value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" />
    </div>
  );
}

function Select({ label, value, onChange, options }: { label: string; value: string; onChange: (v: string) => void; options: string[] }) {
  return (
    <div>
      <label className="mb-1.5 block text-sm font-medium">{label}</label>
      <select value={value} onChange={(e) => onChange(e.target.value)} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm capitalize">
        {options.map((o) => <option key={o} value={o}>{o}</option>)}
      </select>
    </div>
  );
}
