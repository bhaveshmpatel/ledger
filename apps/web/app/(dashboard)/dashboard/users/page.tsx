"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useApiGet } from "@/hooks/use-api";
import { useAuth, can } from "@/lib/auth";
import { api, ApiClientError } from "@/lib/api";
import { Shield, Plus, Pencil, Trash2, X, KeyRound, CheckCircle, XCircle } from "lucide-react";

const ROLES = ["admin", "sales", "warehouse", "accounts"] as const;
type Role = (typeof ROLES)[number];

const ROLE_COLORS: Record<Role, string> = {
  admin:     "bg-accent/10 text-accent border-accent/20",
  sales:     "bg-emerald-50 text-emerald-700 border-emerald-200",
  warehouse: "bg-amber-50 text-amber-700 border-amber-200",
  accounts:  "bg-purple-50 text-purple-700 border-purple-200",
};

interface User {
  id: string;
  name: string;
  email: string;
  role: Role;
  isActive: boolean;
  createdAt: string;
}

type ModalMode = "create" | "edit" | "reset-password" | null;

export default function UsersPage() {
  const router = useRouter();
  const { user: me, accessToken } = useAuth();
  const { data, refetch } = useApiGet<{ data: User[] }>("/users?limit=100");

  const [modal, setModal] = useState<ModalMode>(null);
  const [selected, setSelected] = useState<User | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [success, setSuccess] = useState<string | null>(null);

  // Create / Edit form state
  const [form, setForm] = useState({ name: "", email: "", password: "", role: "sales" as Role });
  // Password reset form state
  const [newPassword, setNewPassword] = useState("");

  const users = data?.data ?? [];

  // Redirect non-admins
  if (me && !can.manageUsers(me.role)) {
    router.replace("/dashboard");
    return null;
  }

  function openCreate() {
    setForm({ name: "", email: "", password: "", role: "sales" });
    setError(null); setFieldErrors({}); setSuccess(null);
    setModal("create");
  }

  function openEdit(u: User) {
    setSelected(u);
    setForm({ name: u.name, email: u.email, password: "", role: u.role });
    setError(null); setFieldErrors({}); setSuccess(null);
    setModal("edit");
  }

  function openPasswordReset(u: User) {
    setSelected(u);
    setNewPassword("");
    setError(null); setSuccess(null);
    setModal("reset-password");
  }

  function closeModal() {
    setModal(null); setSelected(null);
    setError(null); setFieldErrors({}); setSuccess(null);
  }

  async function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true); setError(null); setFieldErrors({});
    try {
      await api.post("/users", { name: form.name, email: form.email, password: form.password, role: form.role }, accessToken!);
      setSuccess("User created successfully.");
      await refetch();
      closeModal();
    } catch (err) {
      if (err instanceof ApiClientError) { setError(err.message); setFieldErrors(err.fields ?? {}); }
    } finally { setBusy(false); }
  }

  async function handleEdit(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setError(null); setFieldErrors({});
    try {
      const payload: Record<string, unknown> = { name: form.name, email: form.email, role: form.role };
      await api.patch(`/users/${selected.id}`, payload, accessToken!);
      await refetch();
      closeModal();
    } catch (err) {
      if (err instanceof ApiClientError) { setError(err.message); setFieldErrors(err.fields ?? {}); }
    } finally { setBusy(false); }
  }

  async function handlePasswordReset(e: React.FormEvent) {
    e.preventDefault();
    if (!selected) return;
    setBusy(true); setError(null);
    try {
      await api.patch(`/users/${selected.id}`, { password: newPassword }, accessToken!);
      setSuccess(`Password reset for ${selected.name}.`);
      setTimeout(closeModal, 1500);
    } catch (err) {
      if (err instanceof ApiClientError) setError(err.message);
    } finally { setBusy(false); }
  }

  async function toggleActive(u: User) {
    setBusy(true);
    try {
      await api.patch(`/users/${u.id}`, { isActive: !u.isActive }, accessToken!);
      await refetch();
    } catch (err) {
      if (err instanceof ApiClientError) alert(err.message);
    } finally { setBusy(false); }
  }

  async function handleDelete(u: User) {
    if (!confirm(`Delete ${u.name} (${u.email})? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api.delete(`/users/${u.id}`, accessToken!);
      await refetch();
    } catch (err) {
      if (err instanceof ApiClientError) alert(err.message);
    } finally { setBusy(false); }
  }

  return (
    <div>
      {/* ── Header ─────────────────────────────────────────────────────── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="font-display text-2xl font-bold flex items-center gap-2">
            <Shield size={22} className="text-accent" /> User Management
          </h1>
          <p className="mt-1 text-sm text-muted">Manage who can access the portal and what they can do.</p>
        </div>
        <button
          onClick={openCreate}
          className="focus-ring flex items-center gap-2 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent"
        >
          <Plus size={16} /> Add user
        </button>
      </div>

      {/* ── RBAC summary cards ─────────────────────────────────────────── */}
      <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {(["admin", "sales", "warehouse", "accounts"] as Role[]).map((role) => {
          const count = users.filter((u) => u.role === role).length;
          return (
            <div key={role} className={`rounded-lg border px-4 py-3 ${ROLE_COLORS[role]}`}>
              <p className="text-xs font-bold uppercase tracking-widest">{role}</p>
              <p className="mt-1 text-2xl font-bold">{count}</p>
              <p className="text-xs opacity-70">{count === 1 ? "user" : "users"}</p>
            </div>
          );
        })}
      </div>

      {/* ── Users table ────────────────────────────────────────────────── */}
      <div className="mt-8 overflow-hidden rounded-lg border border-line bg-white">
        <table className="w-full text-sm">
          <thead className="border-b border-line bg-ink/[0.03] text-left text-xs uppercase text-muted">
            <tr>
              <th className="px-4 py-3">Name</th>
              <th className="px-4 py-3">Email</th>
              <th className="px-4 py-3">Role</th>
              <th className="px-4 py-3">Status</th>
              <th className="px-4 py-3">Joined</th>
              <th className="px-4 py-3 text-right">Actions</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {users.map((u) => (
              <tr key={u.id} className={`transition hover:bg-ink/[0.02] ${!u.isActive ? "opacity-50" : ""}`}>
                <td className="px-4 py-3 font-medium">
                  {u.name}
                  {u.id === me?.id && (
                    <span className="ml-2 rounded bg-accent/10 px-1.5 py-0.5 text-xs font-mono text-accent">you</span>
                  )}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">{u.email}</td>
                <td className="px-4 py-3">
                  <span className={`inline-block rounded border px-2 py-0.5 text-xs font-bold uppercase tracking-wide ${ROLE_COLORS[u.role]}`}>
                    {u.role}
                  </span>
                </td>
                <td className="px-4 py-3">
                  {u.isActive
                    ? <span className="flex items-center gap-1 text-xs text-emerald-600"><CheckCircle size={13} /> Active</span>
                    : <span className="flex items-center gap-1 text-xs text-red-500"><XCircle size={13} /> Inactive</span>}
                </td>
                <td className="px-4 py-3 font-mono text-xs text-muted">
                  {new Date(u.createdAt).toLocaleDateString("en-IN", { day: "2-digit", month: "short", year: "numeric" })}
                </td>
                <td className="px-4 py-3">
                  <div className="flex items-center justify-end gap-1">
                    <button
                      title="Edit user"
                      onClick={() => openEdit(u)}
                      className="rounded p-1.5 text-muted hover:bg-ink/5 hover:text-ink"
                    >
                      <Pencil size={14} />
                    </button>
                    <button
                      title="Reset password"
                      onClick={() => openPasswordReset(u)}
                      className="rounded p-1.5 text-muted hover:bg-ink/5 hover:text-ink"
                    >
                      <KeyRound size={14} />
                    </button>
                    <button
                      title={u.isActive ? "Deactivate" : "Reactivate"}
                      disabled={busy || u.id === me?.id}
                      onClick={() => toggleActive(u)}
                      className={`rounded p-1.5 disabled:opacity-40 ${u.isActive ? "text-amber-500 hover:bg-amber-50" : "text-emerald-600 hover:bg-emerald-50"}`}
                    >
                      {u.isActive ? <XCircle size={14} /> : <CheckCircle size={14} />}
                    </button>
                    {u.id !== me?.id && (
                      <button
                        title="Delete user"
                        disabled={busy}
                        onClick={() => handleDelete(u)}
                        className="rounded p-1.5 text-red-400 hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                      >
                        <Trash2 size={14} />
                      </button>
                    )}
                  </div>
                </td>
              </tr>
            ))}
            {users.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-8 text-center text-sm text-muted">No users found.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      {/* ── Role capability reference ───────────────────────────────────── */}
      <div className="mt-8 rounded-lg border border-line bg-white p-5">
        <h2 className="mb-4 font-display text-base font-bold">Role capabilities</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead>
              <tr className="border-b border-line text-left text-muted">
                <th className="pb-2 pr-4 font-medium">Action</th>
                <th className="pb-2 px-3 text-center font-medium">Admin</th>
                <th className="pb-2 px-3 text-center font-medium">Sales</th>
                <th className="pb-2 px-3 text-center font-medium">Warehouse</th>
                <th className="pb-2 px-3 text-center font-medium">Accounts</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line/50">
              {[
                ["Manage users",             true,  false, false, false],
                ["Customers CRUD",           true,  true,  false, false],
                ["Customers read",           true,  true,  true,  true ],
                ["Products CRUD",            true,  false, true,  false],
                ["Products read",            true,  true,  true,  true ],
                ["Stock adjustment",         true,  false, true,  false],
                ["Stock read",               true,  true,  true,  true ],
                ["Create/edit challan",      true,  true,  false, false],
                ["Confirm challan",          true,  true,  false, false],
                ["Cancel challan",           true,  true,  false, false],
                ["Export invoice PDF",       true,  true,  false, true ],
              ].map(([label, admin, sales, wh, acc]) => (
                <tr key={label as string}>
                  <td className="py-2 pr-4 text-muted">{label}</td>
                  {[admin, sales, wh, acc].map((v, i) => (
                    <td key={i} className="py-2 px-3 text-center">
                      {v
                        ? <span className="text-emerald-600">✓</span>
                        : <span className="text-red-400 opacity-40">✗</span>}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ── Modals ─────────────────────────────────────────────────────── */}
      {modal && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-ink/40 backdrop-blur-sm">
          <div className="relative w-full max-w-md rounded-xl border border-line bg-paper p-6 shadow-2xl">
            <button
              onClick={closeModal}
              className="absolute right-4 top-4 rounded p-1 text-muted hover:bg-ink/5"
            >
              <X size={18} />
            </button>

            {/* ── Create modal ── */}
            {modal === "create" && (
              <form onSubmit={handleCreate} className="space-y-4">
                <h2 className="font-display text-lg font-bold">Add new user</h2>

                {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
                {success && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

                <Field label="Full name" error={fieldErrors["name"]}>
                  <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} placeholder="e.g. Priya Sharma" className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
                </Field>

                <Field label="Email address" error={fieldErrors["email"]}>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} placeholder="priya@company.com" className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
                </Field>

                <Field label="Password" error={fieldErrors["password"]}>
                  <input type="password" value={form.password} onChange={e => setForm(f => ({ ...f, password: e.target.value }))} placeholder="Min 8 characters" className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required minLength={8} />
                </Field>

                <Field label="Role" error={fieldErrors["role"]}>
                  <select value={form.role} onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm">
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                </Field>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={busy} className="focus-ring flex-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
                    {busy ? "Creating..." : "Create user"}
                  </button>
                  <button type="button" onClick={closeModal} className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* ── Edit modal ── */}
            {modal === "edit" && selected && (
              <form onSubmit={handleEdit} className="space-y-4">
                <h2 className="font-display text-lg font-bold">Edit user</h2>
                <p className="text-xs text-muted font-mono">{selected.email}</p>

                {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}

                <Field label="Full name" error={fieldErrors["name"]}>
                  <input autoFocus value={form.name} onChange={e => setForm(f => ({ ...f, name: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
                </Field>

                <Field label="Email address" error={fieldErrors["email"]}>
                  <input type="email" value={form.email} onChange={e => setForm(f => ({ ...f, email: e.target.value }))} className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required />
                </Field>

                <Field label="Role" error={fieldErrors["role"]}>
                  <select
                    value={form.role}
                    onChange={e => setForm(f => ({ ...f, role: e.target.value as Role }))}
                    disabled={selected.id === me?.id}
                    className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm disabled:opacity-50"
                  >
                    {ROLES.map(r => <option key={r} value={r}>{r.charAt(0).toUpperCase() + r.slice(1)}</option>)}
                  </select>
                  {selected.id === me?.id && <p className="mt-1 text-xs text-muted">You cannot change your own role.</p>}
                </Field>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={busy} className="focus-ring flex-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
                    {busy ? "Saving..." : "Save changes"}
                  </button>
                  <button type="button" onClick={closeModal} className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5">
                    Cancel
                  </button>
                </div>
              </form>
            )}

            {/* ── Password reset modal ── */}
            {modal === "reset-password" && selected && (
              <form onSubmit={handlePasswordReset} className="space-y-4">
                <div className="flex items-center gap-2">
                  <KeyRound size={18} className="text-accent" />
                  <h2 className="font-display text-lg font-bold">Reset password</h2>
                </div>
                <p className="text-sm text-muted">
                  Setting a new password for <span className="font-medium text-ink">{selected.name}</span>.
                </p>

                {error && <div className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-600">{error}</div>}
                {success && <div className="rounded-md bg-emerald-50 px-3 py-2 text-sm text-emerald-700">{success}</div>}

                <Field label="New password">
                  <input autoFocus type="password" value={newPassword} onChange={e => setNewPassword(e.target.value)} placeholder="Min 8 characters" className="focus-ring w-full rounded-md border border-line px-3 py-2 text-sm" required minLength={8} />
                </Field>

                <div className="flex gap-2 pt-2">
                  <button type="submit" disabled={busy} className="focus-ring flex-1 rounded-md bg-ink px-4 py-2 text-sm font-medium text-paper hover:bg-accent disabled:opacity-60">
                    {busy ? "Resetting..." : "Reset password"}
                  </button>
                  <button type="button" onClick={closeModal} className="focus-ring rounded-md border border-line px-4 py-2 text-sm font-medium hover:bg-ink/5">
                    Cancel
                  </button>
                </div>
              </form>
            )}
          </div>
        </div>
      )}
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
