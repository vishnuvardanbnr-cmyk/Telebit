import { useEffect, useRef } from "react";
import { ClerkProvider, SignIn, SignUp, Show, useClerk } from "@clerk/react";
import { publishableKeyFromHost } from "@clerk/react/internal";
import { dark } from "@clerk/themes";
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

const clerkAppearance = {
  baseTheme: dark,
  cssLayerName: "clerk",
  options: {
    logoPlacement: "inside" as const,
    logoLinkUrl: basePath || "/",
    logoImageUrl: `${window.location.origin}${basePath}/logo.svg`,
  },
  variables: {
    colorPrimary: "hsl(199 89% 48%)", // Electric blue
    colorBackground: "hsl(222 47% 4%)", // Very dark navy
    colorInput: "hsl(217 32% 17%)",
    colorInputForeground: "hsl(210 40% 98%)",
    colorForeground: "hsl(210 40% 98%)",
    colorMutedForeground: "hsl(215 20.2% 65.1%)",
    colorNeutral: "hsl(217 32% 17%)", // borders
    colorDanger: "hsl(0 62.8% 30.6%)",
    fontFamily: "Inter, sans-serif",
    borderRadius: "0rem", // sharp edges
  },
  elements: {
    rootBox: "w-full flex justify-center",
    cardBox: "bg-background rounded-none w-[440px] max-w-full overflow-hidden border border-border",
    card: "!shadow-none !border-0 !bg-transparent !rounded-none",
    footer: "!shadow-none !border-0 !bg-transparent !rounded-none",
    headerTitle: "text-foreground font-mono uppercase tracking-wider font-bold",
    headerSubtitle: "text-muted-foreground",
    socialButtonsBlockButtonText: "text-foreground font-mono uppercase text-xs tracking-wider",
    formFieldLabel: "text-foreground font-mono uppercase text-xs tracking-wider",
    footerActionLink: "text-primary font-mono uppercase text-xs tracking-wider",
    footerActionText: "text-muted-foreground font-mono uppercase text-xs tracking-wider",
    dividerText: "text-muted-foreground font-mono uppercase text-xs tracking-wider",
    identityPreviewEditButton: "text-primary",
    formFieldSuccessText: "text-green-500",
    alertText: "text-foreground",
    logoBox: "",
    logoImage: "w-12 h-12 object-contain",
    socialButtonsBlockButton: "border border-border bg-card rounded-none",
    formButtonPrimary: "bg-primary text-primary-foreground font-mono uppercase tracking-wider text-sm hover:opacity-90 rounded-none shadow-none",
    formFieldInput: "bg-input border-border text-input-foreground rounded-none shadow-none focus:ring-1 focus:ring-ring font-mono text-sm",
    footerAction: "",
    dividerLine: "bg-border",
    alert: "bg-card border-border",
    otpCodeFieldInput: "bg-input border-border text-input-foreground rounded-none",
    formFieldRow: "",
    main: "",
  },
};

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

function SignInPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignIn
        routing="path"
        path={`${basePath}/sign-in`}
        signUpUrl={`${basePath}/sign-up`}
        afterSignInUrl={`${basePath}/`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </div>
  );
}

function SignUpPage() {
  return (
    <div className="flex min-h-[100dvh] items-center justify-center bg-background px-4">
      <SignUp
        routing="path"
        path={`${basePath}/sign-up`}
        signInUrl={`${basePath}/sign-in`}
        afterSignUpUrl={`${basePath}/`}
        fallbackRedirectUrl={`${basePath}/`}
      />
    </div>
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
      <Route path="/sign-in/*?" component={SignInPage} />
      <Route path="/sign-up/*?" component={SignUpPage} />
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
      appearance={clerkAppearance}
      signInUrl={`${basePath}/sign-in`}
      signUpUrl={`${basePath}/sign-up`}
      routerPush={(to) => setLocation(stripBase(to))}
      routerReplace={(to) => setLocation(stripBase(to), { replace: true })}
    >
      <QueryClientProvider client={queryClient}>
        <ClerkQueryClientCacheInvalidator />
        <TooltipProvider>
          <AppRoutes />
          <Toaster theme="dark" position="bottom-right" />
        </TooltipProvider>
      </QueryClientProvider>
    </ClerkProvider>
  );
}

function App() {
  return (
    <div className="dark text-foreground bg-background min-h-[100dvh]">
      <WouterRouter base={basePath}>
        <ClerkProviderWithRoutes />
      </WouterRouter>
    </div>
  );
}

export default App;
