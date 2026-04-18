// app/page.tsx
import Link from "next/link";
import { auth } from "@clerk/nextjs/server";
import { PreAuthNavbar } from "@/components/PreAuthNavbar";

export default async function LandingPage() {
  const { userId } = await auth();
  const isSignedIn = !!userId;

  return (
    <div
      className="min-h-screen"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <style>{`
        @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-10px)} }
        @keyframes fade-up { from{opacity:0;transform:translateY(24px)} to{opacity:1;transform:translateY(0)} }
        @keyframes pulse-ring { 0%{transform:scale(1);opacity:.4} 100%{transform:scale(1.5);opacity:0} }
        @keyframes shimmer { 0%{background-position:200% center} 100%{background-position:-200% center} }
        @keyframes slide-in-left { from{opacity:0;transform:translateX(-20px)} to{opacity:1;transform:translateX(0)} }
        .anim-float { animation: float 5s ease-in-out infinite; }
        .anim-float-2 { animation: float 6.5s ease-in-out infinite .8s; }
        .anim-float-3 { animation: float 4.5s ease-in-out infinite 1.5s; }
        .anim-fade-up { animation: fade-up .6s ease-out both; }
        .anim-fade-up-1 { animation: fade-up .6s ease-out .1s both; }
        .anim-fade-up-2 { animation: fade-up .6s ease-out .2s both; }
        .anim-fade-up-3 { animation: fade-up .6s ease-out .35s both; }
        .anim-fade-up-4 { animation: fade-up .6s ease-out .5s both; }
        .gradient-text {
          background: linear-gradient(135deg, var(--accent-light) 0%, #a78bfa 50%, var(--accent-pale) 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .feature-card:hover { transform: translateY(-2px); }
        .feature-card { transition: transform .2s ease, box-shadow .2s ease; }
        .step-connector { background: linear-gradient(90deg, var(--accent-border), transparent); }
      `}</style>

      {/* Background elements */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        {/* Grid */}
        <div
          className="absolute inset-0 opacity-[0.028]"
          style={{
            backgroundImage:
              "linear-gradient(var(--text) 1px, transparent 1px), linear-gradient(90deg, var(--text) 1px, transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Noise */}
        <div
          className="absolute inset-0 opacity-[0.022]"
          style={{
            backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
          }}
        />
        {/* Glows */}
        <div
          className="absolute top-[-20%] left-[5%] w-[640px] h-[640px] rounded-full"
          style={{ background: "var(--ambient-glow)", filter: "blur(140px)" }}
        />
        <div
          className="absolute top-[40%] right-[-5%] w-[500px] h-[500px] rounded-full"
          style={{
            background: "rgba(139,92,246,0.045)",
            filter: "blur(120px)",
          }}
        />
        <div
          className="absolute bottom-[-10%] left-[30%] w-[480px] h-[480px] rounded-full"
          style={{ background: "rgba(52,211,153,0.03)", filter: "blur(110px)" }}
        />
      </div>

      <PreAuthNavbar page="landing" isSignedIn={isSignedIn} />

      {/* ────────── HERO ────────── */}
      <section className="relative z-10 flex flex-col items-center text-center px-5 pt-28 sm:pt-36 pb-20 sm:pb-28">
        {/* Badge */}
        {/* <div
          className="anim-fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-xs font-medium mb-7"
          style={{
            background: "var(--accent-soft)",
            border: "1px solid var(--accent-border)",
            color: "var(--accent-light)",
          }}
        >
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
          Powered by ONLYOFFICE · Now with AI summaries
        </div> */}

        {/* Headline */}
        <h1
          className="anim-fade-up-1 text-[clamp(2.4rem,6.5vw,5rem)] font-bold leading-[1.04] tracking-tight max-w-4xl mb-5"
          style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
        >
          Every document,
          <br />
          <span className="gradient-text">in one place.</span>
        </h1>

        <p
          className="anim-fade-up-2 text-[15px] sm:text-[16px] leading-relaxed max-w-[500px] mb-9"
          style={{ color: "var(--text-muted)" }}
        >
          Write, collaborate, and generate documents at scale — with a real-time
          editor, AI summaries, smart templates, and mail merge. All in your
          browser.
        </p>

        {/* CTAs */}
        <div className="anim-fade-up-3 flex items-center gap-3 flex-wrap justify-center">
          {!isSignedIn ? (
            <>
              <Link
                href="/sign-up"
                className="group inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{
                  background: "var(--text)",
                  color: "var(--bg)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  transition: "all .18s ease",
                }}
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
                className="inline-flex items-center gap-1.5 text-sm font-medium px-5 py-3 rounded-xl transition-all"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-muted)",
                }}
              >
                Sign in
              </Link>
            </>
          ) : (
            <Link
              href="/home"
              className="group inline-flex items-center gap-2 text-sm font-semibold px-6 py-3 rounded-xl transition-all hover:opacity-90"
              style={{
                background: "var(--text)",
                color: "var(--bg)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
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
        {/* <div className="anim-fade-up-4 flex flex-wrap items-center justify-center gap-2 mt-9">
          {[
            { label: "ONLYOFFICE editor", color: "var(--accent-light)" },
            { label: "AI summaries", color: "#34d399" },
            { label: "Smart templates", color: "#f472b6" },
            { label: "Mail merge", color: "#fb923c" },
            { label: "Google Forms sync", color: "#60a5fa" },
          ].map((f) => (
            <span
              key={f.label}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs"
              style={{
                background: "var(--bg-muted)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
              }}
            >
              <span
                className="w-1 h-1 rounded-full shrink-0"
                style={{ background: f.color }}
              />
              {f.label}
            </span>
          ))}
        </div> */}

        {/* App Preview Mockup */}
        <div className="mt-16 w-full max-w-5xl relative">
          {/* Main mockup window */}
          <div
            className="rounded-2xl overflow-hidden shadow-2xl relative z-10"
            style={{
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-card)",
              boxShadow:
                "0 40px 100px rgba(0,0,0,0.28), 0 0 0 1px var(--border-subtle)",
            }}
          >
            {/* Window chrome */}
            <div
              className="flex items-center gap-2 px-4 py-3"
              style={{
                background: "var(--bg-muted)",
                borderBottom: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex gap-1.5">
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#ef4444", opacity: 0.7 }}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#f59e0b", opacity: 0.7 }}
                />
                <div
                  className="w-3 h-3 rounded-full"
                  style={{ background: "#22c55e", opacity: 0.7 }}
                />
              </div>
              <div className="flex-1 flex justify-center">
                <div
                  className="flex items-center gap-2 px-3 py-1 rounded-lg text-xs"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-muted)",
                    maxWidth: 200,
                    width: "100%",
                  }}
                >
                  <svg
                    className="w-3 h-3 shrink-0"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                    />
                  </svg>
                  paperspace.app/home
                </div>
              </div>
            </div>

            {/* App chrome */}
            <div className="flex" style={{ minHeight: 340 }}>
              {/* Sidebar */}
              <div
                className="w-[200px] shrink-0 hidden sm:flex flex-col"
                style={{
                  background: "var(--bg-sidebar)",
                  borderRight: "1px solid var(--border-subtle)",
                }}
              >
                <div className="p-3 space-y-0.5">
                  {[
                    { label: "Home", icon: "🏠", active: false },
                    { label: "Papers", icon: "📄", active: true },
                    { label: "Collections", icon: "📁", active: false },
                    { label: "Templates", icon: "📑", active: false },
                  ].map((item) => (
                    <div
                      key={item.label}
                      className="flex items-center gap-2.5 px-2.5 py-2 rounded-xl"
                      style={{
                        background: item.active
                          ? "var(--nav-active-bg)"
                          : "transparent",
                        color: item.active
                          ? "var(--accent-light)"
                          : "var(--text-muted)",
                      }}
                    >
                      <span className="text-sm">{item.icon}</span>
                      <span className="text-[12px] font-medium">
                        {item.label}
                      </span>
                    </div>
                  ))}
                </div>
                <div
                  className="mt-auto p-3"
                  style={{ borderTop: "1px solid var(--border-subtle)" }}
                >
                  <div className="flex items-center gap-2 px-2">
                    <div
                      className="w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-bold shrink-0"
                      style={{
                        background: "rgba(99,102,241,0.2)",
                        color: "var(--accent-light)",
                      }}
                    >
                      A
                    </div>
                    <span
                      className="text-[11px] font-medium truncate"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      Alex Johnson
                    </span>
                  </div>
                </div>
              </div>

              {/* Main content */}
              <div className="flex-1 overflow-hidden">
                {/* Header */}
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{ borderBottom: "1px solid var(--border-subtle)" }}
                >
                  <div>
                    <p
                      className="text-[13px] font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      Papers
                    </p>
                    <p
                      className="text-[10px]"
                      style={{ color: "var(--text-muted)" }}
                    >
                      24 papers · 3 shared
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <div
                      className="h-7 px-2.5 rounded-lg text-[11px] flex items-center gap-1.5"
                      style={{
                        background: "var(--bg-muted)",
                        border: "1px solid var(--border-subtle)",
                        color: "var(--text-muted)",
                      }}
                    >
                      <svg
                        className="w-3 h-3"
                        fill="none"
                        viewBox="0 0 24 24"
                        stroke="currentColor"
                        strokeWidth={2}
                      >
                        <circle cx="11" cy="11" r="8" />
                        <path
                          strokeLinecap="round"
                          strokeLinejoin="round"
                          d="m21 21-4.35-4.35"
                        />
                      </svg>
                      Search…
                    </div>
                    <div
                      className="h-7 px-3 rounded-lg text-[11px] flex items-center gap-1.5 font-medium"
                      style={{
                        background: "var(--accent-bg)",
                        border: "1px solid var(--accent-border)",
                        color: "var(--accent-pale)",
                      }}
                    >
                      + New
                    </div>
                  </div>
                </div>
                {/* Document list */}
                <div className="p-3 grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  {[
                    {
                      title: "Q4 Sales Report 2024",
                      time: "2h ago",
                      summary:
                        "Revenue up 23% YoY. Key growth in APAC region. Three underperforming SKUs flagged for review.",
                      badge: "Shared",
                      badgeColor: "#818cf8",
                      summaryDot: "#818cf8",
                    },
                    {
                      title: "Employee Contract Template",
                      time: "Yesterday",
                      summary:
                        "Standard employment agreement with variable fields for role, salary, start date, and department.",
                      badge: "AI Ready",
                      badgeColor: "#34d399",
                      summaryDot: "#34d399",
                    },
                    {
                      title: "Client Proposal — Acme Corp",
                      time: "3 days ago",
                      summary:
                        "Custom software proposal including timeline, deliverables, and pricing tiers for enterprise package.",
                      badge: null,
                      summaryDot: "#818cf8",
                    },
                    {
                      title: "Onboarding Guide v3",
                      time: "1 week ago",
                      summary:
                        "Revised onboarding flow covering tool setup, team introductions, and first-week milestones.",
                      badge: null,
                      summaryDot: "#818cf8",
                    },
                  ].map((doc) => (
                    <div
                      key={doc.title}
                      className="rounded-xl p-3 flex flex-col gap-2"
                      style={{
                        background: "var(--bg-muted)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div className="flex items-start gap-2">
                        <div
                          className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0 text-xs"
                          style={{ background: "var(--bg-input)" }}
                        >
                          📄
                        </div>
                        <div className="">
                          <p
                            className="text-[12px] font-semibold line-clamp-1"
                            style={{ color: "var(--text)" }}
                          >
                            {doc.title}
                          </p>
                          <div className="flex items-center gap-1.5 mt-0.5">
                            <p
                              className="text-[10px]"
                              style={{ color: "var(--text-muted)" }}
                            >
                              {doc.time}
                            </p>
                            {doc.badge && (
                              <span
                                className="text-[9px] font-semibold px-1.5 py-px rounded"
                                style={{
                                  background: `${doc.badgeColor}18`,
                                  color: doc.badgeColor,
                                }}
                              >
                                {doc.badge}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div
                        className="flex flex-col gap-1 rounded-lg px-2.5 py-2"
                        style={{
                          background: "rgba(99,102,241,0.07)",
                          border: "1px solid rgba(99,102,241,0.12)",
                        }}
                      >
                        <span
                          className="text-[9px] font-semibold uppercase tracking-wider text-left"
                          style={{ color: "var(--text-dim)" }}
                        >
                          AI summary
                        </span>
                        <p
                          className="text-[10px] leading-relaxed text-left"
                          style={{ color: "var(--text-secondary)" }}
                        >
                          {doc.summary}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── STATS STRIP ────────── */}
      <section
        className="relative z-10 border-y py-8"
        style={{
          borderColor: "var(--border-subtle)",
          background: "var(--bg-muted)",
        }}
      >
        <div className="max-w-5xl mx-auto px-5 flex flex-wrap items-center justify-center gap-8 sm:gap-14">
          {[
            { value: "100%", label: "Browser-based, zero install" },
            { value: "AI", label: "Auto-summarises every doc" },
            { value: "∞", label: "Documents & templates" },
            { value: "5 min", label: "Google Forms auto-sync" },
            { value: "Live", label: "Real-time collaboration" },
          ].map((s) => (
            <div key={s.label} className="text-center">
              <p
                className="text-[22px] font-bold tabular-nums"
                style={{ color: "var(--accent-light)" }}
              >
                {s.value}
              </p>
              <p
                className="text-[11px] mt-0.5 max-w-[120px] leading-tight"
                style={{ color: "var(--text-muted)" }}
              >
                {s.label}
              </p>
            </div>
          ))}
        </div>
      </section>

      {/* ────────── FEATURES GRID ────────── */}
      <section className="relative z-10 px-5 py-20 sm:py-28 max-w-6xl mx-auto">
        <div className="text-center mb-14">
          <p
            className="text-xs font-semibold uppercase tracking-widest mb-3"
            style={{ color: "var(--accent-light)" }}
          >
            Everything you need
          </p>
          <h2
            className="text-[2rem] sm:text-[2.4rem] font-bold leading-tight tracking-tight"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            One workspace for all your documents
          </h2>
          <p
            className="text-[15px] mt-4 max-w-xl mx-auto"
            style={{ color: "var(--text-muted)" }}
          >
            From first draft to bulk-generated client packs — Paperspace handles
            every step of your document workflow.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {[
            {
              emoji: "📝",
              color: "#818cf8",
              bg: "rgba(99,102,241,0.1)",
              border: "rgba(99,102,241,0.2)",
              title: "Real-time ONLYOFFICE Editor",
              desc: "A full-featured word processor right in your browser. Edit, format, and collaborate on .docx files with no downloads or plugins needed.",
              tags: ["Track changes", "Comments", ".docx native"],
            },
            {
              emoji: "✨",
              color: "#34d399",
              bg: "rgba(52,211,153,0.1)",
              border: "rgba(52,211,153,0.2)",
              title: "AI-powered Summaries",
              desc: "Every document is automatically summarised when uploaded. Skim your inbox with one glance — no need to open each file.",
              tags: ["Auto-generated", "Instant context", "All docs"],
            },
            {
              emoji: "📑",
              color: "#f472b6",
              bg: "rgba(244,114,182,0.1)",
              border: "rgba(244,114,182,0.2)",
              title: "Smart Templates",
              desc: "Build reusable templates with typed {{placeholders}} — text, dates, numbers, loops, and conditionals. Upload .docx or .pdf.",
              tags: ["{{placeholders}}", "Loops", "Conditions"],
            },
            {
              emoji: "⚡",
              color: "#fb923c",
              bg: "rgba(251,146,60,0.1)",
              border: "rgba(251,146,60,0.2)",
              title: "Mail Merge & Bulk Generate",
              desc: "Upload a CSV, map columns to template fields, and generate hundreds of unique documents in seconds. Download as a ZIP.",
              tags: ["CSV import", "Bulk export", "ZIP download"],
            },
            {
              emoji: "📁",
              color: "#a78bfa",
              bg: "rgba(167,139,250,0.1)",
              border: "rgba(167,139,250,0.2)",
              title: "Collections & Folders",
              desc: "Organise every document into colour-coded collections. Tag them, filter by label, and share across your organisation.",
              tags: ["Colour-coded", "Tags"],
            },
            {
              emoji: "🔗",
              color: "#60a5fa",
              bg: "rgba(96,165,250,0.1)",
              border: "rgba(96,165,250,0.2)",
              title: "Google Forms Integration",
              desc: "Connect a Google Form to a template. Every submission automatically generates and saves a filled document — no code required.",
              tags: ["Auto-generate", "5 min sync", "Spreadsheet link"],
            },
          ].map((feat) => (
            <div
              key={feat.title}
              className="feature-card rounded-2xl p-5 flex flex-col gap-3"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <div className="flex items-start gap-3.5">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center text-xl shrink-0"
                  style={{
                    background: feat.bg,
                    border: `1px solid ${feat.border}`,
                  }}
                >
                  {feat.emoji}
                </div>
                <div>
                  <h3
                    className="text-[13.5px] font-semibold pt-2"
                    style={{ color: "var(--text)" }}
                  >
                    {feat.title}
                  </h3>
                </div>
              </div>
              <p
                className="text-[12.5px] leading-relaxed flex-1"
                style={{ color: "var(--text-muted)" }}
              >
                {feat.desc}
              </p>
              <div className="flex flex-wrap gap-1.5">
                {feat.tags.map((tag) => (
                  <span
                    key={tag}
                    className="text-[10px] font-medium px-2 py-0.5 rounded-lg"
                    style={{
                      background: feat.bg,
                      color: feat.color,
                      border: `1px solid ${feat.border}`,
                    }}
                  >
                    {tag}
                  </span>
                ))}
              </div>
            </div>
          ))}
        </div>
      </section>

      {/* ────────── EDITOR DEEP-DIVE ────────── */}
      <section
        className="relative z-10 py-20 sm:py-28 overflow-hidden"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          borderBottom: "1px solid var(--border-subtle)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text side */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#818cf8" }}
              >
                Document editor
              </p>
              <h2
                className="text-[1.9rem] sm:text-[2.2rem] font-bold leading-tight tracking-tight mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Professional editing,
                <br />
                zero installs
              </h2>
              <p
                className="text-[15px] leading-relaxed mb-6"
                style={{ color: "var(--text-muted)" }}
              >
                Paperspace is powered by ONLYOFFICE — a battle-tested document
                engine used by enterprises globally. Edit natively in .docx
                format with full formatting controls, comments, and
                track-changes support.
              </p>
              <ul className="space-y-3">
                {[
                  {
                    icon: "✓",
                    text: "Full .docx compatibility — no format conversion loss",
                  },
                  {
                    icon: "✓",
                    text: "Automatic save and Convex real-time sync",
                  },
                  {
                    icon: "✓",
                    text: "Dark & light editor themes that follow your preference",
                  },
                  { icon: "✓", text: "Export to PDF in one click" },
                ].map((item) => (
                  <li key={item.text} className="flex items-start gap-3">
                    <span
                      className="text-[13px] font-bold mt-0.5 shrink-0"
                      style={{ color: "#818cf8" }}
                    >
                      {item.icon}
                    </span>
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item.text}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Editor mockup */}
            <div
              className="rounded-2xl overflow-hidden shadow-2xl"
              style={{
                border: "1px solid var(--border-subtle)",
                background: "var(--bg-card)",
              }}
            >
              {/* Toolbar */}
              <div
                className="px-3 py-2 flex items-center gap-1.5 flex-wrap"
                style={{
                  background: "var(--bg-muted)",
                  borderBottom: "1px solid var(--border-subtle)",
                }}
              >
                {["B", "I", "U"].map((f) => (
                  <div
                    key={f}
                    className="w-6 h-6 rounded flex items-center justify-center text-[11px] font-bold"
                    style={{
                      background: "var(--bg-input)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {f}
                  </div>
                ))}
                <div
                  className="w-px h-4 mx-1"
                  style={{ background: "var(--border-subtle)" }}
                />
                {["≡", "⬤", "📐"].map((f, i) => (
                  <div
                    key={i}
                    className="w-6 h-6 rounded flex items-center justify-center text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    {f}
                  </div>
                ))}
                <div className="flex-1" />
                <div className="flex items-center gap-1">
                  <div
                    className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{
                      background: "rgba(99,102,241,0.2)",
                      color: "#818cf8",
                    }}
                  >
                    A
                  </div>
                  <div
                    className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center"
                    style={{
                      background: "rgba(52,211,153,0.2)",
                      color: "#34d399",
                    }}
                  >
                    J
                  </div>
                </div>
              </div>
              {/* Document area */}
              <div
                className="p-6"
                style={{ minHeight: 240, background: "var(--bg)" }}
              >
                <div className="max-w-[400px] mx-auto space-y-3">
                  <div
                    className="h-5 rounded w-2/3"
                    style={{ background: "var(--bg-input)" }}
                  />
                  <div
                    className="h-2.5 rounded w-full"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-2.5 rounded w-[90%]"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-2.5 rounded w-[75%]"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-2.5 rounded w-full mt-4"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div className="flex items-center gap-2 mt-2">
                    <div
                      className="h-2.5 rounded w-1/3"
                      style={{ background: "var(--bg-muted)" }}
                    />
                    <div
                      className="h-5 rounded px-2 inline-flex items-center text-[9px] font-semibold"
                      style={{
                        background: "rgba(251,191,36,0.2)",
                        color: "#fbbf24",
                        border: "1px solid rgba(251,191,36,0.3)",
                      }}
                    >
                      Comment
                    </div>
                  </div>
                  <div
                    className="h-2.5 rounded w-[85%]"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-2.5 rounded w-full"
                    style={{ background: "var(--bg-muted)" }}
                  />
                  <div
                    className="h-2.5 rounded w-[60%]"
                    style={{ background: "var(--bg-muted)" }}
                  />
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── TEMPLATES & MAIL MERGE ────────── */}
      <section className="relative z-10 py-20 sm:py-28">
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Template mockup */}
            <div className="order-2 lg:order-1">
              <div
                className="rounded-2xl overflow-hidden shadow-xl"
                style={{
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-card)",
                }}
              >
                <div
                  className="px-4 py-3 flex items-center justify-between"
                  style={{
                    background: "var(--bg-muted)",
                    borderBottom: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="flex items-center gap-2">
                    <span className="text-base">📑</span>
                    <span
                      className="text-[12px] font-semibold"
                      style={{ color: "var(--text)" }}
                    >
                      Employee Contract Template
                    </span>
                  </div>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "var(--accent-soft)",
                      color: "var(--accent-light)",
                      border: "1px solid var(--accent-border)",
                    }}
                  >
                    6 fields
                  </span>
                </div>
                {/* Preview text with fields highlighted */}
                <div
                  className="p-5 text-[12px] leading-7 font-mono"
                  style={{ color: "var(--text-secondary)" }}
                >
                  <p>This Employment Agreement is entered into between</p>
                  <p>
                    <strong style={{ color: "var(--text)" }}>
                      Acme Corporation
                    </strong>{" "}
                    ("Employer") and
                  </p>
                  <p className="inline">
                    <span
                      className="px-2 py-0.5 rounded-md mx-0.5"
                      style={{
                        background: "rgba(96,165,250,0.15)",
                        color: "#60a5fa",
                        border: "1px solid rgba(96,165,250,0.3)",
                      }}
                    >
                      {"{{employee_name}}"}
                    </span>{" "}
                    ("Employee")
                  </p>
                  <p className="mt-2">
                    for the role of{" "}
                    <span
                      className="px-2 py-0.5 rounded-md"
                      style={{
                        background: "rgba(244,114,182,0.15)",
                        color: "#f472b6",
                        border: "1px solid rgba(244,114,182,0.3)",
                      }}
                    >
                      {"{{position}}"}
                    </span>
                  </p>
                  <p>
                    starting on{" "}
                    <span
                      className="px-2 py-0.5 rounded-md"
                      style={{
                        background: "rgba(52,211,153,0.15)",
                        color: "#34d399",
                        border: "1px solid rgba(52,211,153,0.3)",
                      }}
                    >
                      {"{{start_date}}"}
                    </span>
                  </p>
                  <p>
                    at a salary of{" "}
                    <span
                      className="px-2 py-0.5 rounded-md"
                      style={{
                        background: "rgba(251,146,60,0.15)",
                        color: "#fb923c",
                        border: "1px solid rgba(251,146,60,0.3)",
                      }}
                    >
                      {"{{salary}}"}
                    </span>{" "}
                    per annum.
                  </p>
                </div>
                {/* Field legend */}
                <div className="px-5 pb-4 flex flex-wrap gap-2">
                  {[
                    { name: "employee_name", color: "#60a5fa", type: "text" },
                    { name: "position", color: "#f472b6", type: "text" },
                    { name: "start_date", color: "#34d399", type: "date" },
                    { name: "salary", color: "#fb923c", type: "number" },
                  ].map((f) => (
                    <span
                      key={f.name}
                      className="inline-flex items-center gap-1 text-[9px] font-medium px-2 py-0.5 rounded-md"
                      style={{
                        background: `${f.color}10`,
                        color: f.color,
                        border: `1px solid ${f.color}25`,
                      }}
                    >
                      <span className="opacity-60">{f.type}</span> · {f.name}
                    </span>
                  ))}
                </div>
              </div>

              {/* Bulk generate card */}
              <div
                className="mt-4 rounded-2xl p-4"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="flex items-center justify-between mb-3">
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    Bulk generate from CSV
                  </p>
                  <span
                    className="text-[10px] font-semibold px-2 py-0.5 rounded-full"
                    style={{
                      background: "rgba(251,146,60,0.12)",
                      color: "#fb923c",
                      border: "1px solid rgba(251,146,60,0.2)",
                    }}
                  >
                    142 rows
                  </span>
                </div>
                <div className="space-y-1.5">
                  {[
                    {
                      name: "Kenneth Aditya",
                      role: "Engineer",
                      date: "Jan 15, 2025",
                    },
                    {
                      name: "Chloe Putri Annette",
                      role: "Designer",
                      date: "Jan 20, 2025",
                    },
                    { name: "Baskara Nadi", role: "PM", date: "Feb 1, 2025" },
                  ].map((row) => (
                    <div
                      key={row.name}
                      className="flex items-center gap-3 px-3 py-2 rounded-lg"
                      style={{
                        background: "var(--bg-muted)",
                        border: "1px solid var(--border-subtle)",
                      }}
                    >
                      <div
                        className="w-5 h-5 rounded-full text-[9px] font-bold flex items-center justify-center shrink-0"
                        style={{
                          background: "var(--accent-soft)",
                          color: "var(--accent-light)",
                        }}
                      >
                        {row.name[0]}
                      </div>
                      <span
                        className="text-[11px] font-medium flex-1"
                        style={{ color: "var(--text)" }}
                      >
                        {row.name}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {row.role}
                      </span>
                      <span
                        className="text-[10px]"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {row.date}
                      </span>
                      <div className="w-2 h-2 rounded-full bg-emerald-400 shrink-0" />
                    </div>
                  ))}
                </div>
                <div className="mt-3 flex items-center justify-between">
                  <span
                    className="text-[10px]"
                    style={{ color: "var(--text-muted)" }}
                  >
                    +139 more rows
                  </span>
                  <div
                    className="flex items-center gap-2 text-[11px] font-semibold px-3 py-1.5 rounded-lg"
                    style={{
                      background: "rgba(251,146,60,0.12)",
                      color: "#fb923c",
                      border: "1px solid rgba(251,146,60,0.2)",
                    }}
                  >
                    ⚡ Generate 142 docs
                  </div>
                </div>
              </div>
            </div>

            {/* Text side */}
            <div className="order-1 lg:order-2">
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#f472b6" }}
              >
                Templates & Mail Merge
              </p>
              <h2
                className="text-[1.9rem] sm:text-[2.2rem] font-bold leading-tight tracking-tight mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Typed fields.
                <br />
                Hundreds of docs at once.
              </h2>
              <p
                className="text-[15px] leading-relaxed mb-6"
                style={{ color: "var(--text-muted)" }}
              >
                Define typed placeholders in any .docx file. Loop through
                repeating sections, apply conditional content, and bulk-generate
                personalised documents from a CSV — all in seconds.
              </p>
              <ul className="space-y-3">
                {[
                  "6 field types: text, date, number, email, loop, condition",
                  "Upload .docx or convert from .pdf — placeholders detected automatically",
                  "Import CSV rows → each row becomes a unique, filled document",
                  "Download all generated docs as a .zip archive",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="text-[13px] font-bold mt-0.5 shrink-0"
                      style={{ color: "#f472b6" }}
                    >
                      ✓
                    </span>
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>
          </div>
        </div>
      </section>

      {/* ────────── COLLECTIONS & ORGANISATION ────────── */}
      <section
        className="relative z-10 py-20 sm:py-28"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-muted)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5">
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-12 items-center">
            {/* Text */}
            <div>
              <p
                className="text-xs font-semibold uppercase tracking-widest mb-3"
                style={{ color: "#a78bfa" }}
              >
                Collections & Organisation
              </p>
              <h2
                className="text-[1.9rem] sm:text-[2.2rem] font-bold leading-tight tracking-tight mb-4"
                style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
              >
                Every document
                <br />
                has a home.
              </h2>
              <p
                className="text-[15px] leading-relaxed mb-6"
                style={{ color: "var(--text-muted)" }}
              >
                Create colour-coded collections with custom icons and tags. Pin
                your most-used folders, filter by label, and share across your
                whole organisation with one click.
              </p>
              <ul className="space-y-3">
                {[
                  "Custom icon + colour per collection — 30+ icons available",
                  "Tag papers with multiple collections simultaneously",
                  "Star/pin favourite collections for instant access",
                  "Organisation-wide sharing with team visibility",
                ].map((item) => (
                  <li key={item} className="flex items-start gap-3">
                    <span
                      className="text-[13px] font-bold mt-0.5 shrink-0"
                      style={{ color: "#a78bfa" }}
                    >
                      ✓
                    </span>
                    <span
                      className="text-[13px]"
                      style={{ color: "var(--text-secondary)" }}
                    >
                      {item}
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            {/* Collections mockup */}
            <div className="grid grid-cols-2 gap-3">
              {[
                {
                  name: "HR Documents",
                  icon: "👥",
                  color: "#6366f1",
                  count: 24,
                  desc: "Contracts, policies, onboarding guides",
                  starred: true,
                },
                {
                  name: "Client Proposals",
                  icon: "💼",
                  color: "#f472b6",
                  count: 12,
                  desc: "Active proposals and pitch decks",
                },
                {
                  name: "Finance Q4",
                  icon: "📊",
                  color: "#34d399",
                  count: 8,
                  desc: "Reports, budgets, forecasts",
                  starred: true,
                },
                {
                  name: "Legal Templates",
                  icon: "⚖️",
                  color: "#fb923c",
                  count: 31,
                  desc: "NDAs, agreements, compliance",
                },
              ].map((col) => (
                <div
                  key={col.name}
                  className="rounded-2xl p-4 flex flex-col gap-3 feature-card"
                  style={{
                    background: "var(--bg-card)",
                    border: "1px solid var(--border-subtle)",
                  }}
                >
                  <div className="flex items-start justify-between">
                    <div
                      className="w-10 h-10 rounded-xl flex items-center justify-center text-xl"
                      style={{
                        background: `${col.color}18`,
                        border: `1px solid ${col.color}28`,
                      }}
                    >
                      {col.icon}
                    </div>
                    {col.starred && (
                      <span className="text-amber-400 text-sm">★</span>
                    )}
                  </div>
                  <div>
                    <p
                      className="text-[12px] font-semibold leading-snug"
                      style={{ color: "var(--text)" }}
                    >
                      {col.name}
                    </p>
                    <p
                      className="text-[10px] mt-0.5 line-clamp-2 leading-snug"
                      style={{ color: "var(--text-muted)" }}
                    >
                      {col.desc}
                    </p>
                  </div>
                  <div>
                    <div className="flex items-center justify-between mb-1">
                      <span
                        className="text-[10px] font-medium"
                        style={{ color: "var(--text-dim)" }}
                      >
                        {col.count} papers
                      </span>
                    </div>
                    <div
                      className="h-1 rounded-full"
                      style={{ background: "var(--bg-input)" }}
                    >
                      <div
                        className="h-full rounded-full"
                        style={{
                          width: `${Math.min(100, col.count * 3)}%`,
                          background: col.color,
                          opacity: 0.7,
                        }}
                      />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ────────── GOOGLE FORMS INTEGRATION ────────── */}
      <section
        className="relative z-10 py-20 sm:py-28"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="max-w-6xl mx-auto px-5">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "#60a5fa" }}
            >
              Automation
            </p>
            <h2
              className="text-[1.9rem] sm:text-[2.4rem] font-bold leading-tight tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              Form submitted → document generated
            </h2>
            <p
              className="text-[15px] mt-4 max-w-xl mx-auto"
              style={{ color: "var(--text-muted)" }}
            >
              Connect any Google Form to a template. When someone submits,
              Paperspace automatically fills and saves their personalised
              document. No code. No waiting.
            </p>
          </div>

          {/* Flow diagram */}
          {/* <div className="flex flex-col sm:flex-row items-center justify-center gap-4 sm:gap-0">
            {[
              {
                icon: "📋",
                label: "Google Form",
                sub: "Respondent submits",
                color: "#60a5fa",
                bg: "rgba(96,165,250,0.1)",
                border: "rgba(96,165,250,0.2)",
              },
              null,
              {
                icon: "📑",
                label: "Your template",
                sub: "Mapped to form fields",
                color: "#f472b6",
                bg: "rgba(244,114,182,0.1)",
                border: "rgba(244,114,182,0.2)",
              },
              null,
              {
                icon: "📄",
                label: "Document generated",
                sub: "Saved in under 5 min",
                color: "#34d399",
                bg: "rgba(52,211,153,0.1)",
                border: "rgba(52,211,153,0.2)",
              },
            ].map((item, i) =>
              item === null ? (
                <div
                  key={i}
                  className="flex sm:flex-col items-center justify-center mx-2 sm:mx-4"
                >
                  <div className="flex items-center gap-1">
                    <svg
                      className="w-4 h-4 rotate-90 sm:rotate-0"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="var(--accent-light)"
                      strokeWidth={2}
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        d="M9 5l7 7-7 7"
                      />
                    </svg>
                  </div>
                  <p
                    className="text-[9px] mt-1 text-center"
                    style={{ color: "var(--text-dim)" }}
                  >
                    auto
                  </p>
                </div>
              ) : (
                <div
                  key={i}
                  className="flex flex-col items-center text-center rounded-2xl p-5 w-44"
                  style={{
                    background: item.bg,
                    border: `1px solid ${item.border}`,
                  }}
                >
                  <div className="text-3xl mb-2">{item.icon}</div>
                  <p
                    className="text-[12px] font-semibold"
                    style={{ color: "var(--text)" }}
                  >
                    {item.label}
                  </p>
                  <p
                    className="text-[10px] mt-0.5"
                    style={{ color: item.color }}
                  >
                    {item.sub}
                  </p>
                </div>
              )
            )}
          </div> */}

          <div className="mt-12 grid grid-cols-1 sm:grid-cols-3 gap-4 max-w-3xl mx-auto">
            {[
              {
                icon: "🔌",
                title: "Connect once",
                desc: "Link your Google account once and pick any form from your Drive.",
              },
              {
                icon: "🗺",
                title: "Map fields",
                desc: "Match form questions to your template placeholders with a visual editor.",
              },
              {
                icon: "⚡",
                title: "Auto-generate",
                desc: "Every new response triggers document creation within 5 minutes.",
              },
            ].map((step) => (
              <div
                key={step.title}
                className="rounded-xl p-4 text-center"
                style={{
                  background: "var(--bg-card)",
                  border: "1px solid var(--border-subtle)",
                }}
              >
                <div className="text-2xl mb-2">{step.icon}</div>
                <p
                  className="text-[12.5px] font-semibold mb-1"
                  style={{ color: "var(--text)" }}
                >
                  {step.title}
                </p>
                <p
                  className="text-[11.5px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── HOW IT WORKS ────────── */}
      <section
        className="relative z-10 py-20 sm:py-28"
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-muted)",
        }}
      >
        <div className="max-w-5xl mx-auto px-5">
          <div className="text-center mb-14">
            <p
              className="text-xs font-semibold uppercase tracking-widest mb-3"
              style={{ color: "var(--accent-light)" }}
            >
              How it works
            </p>
            <h2
              className="text-[1.9rem] sm:text-[2.4rem] font-bold leading-tight tracking-tight"
              style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
            >
              From zero to workspace in minutes
            </h2>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 relative">
            {/* Connector lines desktop */}
            {/* <div
              className="hidden sm:block absolute top-10 left-[calc(33%+16px)] right-[calc(33%+16px)] h-px"
              style={{
                background:
                  "linear-gradient(90deg, var(--accent-border) 0%, var(--accent-border) 100%)",
              }}
            /> */}

            {[
              {
                step: "01",
                title: "Create your account",
                desc: "Sign up with email or continue with Google. Your workspace is ready in seconds — no credit card required.",
                color: "#818cf8",
                bg: "rgba(99,102,241,0.1)",
              },
              {
                step: "02",
                title: "Upload or create a document",
                desc: "Import an existing .docx, upload a PDF, or start fresh in the browser editor. AI summaries are generated automatically.",
                color: "#34d399",
                bg: "rgba(52,211,153,0.1)",
              },
              {
                step: "03",
                title: "Organise, template & share",
                desc: "Build collections, convert docs into reusable templates, connect Google Forms, and share with your team.",
                color: "#f472b6",
                bg: "rgba(244,114,182,0.1)",
              },
            ].map((step) => (
              <div
                key={step.step}
                className="flex flex-col items-center text-center"
              >
                <div
                  className="w-16 h-16 rounded-2xl flex items-center justify-center text-xl font-bold mb-5 relative z-10"
                  style={{
                    background: step.bg,
                    border: `2px solid ${step.color}30`,
                    color: step.color,
                    fontFamily: "'Plus Jakarta Sans', sans-serif",
                  }}
                >
                  {step.step}
                </div>
                <h3
                  className="text-[14px] font-semibold mb-2"
                  style={{ color: "var(--text)" }}
                >
                  {step.title}
                </h3>
                <p
                  className="text-[12.5px] leading-relaxed"
                  style={{ color: "var(--text-muted)" }}
                >
                  {step.desc}
                </p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ────────── CTA SECTION ────────── */}
      <section
        className="relative z-10 py-24 sm:py-32 overflow-hidden"
        style={{ borderTop: "1px solid var(--border-subtle)" }}
      >
        <div className="absolute inset-0 pointer-events-none">
          <div
            className="absolute top-0 left-1/2 -translate-x-1/2 w-[800px] h-[400px] rounded-full"
            style={{
              background: "var(--ambient-glow)",
              filter: "blur(100px)",
              opacity: 0.6,
            }}
          />
        </div>
        <div className="relative max-w-2xl mx-auto px-5 text-center">
          <h2
            className="text-[2rem] sm:text-[2.6rem] font-bold leading-tight tracking-tight mb-5"
            style={{ fontFamily: "'Plus Jakarta Sans', sans-serif" }}
          >
            Ready to build your
            <br />
            <span className="gradient-text">document workspace?</span>
          </h2>
          <p
            className="text-[15px] leading-relaxed mb-8"
            style={{ color: "var(--text-muted)" }}
          >
            Free to get started. No credit card needed. Join teams already using
            Paperspace to write, generate, and organise at scale.
          </p>
          {!isSignedIn ? (
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3">
              <Link
                href="/sign-up"
                className="group w-full sm:w-auto inline-flex items-center justify-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl transition-all hover:opacity-90 hover:-translate-y-0.5"
                style={{
                  background: "var(--text)",
                  color: "var(--bg)",
                  boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
                  transition: "all .18s ease",
                }}
              >
                Start for free
                <svg
                  className="w-4 h-4 group-hover:translate-x-0.5 transition-transform"
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
                className="w-full sm:w-auto inline-flex items-center justify-center text-sm font-medium px-6 py-3.5 rounded-xl transition-all"
                style={{
                  color: "var(--text-muted)",
                  border: "1px solid var(--border-subtle)",
                  background: "var(--bg-muted)",
                }}
              >
                Already have an account? Sign in
              </Link>
            </div>
          ) : (
            <Link
              href="/home"
              className="inline-flex items-center gap-2 text-sm font-semibold px-7 py-3.5 rounded-xl transition-all hover:opacity-90"
              style={{
                background: "var(--text)",
                color: "var(--bg)",
                boxShadow: "0 8px 32px rgba(0,0,0,0.18)",
              }}
            >
              Open your workspace →
            </Link>
          )}
        </div>
      </section>

      {/* ────────── FOOTER ────────── */}
      <footer
        style={{
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-sidebar)",
        }}
      >
        <div className="max-w-6xl mx-auto px-5 py-12">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-8 mb-10">
            {/* Brand */}
            <div className="col-span-2 sm:col-span-1">
              <div className="flex items-center gap-2 mb-3">
                <div
                  className="w-7 h-7 rounded-lg flex items-center justify-center"
                  style={{
                    background: "linear-gradient(135deg, #6366f1, #8b5cf6)",
                  }}
                >
                  <svg width="14" height="14" viewBox="0 0 14 14" fill="none">
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
                  className="text-[14px] font-semibold"
                  style={{ color: "var(--text)" }}
                >
                  Paperspace
                </span>
              </div>
              <p
                className="text-[12px] leading-relaxed"
                style={{ color: "var(--text-muted)" }}
              >
                Your modern document workspace — write, organise, and generate
                at scale.
              </p>
            </div>

            {/* Product */}
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                Product
              </p>
              <ul className="space-y-2">
                {[
                  { label: "Editor", href: "#" },
                  { label: "Templates", href: "#" },
                  { label: "Mail merge", href: "#" },
                  { label: "Collections", href: "#" },
                  { label: "AI summaries", href: "#" },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Integrations */}
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                Integrations
              </p>
              <ul className="space-y-2">
                {[
                  { label: "Google Forms", href: "#" },
                  { label: "Google Drive", href: "#" },
                  { label: "ONLYOFFICE", href: "#" },
                  { label: "Clerk Auth", href: "#" },
                  { label: "Convex DB", href: "#" },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>

            {/* Company */}
            <div>
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                Company
              </p>
              <ul className="space-y-2">
                {[
                  { label: "Sign up free", href: "/sign-up" },
                  { label: "Sign in", href: "/sign-in" },
                  { label: "Privacy policy", href: "#" },
                  { label: "Terms of service", href: "#" },
                ].map((l) => (
                  <li key={l.label}>
                    <a
                      href={l.href}
                      className="text-[12px] text-[var(--text-muted)] hover:text-[var(--text)] transition-colors"
                    >
                      {l.label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </div>

          {/* Bottom bar */}
          <div
            className="flex flex-col sm:flex-row items-center justify-between gap-3 pt-6"
            style={{ borderTop: "1px solid var(--border-subtle)" }}
          >
            <p className="text-[11px]" style={{ color: "var(--text-dim)" }}>
              © {new Date().getFullYear()} Paperspace. All rights reserved.
            </p>
            <div className="flex items-center gap-4">
              <span
                className="text-[11px]"
                style={{ color: "var(--text-dim)" }}
              >
                Built with ONLYOFFICE · Clerk · Convex
              </span>
              <div className="flex items-center gap-1">
                <span className="w-1.5 h-1.5 rounded-full bg-emerald-400" />
                <span
                  className="text-[11px]"
                  style={{ color: "var(--text-muted)" }}
                >
                  All systems operational
                </span>
              </div>
            </div>
          </div>
        </div>
      </footer>
    </div>
  );
}
