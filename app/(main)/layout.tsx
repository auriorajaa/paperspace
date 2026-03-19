import { Navbar } from "@/components/Navbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen" style={{ background: "#0a0a0c" }}>
      {/* Subtle grid overlay — same as landing page */}
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(rgba(255,255,255,0.025) 1px, transparent 1px), linear-gradient(90deg, rgba(255,255,255,0.025) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      {/* Ambient glow */}
      <div
        className="fixed top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle, rgba(99,102,241,0.06) 0%, transparent 70%)",
        }}
      />

      <Navbar />
      <main className="relative z-10 flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}
