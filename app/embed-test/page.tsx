// A small harness to verify the app renders inside an iframe (the way
// lizbuilds.ai embeds it). Served from runway.lizbuilds.ai, this frames the
// production app and confirms the `frame-ancestors` CSP permits embedding
// (rather than blocking it the way `X-Frame-Options: DENY` would).

export const metadata = {
  title: "Upward — embed test",
};

export default function EmbedTest() {
  return (
    <main className="min-h-full bg-zinc-100 p-6">
      <div className="mx-auto max-w-5xl">
        <h1 className="mb-1 text-lg font-semibold text-zinc-900">Embed test</h1>
        <p className="mb-4 text-sm text-zinc-600">
          The app below is loaded in an <code>&lt;iframe&gt;</code>, exactly as it appears
          embedded in a lizbuilds.ai page. If it renders, framing is permitted.
        </p>
        <div className="overflow-hidden rounded-xl border border-zinc-300 bg-white shadow-sm">
          <iframe
            src="https://runway.lizbuilds.ai/"
            title="Upward"
            className="h-[80vh] w-full"
          />
        </div>
        <p className="mt-4 text-xs text-zinc-500">
          Embed snippet for the lizbuilds.ai detail page:
        </p>
        <pre className="mt-1 overflow-x-auto rounded-lg bg-zinc-900 p-3 text-xs text-zinc-100">
{`<iframe src="https://runway.lizbuilds.ai/"
        title="Upward"
        style="width:100%;height:80vh;border:0;border-radius:12px"
        loading="lazy"></iframe>`}
        </pre>
      </div>
    </main>
  );
}
