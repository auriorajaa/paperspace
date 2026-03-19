import Link from "next/link";
import { auth } from "@clerk/nextjs/server";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div className="min-h-screen bg-[#0a0a0a] text-white overflow-hidden">
      {/* Noise texture overlay */}
      <div
        className="fixed inset-0 opacity-[0.03] pointer-events-none z-0"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Grid lines */}
      <div
        className="fixed inset-0 opacity-[0.04] pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(#fff 1px, transparent 1px), linear-gradient(90deg, #fff 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />

      {/* Glow blobs */}
      <div className="fixed top-[-20%] left-[10%] w-[600px] h-[600px] rounded-full bg-indigo-600/10 blur-[120px] pointer-events-none z-0" />
      <div className="fixed bottom-[-10%] right-[5%] w-[500px] h-[500px] rounded-full bg-violet-600/8 blur-[100px] pointer-events-none z-0" />

      {/* Nav */}
      <nav className="relative z-10 flex items-center justify-between px-8 py-6 max-w-7xl mx-auto">
        <div className="flex items-center gap-2.5">
          <div className="w-7 h-7 rounded-lg bg-gradient-to-br from-indigo-500 to-violet-600 flex items-center justify-center shadow-lg shadow-indigo-500/30">
            <svg
              width="14"
              height="14"
              viewBox="0 0 14 14"
              fill="none"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                d="M2 2h6l3 3v7H2V2z"
                stroke="white"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M8 2v3h3"
                stroke="white"
                strokeWidth="1.4"
                strokeLinejoin="round"
              />
              <path
                d="M4 7h5M4 9.5h3"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
              />
            </svg>
          </div>
          <span
            className="text-[15px] font-semibold tracking-tight"
            style={{ fontFamily: "'Geist', sans-serif" }}
          >
            Paperspace
          </span>
        </div>

        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <>
              <Link
                href="/sign-in"
                className="text-sm text-white/50 hover:text-white/80 transition-colors px-3 py-1.5"
              >
                Sign in
              </Link>
              <Link
                href="/sign-in"
                className="text-sm bg-white text-black font-medium px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
              >
                Get started
              </Link>
            </>
          ) : (
            <Link
              href="/home"
              className="text-sm bg-white text-black font-medium px-4 py-1.5 rounded-lg hover:bg-white/90 transition-colors"
            >
              Go to app →
            </Link>
          )}
        </div>
      </nav>

      {/* Hero */}
      <main className="relative z-10 flex flex-col items-center justify-center text-center px-6 pt-20 pb-32">
        {/* Badge */}
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-white/10 bg-white/5 text-xs text-white/50 mb-10 backdrop-blur-sm">
          <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Document workspace, reimagined
        </div>

        {/* Headline */}
        <h1
          className="text-[clamp(2.8rem,7vw,5.5rem)] font-bold leading-[0.95] tracking-tight max-w-4xl mb-6"
          style={{
            fontFamily: "'Geist', sans-serif",
            background:
              "linear-gradient(180deg, #ffffff 0%, rgba(255,255,255,0.4) 100%)",
            WebkitBackgroundClip: "text",
            WebkitTextFillColor: "transparent",
            backgroundClip: "text",
          }}
        >
          Every document,
          <br />
          in one place.
        </h1>

        <p className="text-[15px] text-white/40 max-w-md leading-relaxed mb-10">
          Write, collaborate, and generate documents at scale. With real-time
          editing, smart templates, and mail merge — all in your browser.
        </p>

        {/* CTA */}
        <div className="flex items-center gap-3">
          {!isSignedIn ? (
            <>
              <Link
                href="/sign-in"
                className="group flex items-center gap-2 bg-white text-black text-sm font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-all shadow-2xl shadow-white/10"
              >
                Start for free
                <svg
                  className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M9 5l7 7-7 7"
                  />
                </svg>
              </Link>
              <Link
                href="/sign-in"
                className="text-sm text-white/40 hover:text-white/60 transition-colors px-4 py-3"
              >
                Sign in to existing account
              </Link>
            </>
          ) : (
            <Link
              href="/home"
              className="group flex items-center gap-2 bg-white text-black text-sm font-semibold px-6 py-3 rounded-xl hover:bg-white/90 transition-all shadow-2xl shadow-white/10"
            >
              Open workspace
              <svg
                className="w-3.5 h-3.5 group-hover:translate-x-0.5 transition-transform"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M9 5l7 7-7 7"
                />
              </svg>
            </Link>
          )}
        </div>

        {/* Feature pills */}
        <div className="flex flex-wrap items-center justify-center gap-2 mt-16">
          {[
            "Real-time ONLYOFFICE editor",
            "Smart templates",
            "Mail merge & bulk generate",
            "Collections & folders",
            "AI document summaries",
          ].map((feat) => (
            <div
              key={feat}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg bg-white/[0.04] border border-white/[0.07] text-xs text-white/35"
            >
              <div className="w-1 h-1 rounded-full bg-indigo-400/60" />
              {feat}
            </div>
          ))}
        </div>

        {/* Preview card */}
        <div className="mt-20 w-full max-w-3xl mx-auto">
          <div className="rounded-2xl border border-white/[0.08] bg-white/[0.02] backdrop-blur-sm overflow-hidden shadow-2xl shadow-black/40">
            {/* Fake window chrome */}
            <div className="flex items-center gap-2 px-4 py-3 border-b border-white/[0.06] bg-white/[0.02]">
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="w-2.5 h-2.5 rounded-full bg-white/10" />
              <div className="ml-4 flex-1 h-5 rounded-md bg-white/[0.04] max-w-[200px]" />
            </div>
            {/* Fake content */}
            <div className="p-6 flex gap-4">
              <div className="w-48 shrink-0 space-y-2">
                {["Documents", "Collections", "Templates"].map((item, i) => (
                  <div
                    key={item}
                    className={`px-3 py-2 rounded-lg text-xs ${
                      i === 0
                        ? "bg-indigo-500/20 text-indigo-300 border border-indigo-500/20"
                        : "text-white/25"
                    }`}
                  >
                    {item}
                  </div>
                ))}
              </div>
              <div className="flex-1 space-y-3">
                {[
                  { w: "w-2/3", label: "Q4 Sales Report" },
                  { w: "w-1/2", label: "Client Contract Template" },
                  { w: "w-3/4", label: "Team Onboarding Guide" },
                ].map(({ w, label }, i) => (
                  <div
                    key={label}
                    className="flex items-center gap-3 p-3 rounded-lg bg-white/[0.03] border border-white/[0.05]"
                  >
                    <div className="w-7 h-7 rounded-md bg-white/[0.06] flex items-center justify-center text-xs">
                      📄
                    </div>
                    <div className="flex-1 space-y-1.5">
                      <div className={`h-2.5 bg-white/20 rounded ${w}`} />
                      <div className="h-2 bg-white/08 rounded w-1/3" />
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </main>
    </div>
  );
}
