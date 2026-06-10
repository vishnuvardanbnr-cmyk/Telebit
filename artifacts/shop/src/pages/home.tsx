import { Link } from "wouter";
import { useGetMe, useListOrders, useGetCart } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtUsdt } from "@/lib/utils";
import {
  User, Wallet, ShoppingBag, Package, Heart, Trophy,
  ArrowLeftRight, Zap, ChevronRight, Copy, ShoppingCart,
} from "lucide-react";
import { toast } from "sonner";
import { useAuth } from "@/lib/auth-context";

const ORDER_STATUS_COLOR: Record<string, string> = {
  pending: "text-amber-600 bg-amber-50 border-amber-200",
  processing: "text-blue-600 bg-blue-50 border-blue-200",
  shipped: "text-purple-600 bg-purple-50 border-purple-200",
  delivered: "text-green-600 bg-green-50 border-green-200",
  cancelled: "text-red-600 bg-red-50 border-red-200",
};

export default function Home() {
  const { user: authUser } = useAuth();
  const { data: user, isLoading: userLoading } = useGetMe();
  const { data: orders, isLoading: ordersLoading } = useListOrders();
  const { data: cart } = useGetCart();

  const recentOrders = orders?.slice(0, 3) ?? [];
  const cartCount = cart?.itemCount ?? 0;

  if (userLoading) {
    return (
      <div className="container mx-auto px-4 py-6 space-y-4 max-w-2xl">
        {[1, 2, 3].map((i) => <Skeleton key={i} className="h-28 w-full rounded-lg" />)}
      </div>
    );
  }

  return (
    <div className="container mx-auto px-4 py-6 space-y-5 max-w-2xl">

      {/* ── User Profile ── */}
      <Card className="border-primary/30 bg-gradient-to-r from-primary/5 to-transparent">
        <CardContent className="p-5">
          <div className="flex items-start justify-between gap-4">
            <div className="flex items-center gap-3">
              <div className="w-12 h-12 rounded-full bg-primary/10 border border-primary/20 flex items-center justify-center shrink-0">
                <User className="h-6 w-6 text-primary" />
              </div>
              <div>
                <div className="font-bold text-lg leading-tight">
                  {user?.fullName || user?.email?.split("@")[0] || "User"}
                </div>
                <div className="text-xs text-muted-foreground mt-0.5">{user?.email}</div>
                {user?.referralCode && (
                  <button
                    className="flex items-center gap-1 mt-1.5 text-[11px] text-primary font-medium hover:underline"
                    onClick={() => { navigator.clipboard.writeText(user.referralCode); toast.success("Referral code copied"); }}
                  >
                    Ref: {user.referralCode} <Copy className="h-2.5 w-2.5" />
                  </button>
                )}
              </div>
            </div>
            <div className="text-right shrink-0">
              <div className="text-[10px] text-muted-foreground uppercase mb-0.5">Balance</div>
              <div className="font-black text-2xl text-primary leading-tight">{fmtUsdt(user?.walletBalance)}</div>
              <div className="text-[11px] text-muted-foreground">USDT</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* ── Quick Nav Grid ── */}
      <div className="grid grid-cols-3 gap-2">
        {[
          { label: "Products", href: "/products", icon: ShoppingBag, color: "text-blue-500", bg: "bg-blue-50 border-blue-100" },
          { label: "Orders", href: "/orders", icon: Package, color: "text-green-500", bg: "bg-green-50 border-green-100" },
          { label: "Cart", href: "/cart", icon: ShoppingCart, color: "text-orange-500", bg: "bg-orange-50 border-orange-100", badge: cartCount > 0 ? cartCount : undefined },
          { label: "Wishlist", href: "/wishlist", icon: Heart, color: "text-red-500", bg: "bg-red-50 border-red-100" },
          { label: "Wallet", href: "/wallet", icon: Wallet, color: "text-purple-500", bg: "bg-purple-50 border-purple-100" },
          { label: "Lottery", href: "/lottery", icon: Trophy, color: "text-yellow-500", bg: "bg-yellow-50 border-yellow-100" },
        ].map((item) => (
          <Link key={item.href} href={item.href}>
            <div className={`border rounded-xl p-3 flex flex-col items-center gap-1.5 cursor-pointer hover:shadow-sm transition-shadow relative ${item.bg}`}>
              {item.badge !== undefined && (
                <span className="absolute top-2 right-2 bg-primary text-primary-foreground text-[9px] font-bold w-4 h-4 rounded-full flex items-center justify-center">
                  {item.badge > 9 ? "9+" : item.badge}
                </span>
              )}
              <item.icon className={`h-5 w-5 ${item.color}`} />
              <span className="text-[11px] font-semibold text-center">{item.label}</span>
            </div>
          </Link>
        ))}
      </div>

      {/* ── Wallet summary ── */}
      <Card>
        <CardContent className="p-4 flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full bg-purple-50 border border-purple-100 flex items-center justify-center">
              <Wallet className="h-4.5 w-4.5 text-purple-500" />
            </div>
            <div>
              <div className="text-[11px] text-muted-foreground uppercase font-medium">USDT Wallet Balance</div>
              <div className="font-black text-xl text-foreground">{fmtUsdt(user?.walletBalance)} <span className="text-sm font-normal text-muted-foreground">USDT</span></div>
            </div>
          </div>
          <Link href="/wallet">
            <Button variant="outline" size="sm" className="rounded-full text-xs gap-1 shrink-0">
              Manage <ChevronRight className="h-3 w-3" />
            </Button>
          </Link>
        </CardContent>
      </Card>

      {/* ── Recent Orders ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <div className="flex items-center justify-between">
            <CardTitle className="text-sm font-semibold flex items-center gap-2">
              <Package className="h-4 w-4 text-green-500" />
              Recent Orders
            </CardTitle>
            <Link href="/orders">
              <Button variant="ghost" size="sm" className="text-xs h-7 gap-0.5 text-primary">
                All Orders <ChevronRight className="h-3 w-3" />
              </Button>
            </Link>
          </div>
        </CardHeader>
        <CardContent className="px-4 pb-4">
          {ordersLoading ? (
            <div className="space-y-2">
              {[1, 2].map((i) => <Skeleton key={i} className="h-14 w-full rounded-lg" />)}
            </div>
          ) : recentOrders.length === 0 ? (
            <div className="text-center py-6">
              <Package className="h-8 w-8 text-muted-foreground/30 mx-auto mb-2" />
              <p className="text-xs text-muted-foreground">No orders yet</p>
              <Link href="/products">
                <Button variant="outline" size="sm" className="rounded-full text-xs mt-3">Browse Products</Button>
              </Link>
            </div>
          ) : (
            <div className="space-y-2">
              {recentOrders.map((order) => (
                <Link key={order.id} href={`/orders/${order.id}`}>
                  <div className="flex items-center justify-between border rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer">
                    <div>
                      <div className="text-xs font-semibold truncate max-w-[160px]">Order #{order.id.slice(0, 8)}</div>
                      <div className="text-[11px] text-muted-foreground">{order.items?.length ?? 0} item{(order.items?.length ?? 0) !== 1 ? "s" : ""}</div>
                    </div>
                    <div className="flex items-center gap-2">
                      <span className={`text-[10px] font-semibold px-2 py-0.5 border rounded-full uppercase ${ORDER_STATUS_COLOR[order.status] ?? "text-muted-foreground bg-muted/30 border-border"}`}>
                        {order.status}
                      </span>
                      <span className="font-bold text-sm text-primary">{fmtUsdt(order.totalUsdt)}</span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>

      {/* ── Services quick access ── */}
      <Card>
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold flex items-center gap-2">
            <Zap className="h-4 w-4 text-yellow-500" />
            More Services
          </CardTitle>
        </CardHeader>
        <CardContent className="px-4 pb-4 space-y-2">
          {[
            { label: "P2P Transfer", desc: "Send USDT to other users", href: "/p2p", icon: ArrowLeftRight, color: "text-blue-500" },
            { label: "Services", desc: "Top-ups, gift cards & more", href: "/services", icon: Zap, color: "text-yellow-500" },
            { label: "Lottery", desc: "Try your luck and win", href: "/lottery", icon: Trophy, color: "text-amber-500" },
          ].map((s) => (
            <Link key={s.href} href={s.href}>
              <div className="flex items-center justify-between border rounded-lg px-3 py-2.5 hover:bg-muted/30 transition-colors cursor-pointer">
                <div className="flex items-center gap-3">
                  <s.icon className={`h-4.5 w-4.5 ${s.color} shrink-0`} />
                  <div>
                    <div className="text-xs font-semibold">{s.label}</div>
                    <div className="text-[11px] text-muted-foreground">{s.desc}</div>
                  </div>
                </div>
                <ChevronRight className="h-4 w-4 text-muted-foreground" />
              </div>
            </Link>
          ))}
        </CardContent>
      </Card>

    </div>
  );
}
