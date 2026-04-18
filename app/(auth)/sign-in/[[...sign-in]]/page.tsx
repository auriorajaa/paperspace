// app/(auth)/sign-in/[[...sign-in]]/page.tsx
import { SignIn } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PreAuthNavbar } from "@/components/PreAuthNavbar";
import {
  FilesIcon,
  SparklesIcon,
  LayoutTemplateIcon,
  ZapIcon,
  FolderIcon,
  ShieldCheckIcon,
} from "lucide-react";

const features = [
  {
    icon: FilesIcon,
    color: "#818cf8",
    bg: "rgba(99,102,241,0.1)",
    border: "rgba(99,102,241,0.18)",
    title: "Real-time ONLYOFFICE editor",
    desc: "Professional document editing in the browser — no installs needed.",
  },
  {
    icon: SparklesIcon,
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.18)",
    title: "AI-powered summaries",
    desc: "Every document is automatically summarised so you stay in context.",
  },
  {
    icon: LayoutTemplateIcon,
    color: "#f472b6",
    bg: "rgba(244,114,182,0.1)",
    border: "rgba(244,114,182,0.18)",
    title: "Smart templates",
    desc: "Build reusable templates with dynamic placeholders and field types.",
  },
  {
    icon: ZapIcon,
    color: "#fb923c",
    bg: "rgba(251,146,60,0.1)",
    border: "rgba(251,146,60,0.18)",
    title: "Mail merge & bulk generate",
    desc: "Generate hundreds of personalised documents in a single click.",
  },
  {
    icon: FolderIcon,
    color: "#a78bfa",
    bg: "rgba(167,139,250,0.1)",
    border: "rgba(167,139,250,0.18)",
    title: "Collections & folders",
    desc: "Organise all your papers into colour-coded collections with tags.",
  },
];

export default async function SignInPage() {
  const { userId } = await auth();
  if (userId) redirect("/home");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PreAuthNavbar page="sign-in" />

      {/* Ambient glow — subtle, theme-aware */}
      <div
        className="fixed top-[-15%] left-[5%] w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: "var(--ambient-glow)", filter: "blur(130px)" }}
      />
      <div
        className="fixed bottom-[-10%] right-[5%] w-[380px] h-[380px] rounded-full pointer-events-none"
        style={{ background: "rgba(139,92,246,0.04)", filter: "blur(110px)" }}
      />

      {/* Noise */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.022]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Split layout */}
      <div className="flex flex-1 pt-14 min-h-0">
        {/* ── LEFT: feature showcase ─────────────────────────────────── */}
        <div
          className="hidden lg:flex lg:w-[54%] xl:w-[56%] flex-col justify-center items-center relative overflow-hidden"
          style={{ borderRight: "1px solid var(--border-subtle)" }}
        >
          {/* Grid */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />

          {/* Centred content block */}
          <div className="relative w-full max-w-[460px] px-10 xl:px-0">
            {/* Badge */}
            {/* <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7 text-xs font-medium"
              style={{
                background: "var(--accent-soft)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent-light)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Document workspace, reimagined
            </div> */}

            {/* Heading — plain var(--text), no blue cast */}
            <h1
              className="text-[2.3rem] xl:text-[2.6rem] font-bold leading-[1.08] tracking-tight mb-4"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: "var(--text)",
              }}
            >
              Write, organise,
              <br />
              generate at scale.
            </h1>
            <p
              className="text-[14.5px] mb-7 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Everything your documents need — real-time editing, AI summaries,
              smart templates, and bulk generation.
            </p>

            {/* Feature list */}
            <div className="space-y-2">
              {features.map((f) => {
                const Icon = f.icon;
                return (
                  <div
                    key={f.title}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: f.bg,
                        border: `1px solid ${f.border}`,
                      }}
                    >
                      <Icon className="w-3 h-3" style={{ color: f.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[12.5px] font-semibold leading-snug"
                        style={{ color: "var(--text)" }}
                      >
                        {f.title}
                      </p>
                      <p
                        className="text-[11px] mt-0.5 leading-snug"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {f.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* Footer row */}
            <div
              className="flex items-center gap-4 mt-6 pt-5"
              style={{ borderTop: "1px solid var(--border-subtle)" }}
            >
              {[
                { value: "100%", label: "In-browser" },
                { value: "AI", label: "Summaries" },
                // { value: "∞", label: "Documents" },
              ].map((s) => (
                <div key={s.label}>
                  <p
                    className="text-base font-bold tabular-nums"
                    style={{ color: "var(--accent-light)" }}
                  >
                    {s.value}
                  </p>
                  <p
                    className="text-[10.5px] font-medium mt-0.5"
                    style={{ color: "var(--text-dim)" }}
                  >
                    {s.label}
                  </p>
                </div>
              ))}
              {/* <div
                className="ml-auto flex items-center gap-1.5 px-2.5 py-1 rounded-lg text-[11px] font-medium"
                style={{
                  background: "var(--success-bg)",
                  border:
                    "1px solid color-mix(in srgb, var(--success) 18%, transparent)",
                  color: "var(--success)",
                }}
              >
                <ShieldCheckIcon className="w-3 h-3" />
                Secured by Clerk
              </div> */}
            </div>
          </div>
        </div>

        {/* ── RIGHT: auth form ──────────────────────────────────────── */}
        <div className="flex-1 flex flex-col items-center justify-center px-4 sm:px-8 py-10">
          <div className="w-full max-w-[380px]">
            {/* Heading */}
            <div className="mb-5">
              <h2
                className="text-xl font-bold mb-1"
                style={{
                  color: "var(--text)",
                  fontFamily: "'Plus Jakarta Sans', sans-serif",
                }}
              >
                Welcome back
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                New to Paperspace?{" "}
                <a
                  href="/sign-up"
                  className="font-medium hover:underline"
                  style={{ color: "var(--accent-light)" }}
                >
                  Create an account
                </a>
              </p>
            </div>

            {/* Clerk — shadow stripped, ClerkThemeProvider handles colours */}
            <SignIn
              appearance={{
                elements: {
                  rootBox: "w-full",
                  card: {
                    boxShadow: "0 1px 3px rgba(0,0,0,0.08)",
                  },
                },
              }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
