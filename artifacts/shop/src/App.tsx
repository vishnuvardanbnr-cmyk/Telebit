import { useEffect } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Products from "./pages/products";
import ProductDetail from "./pages/product-detail";
import Cart from "./pages/cart";
import Checkout from "./pages/checkout";
import Orders from "./pages/orders";
import OrderDetail from "./pages/order-detail";
import Wishlist from "./pages/wishlist";
import Admin from "./pages/admin";
import Services from "./pages/services";
import Wallet from "./pages/wallet";
import Lottery from "./pages/lottery";
import LotteryDetail from "./pages/lottery-detail";
import P2P from "./pages/p2p";
import ShopSignInPage from "./pages/sign-in";
import Home from "./pages/home";
import NftBuy from "./pages/nft-buy";
import NftPools from "./pages/nft-pools";
import NftHoldings from "./pages/nft-holdings";
import { Layout } from "./components/layout";
import { AuthProvider, useAuth } from "./lib/auth-context";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error: any) => {
        if (error?.status >= 400 && error?.status < 500) return false;
        return failureCount < 2;
      },
    },
  },
});

const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  const { isLoading, isSignedIn } = useAuth();
  if (isLoading) return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="w-6 h-6 border-2 border-primary border-t-transparent rounded-full animate-spin" />
    </div>
  );
  if (!isSignedIn) return <Redirect to="/sign-in" />;
  return <Component />;
}

function ScrollToTop() {
  const [location] = useLocation();
  useEffect(() => { window.scrollTo(0, 0); }, [location]);
  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={ShopSignInPage} />
      <Route path="/sign-up/*?" component={ShopSignInPage} />
      <Route path="/">
        <Layout>
          <ProtectedRoute component={Home} />
        </Layout>
      </Route>
      <Route path="/products">
        <Layout>
          <ProtectedRoute component={Products} />
        </Layout>
      </Route>
      <Route path="/products/:id">
        <Layout>
          <ProtectedRoute component={ProductDetail} />
        </Layout>
      </Route>
      <Route path="/cart">
        <Layout>
          <ProtectedRoute component={Cart} />
        </Layout>
      </Route>
      <Route path="/checkout">
        <Layout>
          <ProtectedRoute component={Checkout} />
        </Layout>
      </Route>
      <Route path="/orders">
        <Layout>
          <ProtectedRoute component={Orders} />
        </Layout>
      </Route>
      <Route path="/orders/:id">
        <Layout>
          <ProtectedRoute component={OrderDetail} />
        </Layout>
      </Route>
      <Route path="/wishlist">
        <Layout>
          <ProtectedRoute component={Wishlist} />
        </Layout>
      </Route>
      <Route path="/admin">
        <Layout>
          <ProtectedRoute component={Admin} />
        </Layout>
      </Route>
      <Route path="/services">
        <Layout>
          <ProtectedRoute component={Services} />
        </Layout>
      </Route>
      <Route path="/wallet">
        <Layout>
          <ProtectedRoute component={Wallet} />
        </Layout>
      </Route>
      <Route path="/lottery">
        <Layout>
          <ProtectedRoute component={Lottery} />
        </Layout>
      </Route>
      <Route path="/lottery/:id">
        <Layout>
          <ProtectedRoute component={LotteryDetail} />
        </Layout>
      </Route>
      <Route path="/p2p">
        <Layout>
          <ProtectedRoute component={P2P} />
        </Layout>
      </Route>
      <Route path="/nft/buy">
        <Layout>
          <ProtectedRoute component={NftBuy} />
        </Layout>
      </Route>
      <Route path="/nft/pools">
        <Layout>
          <ProtectedRoute component={NftPools} />
        </Layout>
      </Route>
      <Route path="/nft/holdings">
        <Layout>
          <ProtectedRoute component={NftHoldings} />
        </Layout>
      </Route>
      <Route component={NotFound} />
    </Switch>
  );
}

function AppWithAuth() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ScrollToTop />
        <TooltipProvider>
          <AppRoutes />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </AuthProvider>
    </QueryClientProvider>
  );
}

function App() {
  return (
    <div className="text-foreground bg-background min-h-[100dvh]">
      <WouterRouter base={basePath}>
        <AppWithAuth />
      </WouterRouter>
    </div>
  );
}

export default App;
