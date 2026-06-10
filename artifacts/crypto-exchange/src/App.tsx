import { useEffect } from "react";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { TooltipProvider } from "@/components/ui/tooltip";
import NotFound from "@/pages/not-found";

import Home from "./pages/home";
import Dashboard from "./pages/dashboard";
import Deposit from "./pages/deposit";
import Withdraw from "./pages/withdraw";
import P2P from "./pages/p2p";
import History from "./pages/history";
import Admin from "./pages/admin";
import Services from "./pages/services";
import SignInPage from "./pages/sign-in";
import NftBuy from "./pages/nft-buy";
import NftPools from "./pages/nft-pools";
import NftHoldings from "./pages/nft-holdings";
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

function HomeRedirect() {
  const { isLoading, isSignedIn } = useAuth();
  if (isLoading) return null;
  return isSignedIn ? <Redirect to="/dashboard" /> : <Home />;
}

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

function AppWithAuth() {
  return (
    <QueryClientProvider client={queryClient}>
      <AuthProvider>
        <ScrollToTop />
        <TooltipProvider>
          <Switch>
            <Route path="/" component={HomeRedirect} />
            <Route path="/sign-in/*?" component={SignInPage} />
            <Route path="/sign-up/*?" component={SignInPage} />
            <Route path="/dashboard"><ProtectedRoute component={Dashboard} /></Route>
            <Route path="/deposit"><ProtectedRoute component={Deposit} /></Route>
            <Route path="/withdraw"><ProtectedRoute component={Withdraw} /></Route>
            <Route path="/p2p"><ProtectedRoute component={P2P} /></Route>
            <Route path="/history"><ProtectedRoute component={History} /></Route>
            <Route path="/admin"><ProtectedRoute component={Admin} /></Route>
            <Route path="/services"><ProtectedRoute component={Services} /></Route>
            <Route path="/nft/buy"><ProtectedRoute component={NftBuy} /></Route>
            <Route path="/nft/pools"><ProtectedRoute component={NftPools} /></Route>
            <Route path="/nft/holdings"><ProtectedRoute component={NftHoldings} /></Route>
            <Route component={NotFound} />
          </Switch>
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
