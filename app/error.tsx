"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";

/* ─── Types ──────────────────────────────────────────────────────────── */
interface ErrorPageProps {
  error: Error & { digest?: string };
  reset: () => void;
}

/* ─── Constants ──────────────────────────────────────────────────────── */
const CRASH_LOGS = [
  { time: "00:00:00", event: "Application render started", status: "ok" },
  { time: "00:00:01", event: "Component tree mounting", status: "ok" },
  { time: "00:00:02", event: "Data hydration initiated", status: "ok" },
  { time: "00:00:03", event: "Unexpected exception thrown", status: "warn" },
  { time: "00:00:04", event: "Error boundary triggered", status: "warn" },
  { time: "00:00:05", event: "Stack unwind in progress", status: "err" },
  { time: "00:00:06", event: "Component tree unmounted", status: "err" },
  {
    time: "00:00:07",
    event: "Fallback UI rendered — you're here",
    status: "err",
  },
] as const;

const REPAIR_LOGS = [
  { time: "00:00:01", event: "Repair sequence initialised", status: "ok" },
  { time: "00:00:02", event: "Clearing component error state", status: "ok" },
  { time: "00:00:03", event: "Resetting React error boundary", status: "ok" },
  { time: "00:00:04", event: "Re-mounting component tree", status: "ok" },
  { time: "00:00:05", event: "Restoring application state", status: "ok" },
] as const;

const STATUS_META: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  ok: { bg: "rgba(52,211,153,0.14)", color: "var(--success)", label: "OK" },
  warn: { bg: "rgba(251,191,36,0.14)", color: "var(--warning)", label: "WARN" },
  err: { bg: "rgba(248,113,113,0.14)", color: "var(--danger)", label: "ERR" },
};

const FACES = ["(╯°□°）╯", "ヽ(°〇°)ﾉ", "(ﾉ`Д´)ﾉ", "щ(ﾟДﾟщ)", "(⊙_⊙;)"];

/* ─── Component ──────────────────────────────────────────────────────── */
export default function ErrorPage({ error, reset }: ErrorPageProps) {
  const [crashIndex, setCrashIndex] = useState(0);
  const [repairIndex, setRepairIndex] = useState(0);
  const [dots, setDots] = useState("");
  const [stamped, setStamped] = useState(false);
  const [repairing, setRepairing] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);
  const [shaking, setShaking] = useState(false);
  const [scanLine, setScanLine] = useState(0); // 0-100 progress of scan line

  /* Blinking cursor dots */
  useEffect(() => {
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      420
    );
    return () => clearInterval(id);
  }, []);

  /* Reveal crash log rows */
  useEffect(() => {
    if (repairing) return;
    if (crashIndex >= CRASH_LOGS.length) {
      setTimeout(() => setStamped(true), 280);
      return;
    }
    const delay = crashIndex === 0 ? 500 : 180 + crashIndex * 90;
    const id = setTimeout(() => setCrashIndex((i) => i + 1), delay);
    return () => clearTimeout(id);
  }, [crashIndex, repairing]);

  /* Rotating panic faces */
  useEffect(() => {
    const id = setInterval(
      () => setFaceIndex((i) => (i + 1) % FACES.length),
      2000
    );
    return () => clearInterval(id);
  }, []);

  /* Periodic shake on the document */
  useEffect(() => {
    const id = setInterval(() => {
      setShaking(true);
      setTimeout(() => setShaking(false), 500);
    }, 3500);
    return () => clearInterval(id);
  }, []);

  /* Scan-line sweep animation */
  useEffect(() => {
    let raf: number;
    let start: number;
    const sweep = (ts: number) => {
      if (!start) start = ts;
      const elapsed = (ts - start) % 3000;
      setScanLine(Math.floor((elapsed / 3000) * 100));
      raf = requestAnimationFrame(sweep);
    };
    raf = requestAnimationFrame(sweep);
    return () => cancelAnimationFrame(raf);
  }, []);

  /* Repair flow: reveal repair logs, then call reset() */
  const handleRepair = useCallback(() => {
    if (repairing) return;
    setRepairing(true);
    setStamped(false);
    setCrashIndex(0);

    let idx = 0;
    const reveal = () => {
      if (idx >= REPAIR_LOGS.length) {
        setTimeout(reset, 500);
        return;
      }
      setRepairIndex(idx + 1);
      idx++;
      setTimeout(reveal, 260);
    };
    setTimeout(reveal, 300);
  }, [repairing, reset]);

  const truncateMessage = (msg: string, max = 72) =>
    msg.length > max ? msg.slice(0, max) + "…" : msg;

  const errorName = error?.name ?? "UnknownError";
  const errorMessage = error?.message ?? "An unexpected error occurred.";
  const digest = error?.digest;

  const activeLogs = repairing
    ? REPAIR_LOGS.slice(0, repairIndex)
    : CRASH_LOGS.slice(0, crashIndex);
  const totalLogs = repairing ? REPAIR_LOGS.length : CRASH_LOGS.length;
  const logsDone = (repairing ? repairIndex : crashIndex) >= totalLogs;

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* ─── Animations ─────────────────────────────────────────── */}
      <style>{`
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(16px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes log-in {
          from { opacity: 0; transform: translateX(-8px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes shake {
          0%,100% { transform: rotate(-2deg) translateX(0); }
          15%     { transform: rotate(-4deg) translateX(-4px); }
          30%     { transform: rotate( 4deg) translateX( 4px); }
          45%     { transform: rotate(-3deg) translateX(-3px); }
          60%     { transform: rotate( 3deg) translateX( 3px); }
          75%     { transform: rotate(-2deg) translateX(-2px); }
        }
        @keyframes float-err {
          0%,100% { transform: translateY(0)   rotate(-2deg); }
          50%     { transform: translateY(-12px) rotate(2deg); }
        }
        @keyframes stamp-drop {
          0%   { transform: scale(1.7) rotate(8deg);  opacity: 0; }
          60%  { transform: scale(0.9) rotate(8deg);  opacity: 1; }
          80%  { transform: scale(1.06) rotate(8deg); }
          100% { transform: scale(1)   rotate(8deg);  opacity: 1; }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes face-swap {
          0%,80%  { opacity:1; transform:translateY(0); }
          88%     { opacity:0; transform:translateY(-5px); }
          93%     { opacity:0; transform:translateY(5px); }
          100%    { opacity:1; transform:translateY(0); }
        }
        @keyframes glitch-o {
          0%,100% { clip-path:inset(100% 0 0    0); transform:translate(0); }
          18%     { clip-path:inset(65%  0 15%  0); transform:translate( 3px,-2px); }
          42%     { clip-path:inset(30%  0 45%  0); transform:translate(-3px, 2px); }
          68%     { clip-path:inset(5%   0 78%  0); transform:translate( 2px, 3px); }
        }
        @keyframes glitch-r {
          0%,100% { clip-path:inset(0 0 100% 0); transform:translate(0); }
          18%     { clip-path:inset(12% 0 58% 0); transform:translate(-3px, 2px); }
          42%     { clip-path:inset(45% 0 28% 0); transform:translate( 3px,-2px); }
          68%     { clip-path:inset(72% 0  8% 0); transform:translate(-2px, 3px); }
        }
        @keyframes spin-repair {
          from { transform: rotate(0deg); }
          to   { transform: rotate(360deg); }
        }
        @keyframes pulse-ring {
          0%   { transform: scale(1);   opacity:.5; }
          100% { transform: scale(1.55);opacity:0; }
        }
        .gradient-text-err {
          background: linear-gradient(135deg, #f87171 0%, #fb923c 50%, #fbbf24 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 3.5s linear infinite;
        }
        .glitch-o    { animation: glitch-o 5s steps(1) infinite 0.15s; }
        .glitch-r2   { animation: glitch-r 5s steps(1) infinite 0.5s; }
        .doc-shake   { animation: shake 0.5s ease-in-out; }
        .doc-float   { animation: float-err 5.5s ease-in-out infinite; }
        .stamp-drop  { animation: stamp-drop 0.42s cubic-bezier(.3,1.4,.5,1) forwards; }
        .log-in      { animation: log-in 0.22s ease-out both; }
        .fade-up     { animation: fade-up 0.5s ease-out both; }
        .fade-up-1   { animation: fade-up 0.5s ease-out 0.08s both; }
        .fade-up-2   { animation: fade-up 0.5s ease-out 0.18s both; }
        .fade-up-3   { animation: fade-up 0.5s ease-out 0.30s both; }
        .blink       { animation: blink 1s step-end infinite; }
        .face-swap   { animation: face-swap 2s ease-in-out infinite; }
        .spin-repair { animation: spin-repair 1s linear infinite; }
        .pulse-ring  { animation: pulse-ring 1.4s ease-out infinite; }
        .btn-hover   { transition: all .16s ease; }
        .btn-hover:hover { transform: translateY(-2px); }
      `}</style>

      {/* ─── Background ──────────────────────────────────────────── */}
      <div className="fixed inset-0 pointer-events-none overflow-hidden">
        <div
          className="absolute inset-0 opacity-[0.025]"
          style={{
            backgroundImage:
              "linear-gradient(var(--text) 1px,transparent 1px),linear-gradient(90deg,var(--text) 1px,transparent 1px)",
            backgroundSize: "60px 60px",
          }}
        />
        {/* Orange glow */}
        <div
          className="absolute top-[-10%] right-[15%] w-[560px] h-[560px] rounded-full"
          style={{ background: "rgba(251,146,60,0.05)", filter: "blur(130px)" }}
        />
        <div
          className="absolute bottom-[0%] left-[5%] w-[380px] h-[380px] rounded-full"
          style={{
            background: "rgba(248,113,113,0.04)",
            filter: "blur(110px)",
          }}
        />
      </div>

      {/* ─── Nav ─────────────────────────────────────────────────── */}
      <nav
        className="relative z-20 flex items-center justify-between px-5 sm:px-8 h-14 shrink-0"
        style={{
          borderBottom: "1px solid var(--border-subtle)",
          background: "var(--bg-sidebar)",
        }}
      >
        <Link href="/" className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-lg flex items-center justify-center">
            <img src="/favicon.svg" alt="Paperspace" width={32} height={32} />
          </div>
          <span
            className="text-[14px] font-semibold"
            style={{
              color: "var(--text)",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            Paperspace
          </span>
        </Link>
        <Link
          href="/home"
          className="btn-hover text-[13px] font-medium px-4 py-1.5 rounded-lg"
          style={{
            background: "var(--bg-muted)",
            border: "1px solid var(--border-subtle)",
            color: "var(--text-secondary)",
          }}
        >
          ← Back to home
        </Link>
      </nav>

      {/* ─── Main ────────────────────────────────────────────────── */}
      <main className="relative z-10 flex-1 flex flex-col lg:flex-row items-center justify-center gap-10 lg:gap-20 px-6 py-14 sm:py-20 max-w-6xl mx-auto w-full">
        {/* ── Left: Visual ── */}
        <div className="flex flex-col items-center">
          {/* ERR / 500 headline with glitch */}
          <div className="relative select-none leading-none mb-4">
            <h1
              className="gradient-text-err font-black"
              style={{
                fontSize: "clamp(5.5rem,16vw,12rem)",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              500
            </h1>
            {/* Glitch orange */}
            <h1
              aria-hidden
              className="glitch-o absolute inset-0 font-black pointer-events-none"
              style={{
                fontSize: "clamp(5.5rem,16vw,12rem)",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#fb923c",
                opacity: 0.3,
                mixBlendMode: "screen",
              }}
            >
              500
            </h1>
            {/* Glitch red */}
            <h1
              aria-hidden
              className="glitch-r2 absolute inset-0 font-black pointer-events-none"
              style={{
                fontSize: "clamp(5.5rem,16vw,12rem)",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#f43f5e",
                opacity: 0.22,
                mixBlendMode: "screen",
              }}
            >
              500
            </h1>
          </div>

          {/* Panic face carousel */}
          <p
            className="face-swap font-mono font-bold mb-8 text-center"
            style={{
              fontSize: "clamp(0.95rem,2.8vw,1.3rem)",
              color: "var(--text-muted)",
              minHeight: "2em",
              display: "flex",
              alignItems: "center",
            }}
          >
            {FACES[faceIndex]}
          </p>

          {/* Corrupted document */}
          <div className="relative">
            {/* Pulsing ring behind — only while repairing */}
            {repairing && (
              <div
                className="pulse-ring absolute inset-0 rounded-2xl pointer-events-none"
                style={{ border: "2px solid rgba(251,146,60,0.4)" }}
              />
            )}

            <div
              className={
                shaking && !repairing
                  ? "doc-shake"
                  : repairing
                    ? ""
                    : "doc-float"
              }
              style={{ transformOrigin: "center bottom" }}
            >
              <svg
                width="120"
                height="148"
                viewBox="0 0 120 148"
                fill="none"
                xmlns="http://www.w3.org/2000/svg"
              >
                {/* Shadow */}
                <ellipse
                  cx="60"
                  cy="144"
                  rx="36"
                  ry="5"
                  fill="rgba(0,0,0,0.12)"
                />

                {/* Paper body */}
                <rect
                  x="8"
                  y="4"
                  width="88"
                  height="116"
                  rx="6"
                  fill="var(--bg-card)"
                  stroke="var(--border-hover)"
                  strokeWidth="1.5"
                />
                {/* Dog-ear */}
                <path
                  d="M80 4 L96 20 L80 20 Z"
                  fill="var(--bg-muted)"
                  stroke="var(--border-hover)"
                  strokeWidth="1"
                />

                {/* Header bar */}
                <rect
                  x="20"
                  y="14"
                  width="48"
                  height="12"
                  rx="3"
                  fill="rgba(248,113,113,0.12)"
                  stroke="rgba(248,113,113,0.25)"
                  strokeWidth="1"
                />
                <text
                  x="27"
                  y="24"
                  fontSize="7"
                  fontWeight="700"
                  fontFamily="monospace"
                  fill="var(--danger)"
                  opacity="0.9"
                >
                  error.log
                </text>

                {/* Glitchy / corrupted lines */}
                <line
                  x1="20"
                  y1="38"
                  x2="84"
                  y2="38"
                  stroke="var(--border-subtle)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="20"
                  y1="47"
                  x2="70"
                  y2="47"
                  stroke="var(--border-subtle)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Broken lines to imply corruption */}
                <line
                  x1="20"
                  y1="56"
                  x2="40"
                  y2="56"
                  stroke="rgba(251,146,60,0.5)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="3 2"
                />
                <line
                  x1="46"
                  y1="56"
                  x2="84"
                  y2="56"
                  stroke="var(--border-subtle)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                  strokeDasharray="3 2"
                />
                <line
                  x1="20"
                  y1="65"
                  x2="84"
                  y2="65"
                  stroke="var(--border-subtle)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                {/* Red squiggly scan-line */}
                <line
                  x1="8"
                  y1={14 + (scanLine / 100) * 106}
                  x2="96"
                  y2={14 + (scanLine / 100) * 106}
                  stroke="rgba(248,113,113,0.18)"
                  strokeWidth="2"
                />
                <line
                  x1="20"
                  y1="74"
                  x2="60"
                  y2="74"
                  stroke="rgba(248,113,113,0.3)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />
                <line
                  x1="20"
                  y1="83"
                  x2="78"
                  y2="83"
                  stroke="var(--border-subtle)"
                  strokeWidth="1.5"
                  strokeLinecap="round"
                />

                {/* CORRUPTED stamp */}
                {stamped && !repairing && (
                  <g
                    className="stamp-drop"
                    style={{ transformOrigin: "52px 99px" }}
                  >
                    <rect
                      x="12"
                      y="90"
                      width="80"
                      height="20"
                      rx="3"
                      fill="none"
                      stroke="var(--danger)"
                      strokeWidth="2.5"
                      opacity="0.88"
                    />
                    <text
                      x="52"
                      y="104"
                      fontSize="9"
                      fontWeight="900"
                      fontFamily="'Plus Jakarta Sans',sans-serif"
                      fill="var(--danger)"
                      textAnchor="middle"
                      letterSpacing="2.5"
                      opacity="0.88"
                    >
                      CORRUPTED
                    </text>
                  </g>
                )}

                {/* REPAIRED stamp (after repair) */}
                {repairing && repairIndex >= REPAIR_LOGS.length && (
                  <g
                    className="stamp-drop"
                    style={{ transformOrigin: "52px 99px" }}
                  >
                    <rect
                      x="12"
                      y="90"
                      width="80"
                      height="20"
                      rx="3"
                      fill="none"
                      stroke="var(--success)"
                      strokeWidth="2.5"
                      opacity="0.88"
                    />
                    <text
                      x="52"
                      y="104"
                      fontSize="9"
                      fontWeight="900"
                      fontFamily="'Plus Jakarta Sans',sans-serif"
                      fill="var(--success)"
                      textAnchor="middle"
                      letterSpacing="2.5"
                      opacity="0.88"
                    >
                      REPAIRED
                    </text>
                  </g>
                )}
              </svg>
            </div>

            {/* Caption under doc */}
            <p
              className="text-center text-[11px] mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              {repairing
                ? repairIndex >= REPAIR_LOGS.length
                  ? "✅ Repair complete!"
                  : "🔧 Repairing…"
                : "📄 Something broke this file"}
            </p>
          </div>
        </div>

        {/* ── Right: Info + terminal ── */}
        <div className="w-full max-w-[440px]">
          {/* Badge */}
          {/* <div
            className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold mb-4"
            style={{
              background: "rgba(251,146,60,0.12)",
              border: "1px solid rgba(251,146,60,0.22)",
              color: "#fb923c",
            }}
          >
            <span
              className="w-1.5 h-1.5 rounded-full shrink-0"
              style={{
                background: "#fb923c",
                animation: "blink 1s step-end infinite",
              }}
            />
            RUNTIME_ERROR · Something crashed
          </div> */}

          {/* Headline */}
          <h2
            className="fade-up-1 font-bold leading-tight mb-3"
            style={{
              fontSize: "clamp(1.5rem,3.8vw,2.1rem)",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            Oops — the app{" "}
            <span className="gradient-text-err">threw an error.</span>
          </h2>

          <p
            className="fade-up-2 text-[14px] leading-relaxed mb-5"
            style={{ color: "var(--text-muted)" }}
          >
            An unexpected error crashed this part of the app. This is on us, not
            you. Try repairing — it often fixes things. If it keeps happening,
            head home.
          </p>

          {/* Error pill */}
          <div
            className="fade-up-2 flex items-start gap-2.5 px-3.5 py-3 rounded-xl mb-5"
            style={{
              background: "rgba(248,113,113,0.08)",
              border: "1px solid rgba(248,113,113,0.18)",
            }}
          >
            <svg
              className="w-4 h-4 mt-0.5 shrink-0"
              fill="none"
              viewBox="0 0 24 24"
              stroke="#f87171"
              strokeWidth={2}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 9v4m0 4h.01M10.29 3.86L1.82 18a2 2 0 001.71 3h16.94a2 2 0 001.71-3L13.71 3.86a2 2 0 00-3.42 0z"
              />
            </svg>
            <div className="min-w-0">
              <p
                className="text-[11px] font-bold font-mono mb-0.5"
                style={{ color: "var(--danger)" }}
              >
                {errorName}
              </p>
              <p
                className="text-[12px] font-mono leading-relaxed break-all"
                style={{ color: "var(--text-secondary)" }}
              >
                {truncateMessage(errorMessage)}
              </p>
              {digest && (
                <p
                  className="text-[10px] mt-1.5 font-mono"
                  style={{ color: "var(--text-dim)" }}
                >
                  digest:{" "}
                  <span
                    className="px-1.5 py-0.5 rounded"
                    style={{
                      background: "var(--bg-input)",
                      color: "var(--text-muted)",
                    }}
                  >
                    {digest}
                  </span>
                </p>
              )}
            </div>
          </div>

          {/* Terminal log */}
          <div
            className="fade-up-3 rounded-xl mb-6 overflow-hidden"
            style={{
              border: `1px solid ${repairing ? "rgba(52,211,153,0.25)" : "var(--border-subtle)"}`,
              background: "var(--bg-muted)",
              transition: "border-color .3s ease",
            }}
          >
            {/* Chrome */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{
                background: "var(--bg-input)",
                borderBottom: `1px solid ${repairing ? "rgba(52,211,153,0.2)" : "var(--border-subtle)"}`,
                transition: "border-color .3s ease",
              }}
            >
              <div className="flex gap-1.5">
                {["#ef4444", "#f59e0b", "#22c55e"].map((c) => (
                  <div
                    key={c}
                    className="w-2.5 h-2.5 rounded-full"
                    style={{ background: c, opacity: 0.8 }}
                  />
                ))}
              </div>
              <span
                className="text-[10px] font-mono ml-1 truncate"
                style={{ color: "var(--text-dim)" }}
              >
                {repairing
                  ? "paperspace — repair-sequence.log"
                  : "paperspace — crash-report.log"}
              </span>
              {repairing && (
                <div
                  className="spin-repair ml-auto shrink-0"
                  style={{
                    width: 10,
                    height: 10,
                    border: "2px solid rgba(52,211,153,0.25)",
                    borderTop: "2px solid var(--success)",
                    borderRadius: "50%",
                  }}
                />
              )}
            </div>

            {/* Rows */}
            <div
              className="p-3 font-mono space-y-1.5"
              style={{ minHeight: 168, fontSize: 11 }}
            >
              {activeLogs.map((row, i) => {
                const s = STATUS_META[row.status];
                return (
                  <div
                    key={`${repairing}-${i}`}
                    className="log-in flex items-center gap-2.5 flex-wrap"
                    style={{ animationDelay: `${i * 0.03}s` }}
                  >
                    <span style={{ color: "var(--text-dim)", flexShrink: 0 }}>
                      {row.time}
                    </span>
                    <span
                      className="px-1.5 py-0.5 rounded text-[9px] font-black shrink-0"
                      style={{ background: s.bg, color: s.color }}
                    >
                      {s.label}
                    </span>
                    <span
                      style={{
                        color:
                          row.status === "err"
                            ? "var(--danger)"
                            : row.status === "warn"
                              ? "var(--warning)"
                              : repairing
                                ? "var(--success)"
                                : "var(--text-secondary)",
                      }}
                    >
                      {row.event}
                    </span>
                  </div>
                );
              })}
              {!logsDone && (
                <div
                  className="flex items-center gap-1.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  <span>
                    {repairing ? `repairing${dots}` : `analysing${dots}`}
                  </span>
                  <span className="blink" style={{ marginLeft: 1 }}>
                    █
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* CTAs */}
          <div className="flex flex-wrap gap-2.5">
            {/* Primary: Repair */}
            <button
              onClick={handleRepair}
              disabled={repairing}
              className="btn-hover inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold disabled:opacity-70 disabled:cursor-not-allowed disabled:translate-y-0"
              style={{
                background: repairing
                  ? "rgba(52,211,153,0.15)"
                  : "rgba(251,146,60,0.18)",
                border: `1px solid ${repairing ? "rgba(52,211,153,0.3)" : "rgba(251,146,60,0.28)"}`,
                color: repairing ? "var(--success)" : "#fb923c",
                transition: "all .2s ease",
                cursor: repairing ? "default" : "pointer",
              }}
            >
              {repairing ? (
                <>
                  <div
                    className="spin-repair shrink-0"
                    style={{
                      width: 12,
                      height: 12,
                      border: "2px solid rgba(52,211,153,0.25)",
                      borderTop: "2px solid var(--success)",
                      borderRadius: "50%",
                    }}
                  />
                  Repairing…
                </>
              ) : (
                <>🔧 Try to repair</>
              )}
            </button>

            <Link
              href="/home"
              className="btn-hover inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
              style={{
                background: "var(--text)",
                color: "var(--bg)",
                boxShadow: "0 4px 20px rgba(0,0,0,0.15)",
              }}
            >
              🏠 Go home
            </Link>

            <button
              onClick={() => window.history.back()}
              className="btn-hover inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-medium"
              style={{
                background: "var(--bg-card)",
                border: "1px solid var(--border-subtle)",
                color: "var(--text-muted)",
                cursor: "pointer",
              }}
            >
              ← Go back
            </button>
          </div>

          {/* Fine print */}
          <p
            className="text-[11px] mt-4 leading-relaxed"
            style={{ color: "var(--text-dim)" }}
          >
            This error has been logged automatically.{" "}
            {digest && (
              <>
                Reference:{" "}
                <span
                  className="font-mono px-1.5 py-0.5 rounded"
                  style={{
                    background: "var(--bg-input)",
                    color: "var(--text-muted)",
                  }}
                >
                  {digest}
                </span>{" "}
              </>
            )}
            {/* If it keeps happening,{" "}
            <a
              href="mailto:support@paperspace.app"
              style={{ color: "var(--accent-light)", textDecoration: "none" }}
            >
              contact support.
            </a> */}
          </p>
        </div>
      </main>

      {/* ─── Footer ──────────────────────────────────────────────── */}
      <footer
        className="relative z-10 text-center py-4 text-[11px]"
        style={{
          color: "var(--text-dim)",
          borderTop: "1px solid var(--border-subtle)",
          background: "var(--bg-sidebar)",
        }}
      >
        © {new Date().getFullYear()} Paperspace ·{" "}
        <Link href="/home" style={{ color: "var(--accent-light)" }}>
          Return to the homepage
        </Link>
        .
      </footer>
    </div>
  );
}
