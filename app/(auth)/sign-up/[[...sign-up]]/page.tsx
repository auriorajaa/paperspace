// app/(auth)/sign-up/[[...sign-up]]/page.tsx
import { SignUp } from "@clerk/nextjs";
import { auth } from "@clerk/nextjs/server";
import { redirect } from "next/navigation";
import { PreAuthNavbar } from "@/components/PreAuthNavbar";
import {
  FileTextIcon,
  UsersIcon,
  SparklesIcon,
  ShieldCheckIcon,
  ArrowRightIcon,
} from "lucide-react";

const benefits = [
  {
    icon: FileTextIcon,
    color: "#818cf8",
    bg: "rgba(99,102,241,0.1)",
    border: "rgba(99,102,241,0.18)",
    title: "Start with zero friction",
    desc: "Create your first document in seconds — no configuration needed.",
  },
  {
    icon: SparklesIcon,
    color: "#34d399",
    bg: "rgba(52,211,153,0.1)",
    border: "rgba(52,211,153,0.18)",
    title: "AI does the heavy lifting",
    desc: "Automatic summaries, smart placeholder detection, and bulk exports.",
  },
  {
    icon: UsersIcon,
    color: "#f472b6",
    bg: "rgba(244,114,182,0.1)",
    border: "rgba(244,114,182,0.18)",
    title: "Built for teams",
    desc: "Share documents across your organisation with role-based access.",
  },
];

const steps = [
  { num: "01", label: "Create your account" },
  { num: "02", label: "Upload or create a document" },
  { num: "03", label: "Invite your team" },
];

export default async function SignUpPage() {
  const { userId } = await auth();
  if (userId) redirect("/home");

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      <PreAuthNavbar page="sign-up" />

      {/* Ambient glow */}
      <div
        className="fixed top-[-15%] right-[5%] w-[520px] h-[520px] rounded-full pointer-events-none"
        style={{ background: "var(--ambient-glow)", filter: "blur(130px)" }}
      />
      <div
        className="fixed bottom-[-10%] left-[5%] w-[380px] h-[380px] rounded-full pointer-events-none"
        style={{ background: "rgba(139,92,246,0.04)", filter: "blur(110px)" }}
      />

      {/* Noise */}
      <div
        className="fixed inset-0 pointer-events-none opacity-[0.022]"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 512 512' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23n)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Split layout — MIRRORED: form left, features right */}
      <div className="flex flex-1 pt-14 min-h-0">
        {/* ── LEFT: auth form ───────────────────────────────────────── */}
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
                Create your account
              </h2>
              <p className="text-sm" style={{ color: "var(--text-muted)" }}>
                Already have one?{" "}
                <a
                  href="/sign-in"
                  className="font-medium hover:underline"
                  style={{ color: "var(--accent-light)" }}
                >
                  Sign in
                </a>
              </p>
            </div>

            {/* Clerk — shadow stripped, ClerkThemeProvider handles colours */}
            <SignUp
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

        {/* ── RIGHT: benefits panel ─────────────────────────────────── */}
        <div
          className="hidden lg:flex lg:w-[54%] xl:w-[56%] flex-col justify-center items-center relative overflow-hidden"
          style={{ borderLeft: "1px solid var(--border-subtle)" }}
        >
          {/* Grid overlay */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{
              backgroundImage:
                "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
              backgroundSize: "52px 52px",
            }}
          />

          {/* Centred content block — mirrors sign-in panel */}
          <div className="relative w-full max-w-[460px] px-10 xl:px-0">
            {/* Badge */}
            {/* <div
              className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full mb-7 text-xs font-medium"
              style={{
                background: "var(--success-bg)",
                border:
                  "1px solid color-mix(in srgb, var(--success) 22%, transparent)",
                color: "var(--success)",
              }}
            >
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              Free to get started
            </div> */}

            {/* Heading — plain var(--text), no blue cast */}
            <h1
              className="text-[2.3rem] xl:text-[2.6rem] font-bold leading-[1.08] tracking-tight mb-4"
              style={{
                fontFamily: "'Plus Jakarta Sans', sans-serif",
                color: "var(--text)",
              }}
            >
              Your document
              <br />
              workspace awaits.
            </h1>
            <p
              className="text-[14.5px] mb-7 leading-relaxed"
              style={{ color: "var(--text-muted)" }}
            >
              Join and start writing, templating, and generating documents the
              smart way — in minutes.
            </p>

            {/* Benefit cards */}
            <div className="space-y-2 mb-5">
              {benefits.map((b) => {
                const Icon = b.icon;
                return (
                  <div
                    key={b.title}
                    className="flex items-center gap-3 px-3.5 py-2.5 rounded-xl"
                    style={{
                      background: "var(--bg-card)",
                      border: "1px solid var(--border-subtle)",
                    }}
                  >
                    <div
                      className="w-7 h-7 rounded-lg flex items-center justify-center shrink-0"
                      style={{
                        background: b.bg,
                        border: `1px solid ${b.border}`,
                      }}
                    >
                      <Icon className="w-3 h-3" style={{ color: b.color }} />
                    </div>
                    <div className="min-w-0 flex-1">
                      <p
                        className="text-[12.5px] font-semibold leading-snug"
                        style={{ color: "var(--text)" }}
                      >
                        {b.title}
                      </p>
                      <p
                        className="text-[11px] mt-0.5 leading-snug"
                        style={{ color: "var(--text-muted)" }}
                      >
                        {b.desc}
                      </p>
                    </div>
                  </div>
                );
              })}
            </div>

            {/* How it works */}
            <div
              className="p-4 rounded-xl mb-5"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
              }}
            >
              <p
                className="text-[10px] font-semibold uppercase tracking-widest mb-3"
                style={{ color: "var(--text-dim)" }}
              >
                How it works
              </p>
              <div className="flex items-center gap-2">
                {steps.map((s, i) => (
                  <div key={s.num} className="flex items-center gap-2 flex-1">
                    <div className="flex items-center gap-2 flex-1 min-w-0">
                      <div
                        className="w-6 h-6 rounded-lg flex items-center justify-center text-[10px] font-bold shrink-0"
                        style={{
                          background:
                            i === 0 ? "var(--accent-soft)" : "var(--bg-muted)",
                          color:
                            i === 0 ? "var(--accent-light)" : "var(--text-dim)",
                          border: `1px solid ${i === 0 ? "var(--accent-border)" : "var(--border-subtle)"}`,
                        }}
                      >
                        {s.num}
                      </div>
                      <span
                        className="text-[11px] font-medium leading-tight"
                        style={{
                          color:
                            i === 0
                              ? "var(--text-secondary)"
                              : "var(--text-muted)",
                        }}
                      >
                        {s.label}
                      </span>
                    </div>
                    {i < steps.length - 1 && (
                      <ArrowRightIcon
                        className="w-3 h-3 shrink-0"
                        style={{ color: "var(--text-placeholder)" }}
                      />
                    )}
                  </div>
                ))}
              </div>
            </div>

            {/* Security note */}
            {/* <div
              className="flex items-center gap-2 text-[11px] font-medium"
              style={{ color: "var(--text-dim)" }}
            >
              <ShieldCheckIcon
                className="w-3.5 h-3.5 shrink-0"
                style={{ color: "var(--success)" }}
              />
              Your data is protected by Clerk — industry-standard security.
            </div> */}
          </div>
        </div>
      </div>
    </div>
  );
}
