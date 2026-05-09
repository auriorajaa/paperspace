"use client";

import { useState, useEffect } from "react";
import Link from "next/link";

const AUDIT_LOGS = [
  { time: "00:00:01", event: "Page requested by client", status: "ok" },
  { time: "00:00:02", event: "Route resolver initialised", status: "ok" },
  { time: "00:00:03", event: "Document index queried", status: "ok" },
  { time: "00:00:04", event: "Cache lookup attempted", status: "warn" },
  {
    time: "00:00:05",
    event: "Cache entry corrupted / missing",
    status: "warn",
  },
  { time: "00:00:06", event: "Fallback search initiated", status: "warn" },
  { time: "00:00:07", event: "Page not found in any index", status: "err" },
  {
    time: "00:00:08",
    event: "Returning 404 — sorry about that",
    status: "err",
  },
] as const;

const STATUS_STYLES: Record<
  string,
  { bg: string; color: string; label: string }
> = {
  ok: { bg: "rgba(52,211,153,0.14)", color: "var(--success)", label: "OK" },
  warn: { bg: "rgba(251,191,36,0.14)", color: "var(--warning)", label: "WARN" },
  err: { bg: "rgba(248,113,113,0.14)", color: "var(--danger)", label: "ERR" },
};

export default function NotFound() {
  const [logIndex, setLogIndex] = useState(0);
  const [dots, setDots] = useState("");
  const [launched, setLaunched] = useState(false);
  const [stampVisible, setStamp] = useState(false);
  const [faceIndex, setFaceIndex] = useState(0);

  const FACES = ["(ᗒᗣᗕ)՞", "¯\\_(ツ)_/¯", "(◞‸◟；)", "( •᷄⌓•᷅ )", "ʕ•̠͡•ʔ"];

  // Rotating sad faces
  useEffect(() => {
    const id = setInterval(
      () => setFaceIndex((i) => (i + 1) % FACES.length),
      2200
    );
    return () => clearInterval(id);
  }, []);

  // Blinking dots for "searching…"
  useEffect(() => {
    const id = setInterval(
      () => setDots((d) => (d.length >= 3 ? "" : d + ".")),
      420
    );
    return () => clearInterval(id);
  }, []);

  // Reveal log rows one-by-one
  useEffect(() => {
    if (logIndex >= AUDIT_LOGS.length) {
      setTimeout(() => setStamp(true), 300);
      return;
    }
    const delay = logIndex === 0 ? 600 : 220 + logIndex * 80;
    const id = setTimeout(() => setLogIndex((i) => i + 1), delay);
    return () => clearTimeout(id);
  }, [logIndex]);

  const handleLaunch = () => {
    if (launched) return;
    setLaunched(true);
    setTimeout(() => setLaunched(false), 2200);
  };

  return (
    <div
      className="min-h-screen flex flex-col"
      style={{ background: "var(--bg)", color: "var(--text)" }}
    >
      {/* ─── Animations ─────────────────────────────────────────── */}
      <style>{`
        @keyframes float-doc {
          0%,100% { transform: translateY(0)   rotate(-2deg); }
          50%      { transform: translateY(-14px) rotate(2deg); }
        }
        @keyframes shimmer {
          0%   { background-position: 200% center; }
          100% { background-position: -200% center; }
        }
        @keyframes fade-up {
          from { opacity: 0; transform: translateY(18px); }
          to   { opacity: 1; transform: translateY(0); }
        }
        @keyframes log-in {
          from { opacity: 0; transform: translateX(-10px); }
          to   { opacity: 1; transform: translateX(0); }
        }
        @keyframes glitch-r {
          0%,100% { clip-path: inset(100% 0 0    0); transform: translate( 0); }
          20%     { clip-path: inset(60%  0 20%  0); transform: translate( 3px,-2px); }
          45%     { clip-path: inset(25%  0 55%  0); transform: translate(-3px, 2px); }
          70%     { clip-path: inset(5%   0 80%  0); transform: translate( 2px, 3px); }
        }
        @keyframes glitch-b {
          0%,100% { clip-path: inset(0 0 100% 0); transform: translate( 0); }
          20%     { clip-path: inset(10% 0 60% 0); transform: translate(-3px, 2px); }
          45%     { clip-path: inset(40% 0 30% 0); transform: translate( 3px,-2px); }
          70%     { clip-path: inset(75% 0  5% 0); transform: translate(-2px, 3px); }
        }
        @keyframes plane-go {
          0%   { transform: translate(0,0)       rotate(0deg);   opacity: 1; }
          60%  { transform: translate(260px,-240px) rotate(40deg);  opacity: 0.6; }
          100% { transform: translate(400px,-360px) rotate(55deg);  opacity: 0; }
        }
        @keyframes plane-back {
          0%   { transform: translate(400px,-360px) rotate(55deg); opacity: 0; }
          40%  { opacity: 0.6; }
          100% { transform: translate(0,0)          rotate(0deg);  opacity: 1; }
        }
        @keyframes stamp-drop {
          0%   { transform: scale(1.6) rotate(-12deg); opacity: 0; }
          60%  { transform: scale(0.9) rotate(-12deg); opacity: 1; }
          80%  { transform: scale(1.05) rotate(-12deg); }
          100% { transform: scale(1)   rotate(-12deg); opacity: 1; }
        }
        @keyframes blink { 0%,100%{opacity:1} 50%{opacity:0} }
        @keyframes face-swap {
          0%,85%   { opacity: 1; transform: translateY(0); }
          90%      { opacity: 0; transform: translateY(-6px); }
          95%      { opacity: 0; transform: translateY(6px); }
          100%     { opacity: 1; transform: translateY(0); }
        }
        .gradient-text {
          background: linear-gradient(135deg, var(--accent-light) 0%, #a78bfa 50%, var(--accent-pale) 100%);
          background-size: 200% auto;
          -webkit-background-clip: text;
          -webkit-text-fill-color: transparent;
          background-clip: text;
          animation: shimmer 4s linear infinite;
        }
        .float-doc   { animation: float-doc 5.5s ease-in-out infinite; }
        .glitch-r    { animation: glitch-r 4.5s steps(1) infinite 0.1s; }
        .glitch-b    { animation: glitch-b 4.5s steps(1) infinite 0.4s; }
        .plane-go    { animation: plane-go  0.9s cubic-bezier(.4,.2,.2,1) forwards; }
        .plane-back  { animation: plane-back 0.9s cubic-bezier(.4,.2,.2,1) forwards; }
        .stamp-drop  { animation: stamp-drop 0.45s cubic-bezier(.3,1.4,.5,1) forwards; }
        .log-in      { animation: log-in 0.25s ease-out both; }
        .fade-up     { animation: fade-up 0.55s ease-out both; }
        .fade-up-1   { animation: fade-up 0.55s ease-out 0.08s both; }
        .fade-up-2   { animation: fade-up 0.55s ease-out 0.18s both; }
        .fade-up-3   { animation: fade-up 0.55s ease-out 0.30s both; }
        .blink       { animation: blink 1s step-end infinite; }
        .face-swap   { animation: face-swap 2.2s ease-in-out infinite; }
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
        <div
          className="absolute top-[-15%] left-[10%] w-[560px] h-[560px] rounded-full"
          style={{ background: "var(--ambient-glow)", filter: "blur(130px)" }}
        />
        <div
          className="absolute bottom-[5%] right-[5%] w-[380px] h-[380px] rounded-full"
          style={{ background: "rgba(139,92,246,0.04)", filter: "blur(110px)" }}
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
        <Link href="/home" className="flex items-center gap-2.5">
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
        {/* ── Left column: Visual ── */}
        <div className="flex flex-col items-center">
          {/* Giant 404 with glitch layers */}
          <div className="relative select-none leading-none mb-4">
            <h1
              className="gradient-text font-black"
              style={{
                fontSize: "clamp(6rem,18vw,13rem)",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
              }}
            >
              404
            </h1>
            {/* Glitch — red channel */}
            <h1
              aria-hidden
              className="glitch-r absolute inset-0 font-black pointer-events-none"
              style={{
                fontSize: "clamp(6rem,18vw,13rem)",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#f472b6",
                opacity: 0.28,
                mixBlendMode: "screen",
              }}
            >
              404
            </h1>
            {/* Glitch — blue channel */}
            <h1
              aria-hidden
              className="glitch-b absolute inset-0 font-black pointer-events-none"
              style={{
                fontSize: "clamp(6rem,18vw,13rem)",
                fontFamily: "'Plus Jakarta Sans',sans-serif",
                letterSpacing: "-0.04em",
                lineHeight: 1,
                color: "#60a5fa",
                opacity: 0.22,
                mixBlendMode: "screen",
              }}
            >
              404
            </h1>
          </div>

          {/* Sad face carousel */}
          <p
            className="face-swap font-mono font-bold mb-8 text-center"
            style={{
              fontSize: "clamp(1rem,3vw,1.4rem)",
              color: "var(--text-muted)",
              minHeight: "2em",
              display: "flex",
              alignItems: "center",
            }}
          >
            {FACES[faceIndex]}
          </p>

          {/* Floating paper document */}
          <div className="relative">
            <button
              onClick={handleLaunch}
              title="Launch it into the void"
              aria-label="Launch paper airplane"
              style={{
                background: "none",
                border: "none",
                cursor: "pointer",
                padding: 0,
                display: "block",
              }}
            >
              <div
                className={launched ? "plane-go" : "float-doc"}
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
                  {/* Ruled lines */}
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
                    y1="50"
                    x2="84"
                    y2="50"
                    stroke="var(--border-subtle)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="20"
                    y1="62"
                    x2="70"
                    y2="62"
                    stroke="var(--border-subtle)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="20"
                    y1="74"
                    x2="76"
                    y2="74"
                    stroke="var(--border-subtle)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  <line
                    x1="20"
                    y1="86"
                    x2="60"
                    y2="86"
                    stroke="var(--border-subtle)"
                    strokeWidth="1.5"
                    strokeLinecap="round"
                  />
                  {/* Doc icon top */}
                  <rect
                    x="20"
                    y="14"
                    width="40"
                    height="14"
                    rx="3"
                    fill="var(--accent-bg)"
                    stroke="var(--accent-border)"
                    strokeWidth="1"
                  />
                  <text
                    x="27"
                    y="25"
                    fontSize="8"
                    fontWeight="700"
                    fontFamily="monospace"
                    fill="var(--accent-light)"
                  >
                    untitled.pdf
                  </text>

                  {/* MISSING stamp */}
                  {stampVisible && (
                    <g
                      className="stamp-drop"
                      style={{ transformOrigin: "52px 70px" }}
                    >
                      <rect
                        x="14"
                        y="92"
                        width="76"
                        height="22"
                        rx="3"
                        fill="none"
                        stroke="var(--danger)"
                        strokeWidth="2.5"
                        opacity="0.85"
                      />
                      <text
                        x="52"
                        y="108"
                        fontSize="12"
                        fontWeight="900"
                        fontFamily="'Plus Jakarta Sans',sans-serif"
                        fill="var(--danger)"
                        textAnchor="middle"
                        letterSpacing="3"
                        opacity="0.85"
                      >
                        MISSING
                      </text>
                    </g>
                  )}
                </svg>
              </div>
            </button>

            {/* Click hint */}
            <p
              className="text-center text-[11px] mt-2"
              style={{ color: "var(--text-dim)" }}
            >
              {launched
                ? "🚀 Into the void it goes…"
                : "👆 Click to send it off"}
            </p>
          </div>
        </div>

        {/* ── Right column: Info + terminal ── */}
        <div className="w-full max-w-[440px]">
          {/* Badge */}
          {/* <div
            className="fade-up inline-flex items-center gap-2 px-3 py-1.5 rounded-full text-[11px] font-semibold mb-4"
            style={{
              background: "var(--danger-bg)",
              border: "1px solid rgba(248,113,113,0.22)",
              color: "var(--danger)",
            }}
          >
            <span className="w-1.5 h-1.5 rounded-full bg-red-400 animate-pulse shrink-0" />
            PAGE_NOT_FOUND · Error 404
          </div> */}

          {/* Headline */}
          <h2
            className="fade-up-1 font-bold leading-tight mb-3"
            style={{
              fontSize: "clamp(1.55rem,4vw,2.2rem)",
              fontFamily: "'Plus Jakarta Sans',sans-serif",
            }}
          >
            This page seems to have{" "}
            <span className="gradient-text">gone missing.</span>
          </h2>

          <p
            className="fade-up-2 text-[14px] leading-relaxed mb-6"
            style={{ color: "var(--text-muted)" }}
          >
            We scoured every folder, every archive, and even the recycle bin.
            The page you request doesn't exist here — it may have been moved, deleted,
            or it never existed at all.
          </p>

          {/* Audit log terminal */}
          <div
            className="fade-up-3 rounded-xl mb-6 overflow-hidden"
            style={{
              border: "1px solid var(--border-subtle)",
              background: "var(--bg-muted)",
            }}
          >
            {/* Terminal chrome */}
            <div
              className="flex items-center gap-2 px-3 py-2"
              style={{
                background: "var(--bg-input)",
                borderBottom: "1px solid var(--border-subtle)",
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
                paperspace — document-audit.log
              </span>
            </div>

            {/* Log rows */}
            <div
              className="p-3 font-mono space-y-1.5"
              style={{ minHeight: 168, fontSize: 11 }}
            >
              {AUDIT_LOGS.slice(0, logIndex).map((row, i) => {
                const s = STATUS_STYLES[row.status];
                return (
                  <div
                    key={i}
                    className="log-in flex items-center gap-2.5 flex-wrap"
                    style={{ animationDelay: `${i * 0.04}s` }}
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
                              : "var(--text-secondary)",
                      }}
                    >
                      {row.event}
                    </span>
                  </div>
                );
              })}
              {logIndex < AUDIT_LOGS.length && (
                <div
                  className="flex items-center gap-1.5"
                  style={{ color: "var(--text-dim)" }}
                >
                  <span>searching{dots}</span>
                  <span className="blink" style={{ marginLeft: 1 }}>
                    █
                  </span>
                </div>
              )}
            </div>
          </div>

          {/* Action buttons */}
          <div className="flex flex-wrap gap-2.5">
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
            <Link
              href="/documents"
              className="btn-hover inline-flex items-center gap-2 px-5 py-2.5 rounded-xl text-[13px] font-semibold"
              style={{
                background: "var(--accent-bg)",
                border: "1px solid var(--accent-border)",
                color: "var(--accent-pale)",
              }}
            >
              📄 My papers
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
            Error code:{" "}
            <span
              className="font-mono px-1.5 py-0.5 rounded"
              style={{
                background: "var(--bg-input)",
                color: "var(--text-muted)",
              }}
            >
              PAGE_NOT_FOUND_404
            </span>{" "}
            {/* · Think this is a bug?{" "}
            <a
              href="mailto:support@paperspace.app"
              style={{ color: "var(--accent-light)", textDecoration: "none" }}
            >
              Let us know.
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
        © {new Date().getFullYear()} Paperspace · Still lost?{" "}
        <Link href="/home" style={{ color: "var(--accent-light)" }}>
          Go back to the homepage
        </Link>
        .
      </footer>
    </div>
  );
}
