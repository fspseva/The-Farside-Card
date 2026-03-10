import Link from "next/link";

export default function Home() {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen gap-8">
      <h1 className="text-4xl font-bold tracking-tight">Stealth Crypto Card</h1>
      <p className="text-gray-500 text-lg">
        Privacy-preserving crypto card powered by stealth addresses
      </p>
      <div className="flex gap-4">
        <Link
          href="/card"
          className="px-6 py-3 bg-slate-700 hover:bg-slate-600 border border-slate-600/50 shadow-[0_0_15px_rgba(100,100,100,0.1)] rounded-lg font-medium transition"
        >
          Card App
        </Link>
        <Link
          href="/pos"
          className="px-6 py-3 bg-zinc-700 hover:bg-zinc-600 border border-zinc-600/50 shadow-[0_0_15px_rgba(100,100,100,0.1)] rounded-lg font-medium transition"
        >
          POS Terminal
        </Link>
      </div>
      <p className="absolute bottom-6 text-xs text-white/30">
        powered by{" "}
        <a href="https://haven.hn" target="_blank" rel="noopener noreferrer" className="underline hover:text-white/50 transition">
          haven.hn
        </a>
      </p>
    </div>
  );
}
