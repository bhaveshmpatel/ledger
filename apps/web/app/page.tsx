import Link from "next/link";
import { ArrowUpRight, ShieldCheck, Boxes, ClipboardList, Users2 } from "lucide-react";

const TICKER_ROWS = [
  { id: "CH-2026-0042", status: "Confirmed", detail: "120 units · Sunrise Distributors" },
  { id: "SKU-1007", status: "Low stock", detail: "8 left · MCB Switch 16A" },
  { id: "CH-2026-0041", status: "Draft", detail: "34 units · Ramesh Traders" },
  { id: "CH-2026-0040", status: "Confirmed", detail: "260 units · Krishna Wholesale" },
  { id: "SKU-1005", status: "Restocked", detail: "+40 units · Paint White 20L" },
  { id: "CH-2026-0039", status: "Cancelled", detail: "stock restored · Om Enterprises" },
];

const FLOW_STEPS = [
  { n: "01", title: "Draft", copy: "Sales builds a challan against a customer — products, quantities, nothing touched yet." },
  { n: "02", title: "Confirm", copy: "One action locks the stock rows, checks every line, and rejects the whole confirm if anything is short." },
  { n: "03", title: "Stock adjusts", copy: "Confirmed quantities post to the ledger as OUT movements — traceable back to the exact challan." },
  { n: "04", title: "Invoice", copy: "Export a challan as a PDF the moment it's confirmed, ready to hand to accounts or the customer." },
];

const ROLES = [
  { icon: ShieldCheck, name: "Admin", copy: "Full control — users, catalog, customers, and every challan state." },
  { icon: Users2, name: "Sales", copy: "Owns customers and challans end to end: draft, edit, confirm, cancel." },
  { icon: Boxes, name: "Warehouse", copy: "Owns the catalog and stock — manual adjustments, movement history, low-stock watch." },
  { icon: ClipboardList, name: "Accounts", copy: "Read access across the ledger, plus invoice export for reconciliation." },
];

export default function LandingPage() {
  return (
    <main className="min-h-screen bg-paper text-ink">
      <header className="mx-auto flex max-w-6xl items-center justify-between px-6 py-6">
        <div className="font-display text-lg font-bold tracking-tight">Ledger</div>
        <nav className="flex items-center gap-8 text-sm">
          <a href="#flow" className="hidden text-muted hover:text-ink sm:block">How it works</a>
          <a href="#roles" className="hidden text-muted hover:text-ink sm:block">Roles</a>
          <Link
            href="/login"
            className="focus-ring rounded-md border border-ink bg-ink px-4 py-2 text-sm font-medium text-paper transition hover:bg-accent hover:border-accent"
          >
            Sign in
          </Link>
        </nav>
      </header>

      {/* Hero */}
      <section className="mx-auto max-w-6xl px-6 pb-10 pt-16 sm:pt-24">
        <p className="mb-4 font-mono text-xs uppercase tracking-widest text-accent">Operations portal</p>
        <h1 className="max-w-3xl font-display text-4xl font-bold leading-[1.05] tracking-tight sm:text-6xl">
          Run stock, challans, and follow-ups from one ledger.
        </h1>
        <p className="mt-6 max-w-xl text-base text-muted sm:text-lg">
          Built for wholesale and distribution teams — sales, warehouse, and accounts
          working off the same numbers, with every challan confirmation tied directly
          to a stock movement you can trace back.
        </p>
        <div className="mt-8 flex flex-wrap items-center gap-4">
          <Link
            href="/login"
            className="focus-ring inline-flex items-center gap-2 rounded-md bg-accent px-5 py-3 text-sm font-medium text-paper transition hover:bg-accent-light"
          >
            Sign in to your portal <ArrowUpRight size={16} />
          </Link>
          <span className="font-mono text-xs text-muted">Admin · Sales · Warehouse · Accounts</span>
        </div>
      </section>

      {/* Ledger ticker */}
      <section className="border-y border-line bg-ink py-4" aria-hidden="true">
        <div className="flex overflow-hidden">
          <div className="flex shrink-0 animate-ticker gap-10 whitespace-nowrap">
            {[...TICKER_ROWS, ...TICKER_ROWS].map((row, i) => (
              <div key={i} className="flex items-center gap-3 font-mono text-xs text-paper/80">
                <span className="text-paper">{row.id}</span>
                <span
                  className={
                    row.status === "Confirmed"
                      ? "text-success"
                      : row.status === "Low stock"
                      ? "text-alert"
                      : row.status === "Cancelled"
                      ? "text-danger"
                      : "text-paper/60"
                  }
                >
                  {row.status}
                </span>
                <span className="text-paper/50">{row.detail}</span>
                <span className="text-paper/20">/</span>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* Flow */}
      <section id="flow" className="mx-auto max-w-6xl px-6 py-20 sm:py-28">
        <h2 className="mb-2 font-display text-2xl font-bold sm:text-3xl">Draft to invoice, one real sequence</h2>
        <p className="mb-12 max-w-lg text-muted">
          Every challan follows the same four steps. Nothing skips ahead, and nothing
          confirms halfway.
        </p>
        <div className="grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-4">
          {FLOW_STEPS.map((step) => (
            <div key={step.n} className="border-l-2 border-line pl-4">
              <div className="font-mono text-xs text-accent">{step.n}</div>
              <div className="mt-2 font-display text-lg font-bold">{step.title}</div>
              <p className="mt-2 text-sm text-muted">{step.copy}</p>
            </div>
          ))}
        </div>
      </section>

      {/* Roles */}
      <section id="roles" className="border-t border-line bg-ink/[0.03] px-6 py-20 sm:py-28">
        <div className="mx-auto max-w-6xl">
          <h2 className="mb-2 font-display text-2xl font-bold sm:text-3xl">Access shaped by the job</h2>
          <p className="mb-12 max-w-lg text-muted">
            Four roles, four different portals — each sees exactly what their work needs.
          </p>
          <div className="grid grid-cols-1 gap-6 sm:grid-cols-2 lg:grid-cols-4">
            {ROLES.map((role) => (
              <div key={role.name} className="rounded-lg border border-line bg-paper p-6">
                <role.icon size={20} className="text-accent" />
                <div className="mt-4 font-display text-base font-bold">{role.name}</div>
                <p className="mt-2 text-sm text-muted">{role.copy}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="mx-auto max-w-6xl px-6 py-20 text-center sm:py-28">
        <h2 className="font-display text-3xl font-bold sm:text-4xl">Your ledger is waiting.</h2>
        <p className="mx-auto mt-4 max-w-md text-muted">
          Sign in with your team credentials to pick up where the last shift left off.
        </p>
        <Link
          href="/login"
          className="focus-ring mt-8 inline-flex items-center gap-2 rounded-md bg-ink px-6 py-3 text-sm font-medium text-paper transition hover:bg-accent"
        >
          Sign in <ArrowUpRight size={16} />
        </Link>
      </section>

      <footer className="border-t border-line px-6 py-8">
        <div className="mx-auto flex max-w-6xl flex-col items-center justify-between gap-4 text-xs text-muted sm:flex-row">
          <span>© {new Date().getFullYear()} Ledger Operations Portal</span>
          <span className="font-mono">Mini ERP + CRM</span>
        </div>
      </footer>
    </main>
  );
}
