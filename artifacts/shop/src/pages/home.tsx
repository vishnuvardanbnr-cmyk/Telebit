import { Link } from "wouter";
import {
  useGetMe,
  useGetDashboard,
} from "@workspace/api-client-react";
import { Card, CardContent } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import {
  Wallet, ShoppingBag, ChevronRight,
  Trophy, ArrowLeftRight, Copy, TrendingUp,
} from "lucide-react";
import { toast } from "sonner";
import { UserProfileCard } from "@/components/user-profile-card";

export default function Home() {
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: dashboard } = useGetDashboard();

  if (userLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">
        {[1, 2, 3, 4].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl">

      {/* ── User Profile ── */}
      {user && (
        <UserProfileCard user={user}>
          <div className="mt-4 flex items-center gap-2 bg-muted/30 border border-border rounded-lg px-3 py-2">
            <Wallet className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
            <span className="font-mono text-[11px] text-muted-foreground flex-1 truncate">{user?.depositAddress}</span>
            <button onClick={() => { navigator.clipboard.writeText(user?.depositAddress || ""); toast.success("Address copied"); }}>
              <Copy className="h-3.5 w-3.5 text-muted-foreground hover:text-foreground transition-colors" />
            </button>
          </div>
        </UserProfileCard>
      )}

      {/* ── Stats row ── */}
      <div className="grid grid-cols-2 gap-3">
        {[
          { label: "Total Deposited", val: fmtUsdt(dashboard?.totalDeposited), color: "text-green-600" },
          { label: "Total Withdrawn", val: fmtUsdt(dashboard?.totalWithdrawn), color: "text-red-500" },
        ].map((s) => (
          <Card key={s.label}>
            <CardContent className="p-3">
              <div className="text-[10px] text-muted-foreground uppercase tracking-wide">{s.label}</div>
              <div className={`font-black text-xl mt-1 ${s.color}`}>{s.val}</div>
              <div className="text-[10px] text-muted-foreground">USDT</div>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* ── Quick Access ── */}
      <div className="grid grid-cols-2 gap-3">
        <Link href="/packages">
          <div className="group flex flex-col items-center justify-center gap-2.5 bg-white border border-border hover:border-green-300 hover:shadow-md rounded-2xl p-4 transition-all cursor-pointer h-full">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-green-400 to-emerald-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <TrendingUp className="h-5 w-5 text-white" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">Packages</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Earn daily ROI</p>
            </div>
          </div>
        </Link>
        <Link href="/lottery">
          <div className="group flex flex-col items-center justify-center gap-2.5 bg-white border border-border hover:border-yellow-300 hover:shadow-md rounded-2xl p-4 transition-all cursor-pointer h-full">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-yellow-400 to-orange-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <Trophy className="h-5 w-5 text-white" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">Lottery</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Win big prizes</p>
            </div>
          </div>
        </Link>
        <Link href="/p2p">
          <div className="group flex flex-col items-center justify-center gap-2.5 bg-white border border-border hover:border-blue-300 hover:shadow-md rounded-2xl p-4 transition-all cursor-pointer h-full">
            <div className="w-11 h-11 rounded-xl bg-gradient-to-br from-blue-400 to-indigo-500 flex items-center justify-center shadow-sm group-hover:scale-105 transition-transform">
              <ArrowLeftRight className="h-5 w-5 text-white" />
            </div>
            <div className="text-center">
              <p className="font-bold text-sm">P2P Transfer</p>
              <p className="text-[11px] text-muted-foreground mt-0.5">Send to users</p>
            </div>
          </div>
        </Link>
      </div>

      {/* ── Go to Shop ── */}
      <Link href="/products">
        <div className="border border-border rounded-xl p-4 flex items-center justify-between cursor-pointer hover:bg-muted/30 transition-colors group">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-primary/10 flex items-center justify-center">
              <ShoppingBag className="h-4 w-4 text-primary" />
            </div>
            <div>
              <div className="font-semibold text-sm">Shop Products</div>
              <div className="text-[11px] text-muted-foreground">Browse the catalog</div>
            </div>
          </div>
          <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:translate-x-0.5 transition-transform" />
        </div>
      </Link>

    </div>
  );
}
