import { Navbar } from "@/components/Navbar";

export default function MainLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="flex min-h-screen" style={{ background: "var(--bg)" }}>
      <div
        className="fixed inset-0 pointer-events-none z-0"
        style={{
          backgroundImage:
            "linear-gradient(var(--grid-line) 1px, transparent 1px), linear-gradient(90deg, var(--grid-line) 1px, transparent 1px)",
          backgroundSize: "64px 64px",
        }}
      />
      <div
        className="fixed top-[-20%] right-[-10%] w-[500px] h-[500px] rounded-full pointer-events-none z-0"
        style={{
          background:
            "radial-gradient(circle, var(--ambient-glow) 0%, transparent 70%)",
        }}
      />

      <Navbar />
      <main className="relative z-10 flex-1 flex flex-col min-w-0 pb-20 md:pb-0">
        {children}
      </main>
    </div>
  );
}

