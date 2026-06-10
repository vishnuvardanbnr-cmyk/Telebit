import { useEffect, useRef } from "react";
import { ClerkProvider, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { Switch, Route, useLocation, Router as WouterRouter, Redirect } from "wouter";
import { QueryClient, QueryClientProvider, useQueryClient } from "@tanstack/react-query";
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
import ShopSignInPage from "./pages/sign-in";
import { Layout } from "./components/layout";

const queryClient = new QueryClient();

const clerkPubKey = publishableKeyFromHost(
  window.location.hostname,
  import.meta.env.VITE_CLERK_PUBLISHABLE_KEY,
);
const clerkProxyUrl = import.meta.env.VITE_CLERK_PROXY_URL;
const basePath = import.meta.env.BASE_URL.replace(/\/$/, "");

function stripBase(path: string): string {
  return basePath && path.startsWith(basePath)
    ? path.slice(basePath.length) || "/"
    : path;
}

if (!clerkPubKey) throw new Error("Missing VITE_CLERK_PUBLISHABLE_KEY");

function ProtectedRoute({ component: Component }: { component: React.ComponentType }) {
  return (
    <>
      <Show when="signed-in">
        <Component />
      </Show>
      <Show when="signed-out">
        <Redirect to="/sign-in" />
      </Show>
    </>
  );
}

function ClerkQueryClientCacheInvalidator() {
  const { addListener } = useClerk();
  const queryClient = useQueryClient();
  const prevUserIdRef = useRef<string | null | undefined>(undefined);

  useEffect(() => {
    const unsubscribe = addListener(({ user }) => {
      const userId = user?.id ?? null;
      if (
        prevUserIdRef.current !== undefined &&
        prevUserIdRef.current !== userId
      ) {
        queryClient.clear();
      }
      prevUserIdRef.current = userId;
    });
    return unsubscribe;
  }, [addListener, queryClient]);

  return null;
}

function AppRoutes() {
  return (
    <Switch>
      <Route path="/sign-in/*?" component={ShopSignInPage} />
      <Route path="/sign-up/*?" component={ShopSignInPage} />
      <Route path="/">
        <Redirect to="/products" />
      </Route>
      <Route path="/products">
        <Layout>
          <Products />
        </Layout>
      </Route>
      <Route path="/products/:id">
        <Layout>
          <ProductDetail />
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
      <Route component={NotFound} />
    </Switch>
  );
}

function ClerkProviderWithRoutes() {
  const [, setLocation] = useLocation();

  return (
    <ClerkProvider
      publishableKey={clerkPubKey}
      proxyUrl={clerkProxyUrl}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-in`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <Toaster position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <div className="text-foreground bg-background min-h-[100dvh]">
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </div>
  );
}

export default App;
