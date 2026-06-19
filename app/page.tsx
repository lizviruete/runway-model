export default function Home() {
  return (
    <main className="flex min-h-full flex-col items-center justify-center bg-zinc-50 px-6 py-24 text-center">
      <div className="max-w-xl">
        <p className="mb-4 inline-block rounded-full border border-zinc-300 bg-white px-3 py-1 text-xs font-medium uppercase tracking-wide text-zinc-500">
          V2 · in progress
        </p>
        <h1 className="text-balance text-4xl font-semibold tracking-tight text-zinc-900 sm:text-5xl">
          Runway Model
        </h1>
        <p className="mt-5 text-pretty text-lg leading-8 text-zinc-600">
          A transition-stage financial runway calculator. It answers one
          question for someone between incomes:{" "}
          <span className="font-medium text-zinc-800">
            how long does your cash last, and how does that change if you pull
            any single lever?
          </span>
        </p>
        <p className="mt-8 text-sm text-zinc-400">
          Phase 0 — pipeline live. Engine, accounts, levers, and the audit
          ledger land next.
        </p>
      </div>
    </main>
  );
}
