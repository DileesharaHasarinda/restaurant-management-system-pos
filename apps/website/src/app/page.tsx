export default function Home() {
  return (
    <main className="min-h-screen bg-slate-50 px-6 py-16">
      <section className="mx-auto max-w-5xl rounded-3xl border border-slate-200 bg-white p-10 shadow-xl shadow-slate-200/50 md:p-16">
        <span className="inline-flex rounded-full bg-emerald-50 px-4 py-2 text-sm font-bold tracking-wide text-emerald-700">
          PHASE 1 READY
        </span>

        <h1 className="mt-6 text-5xl font-bold tracking-tight text-slate-900 md:text-7xl">
          Restaurant
        </h1>

        <p className="mt-3 text-xl font-semibold text-slate-500">
          Website & QR Ordering
        </p>

        <p className="mt-8 max-w-2xl text-lg leading-8 text-slate-600">
          The public restaurant website,
          menu, gallery, customer reviews
          and table QR ordering system
          will be developed here.
        </p>

        <div className="mt-10 grid gap-4 md:grid-cols-3">
          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Website
            </p>

            <p className="mt-2 text-xl font-bold text-slate-800">
              Next.js
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              UI
            </p>

            <p className="mt-2 text-xl font-bold text-slate-800">
              React
            </p>
          </div>

          <div className="rounded-2xl border border-slate-200 bg-slate-50 p-6">
            <p className="text-sm font-bold uppercase tracking-wide text-slate-500">
              Language
            </p>

            <p className="mt-2 text-xl font-bold text-slate-800">
              TypeScript
            </p>
          </div>
        </div>
      </section>
    </main>
  );
}