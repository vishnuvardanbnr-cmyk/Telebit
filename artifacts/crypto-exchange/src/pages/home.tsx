import { Link } from "wouter";
import { ArrowRight, ShieldCheck, Zap, BarChart3 } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function Home() {
  return (
    <div className="min-h-screen bg-background text-foreground flex flex-col">
      <header className="flex items-center justify-between px-6 py-4 border-b border-border bg-card">
        <div className="flex items-center gap-2 font-mono font-bold uppercase tracking-widest text-primary text-xl">
          <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" className="h-8 w-8">
            <path d="M12 22s8-4 8-10V5l-8-3-8 3v7c0 6 8 10 8 10z" />
            <path d="M8 11h8" />
            <path d="M12 7v8" />
          </svg>
          CryptoVault
        </div>
        <div className="flex gap-3">
          <Button className="font-mono uppercase tracking-widest rounded-md text-sm px-4" asChild>
            <Link href="/sign-in">Sign In</Link>
          </Button>
        </div>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-6 text-center max-w-5xl mx-auto w-full">
        <div className="space-y-8 animate-in fade-in slide-in-from-bottom-8 duration-1000">
          <h1 className="text-5xl md:text-7xl font-bold font-mono tracking-tighter uppercase text-foreground leading-tight">
            Institutional-Grade <br />
            <span className="text-primary">USDT Settlement</span>
          </h1>
          <p className="text-xl text-muted-foreground font-mono max-w-2xl mx-auto">
            A precision-engineered platform for managing BEP-20 USDT operations. Secure deposits, automated withdrawals, and instantaneous P2P transfers.
          </p>
          <div className="pt-8">
            <Button size="lg" className="font-semibold text-base px-8 h-12 rounded-md" asChild>
              <Link href="/sign-in" className="flex items-center gap-2">
                Get Started <ArrowRight className="w-5 h-5" />
              </Link>
            </Button>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-8 mt-24 w-full">
          <div className="border border-border bg-card p-8 text-left group hover:border-primary transition-colors">
            <ShieldCheck className="w-12 h-12 text-primary mb-6" />
            <h3 className="font-mono uppercase tracking-widest text-lg font-bold mb-3">Isolated Wallets</h3>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              Every user receives a dedicated BSC deposit address. Assets are securely swept to cold storage using automated institutional-grade protocols.
            </p>
          </div>
          <div className="border border-border bg-card p-8 text-left group hover:border-primary transition-colors">
            <Zap className="w-12 h-12 text-primary mb-6" />
            <h3 className="font-mono uppercase tracking-widest text-lg font-bold mb-3">Zero-Latency P2P</h3>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              Transfer funds instantly between platform users with zero gas fees. Settled directly on our internal ledger for maximum efficiency.
            </p>
          </div>
          <div className="border border-border bg-card p-8 text-left group hover:border-primary transition-colors">
            <BarChart3 className="w-12 h-12 text-primary mb-6" />
            <h3 className="font-mono uppercase tracking-widest text-lg font-bold mb-3">Real-Time Auditing</h3>
            <p className="text-muted-foreground font-mono text-sm leading-relaxed">
              Track every transaction with cryptographic certainty. Exportable histories, fee calculation transparency, and deterministic settlement.
            </p>
          </div>
        </div>
      </main>

      <footer className="border-t border-border py-8 text-center text-muted-foreground font-mono text-xs uppercase tracking-widest bg-card mt-auto">
        <p>&copy; {new Date().getFullYear()} CryptoVault Exchange. BSC Network Operations.</p>
      </footer>
    </div>
  );
}