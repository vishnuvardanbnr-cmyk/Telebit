import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useGetCart, useGetMe, useCreateOrder } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck, ImageOff } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { toast } from "sonner";

const shippingSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional(),
});
type ShippingFormValues = z.infer<typeof shippingSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const queryClient = useQueryClient();
  const { data: cart } = useGetCart();
  const { data: user } = useGetMe();

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      addressLine1: "", addressLine2: "", city: "", state: "",
      postalCode: "", country: "", phone: "",
    },
  });

  const createOrder = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        toast.success("Order placed successfully!");
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err: any) => {
        toast.error(err.message || "Failed to place order. Check your balance.");
      },
    },
  });

  const onSubmit = (data: ShippingFormValues) => {
    createOrder.mutate({ data: { shippingAddress: data } });
  };

  if (!cart || cart.items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const balance = Number(user?.walletBalance ?? 0);
  const subtotal = Number(cart.subtotal);
  const canAfford = balance >= subtotal;

  const field = (
    name: keyof ShippingFormValues,
    label: string,
    placeholder: string,
    optional = false,
  ) => (
    <FormField
      control={form.control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {label}{optional && <span className="font-normal normal-case tracking-normal ml-1 text-muted-foreground/60">(optional)</span>}
          </FormLabel>
          <FormControl>
            <Input placeholder={placeholder} {...field} value={field.value ?? ""} />
          </FormControl>
          <FormMessage className="text-xs" />
        </FormItem>
      )}
    />
  );

  return (
    <div className="max-w-5xl mx-auto px-4 py-6 space-y-6">
      <div>
        <h1 className="text-xl font-bold tracking-tight">Checkout</h1>
        <p className="text-sm text-muted-foreground mt-0.5">Enter your shipping details to complete the order.</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Shipping form */}
        <div className="space-y-5">
          <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Shipping Address</p>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              {field("fullName", "Full Name", "John Doe")}
              {field("addressLine1", "Address Line 1", "123 Main St")}
              {field("addressLine2", "Address Line 2", "Apt 4B", true)}
              <div className="grid grid-cols-2 gap-4">
                {field("city", "City", "New York")}
                {field("state", "State / Province", "NY", true)}
              </div>
              <div className="grid grid-cols-2 gap-4">
                {field("postalCode", "Postal Code", "10001", true)}
                {field("country", "Country", "United States")}
              </div>
              {field("phone", "Phone", "+1 555 123 4567", true)}

              <Button
                type="submit"
                className="w-full font-semibold h-11 mt-2"
                disabled={!canAfford || createOrder.isPending}
              >
                <ShieldCheck className="mr-2 h-4 w-4" />
                {createOrder.isPending ? "Processing…" : `Pay ${fmtUsdt(cart.subtotal)} USDT`}
              </Button>

              {!canAfford && (
                <p className="text-xs text-destructive text-center font-medium">
                  Insufficient balance — deposit USDT first.
                </p>
              )}
            </form>
          </Form>
        </div>

        {/* Order summary */}
        <div>
          <Card className="rounded-xl shadow-sm sticky top-20">
            <CardHeader className="pb-3 border-b border-border bg-muted/20">
              <div className="flex items-center justify-between">
                <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">Order Summary</p>
                <p className="text-xs text-muted-foreground">{cart.itemCount} items</p>
              </div>
            </CardHeader>
            <CardContent className="pt-4 space-y-4">
              {/* Items */}
              <div className="space-y-3">
                {cart.items.map(item => (
                  <div key={item.id} className="flex items-center gap-3">
                    <div className="w-12 h-12 rounded-lg overflow-hidden bg-muted shrink-0">
                      {item.product.imageUrls?.[0] ? (
                        <img src={item.product.imageUrls[0]} alt={item.product.name} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><ImageOff className="w-4 h-4 text-muted-foreground/30" /></div>
                      )}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-xs font-semibold truncate">{item.product.name}</p>
                      <p className="text-[11px] text-muted-foreground">Qty {item.quantity} × {fmtUsdt(item.priceUsdt)}</p>
                    </div>
                    <p className="text-xs font-semibold font-mono shrink-0">{fmtUsdt(Number(item.priceUsdt) * item.quantity)}</p>
                  </div>
                ))}
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-3 space-y-2 text-sm">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Subtotal</span>
                  <span className="font-mono">{fmtUsdt(cart.subtotal)} USDT</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">Shipping</span>
                  <span className="text-green-600 font-medium">Free</span>
                </div>
                <div className="border-t border-border pt-2 flex justify-between font-semibold">
                  <span>Total</span>
                  <span className="text-primary">{fmtUsdt(cart.subtotal)} USDT</span>
                </div>
              </div>

              {/* Payment method */}
              <div className="rounded-lg bg-muted/40 px-3 py-2.5 space-y-1">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground">
                  <ShieldCheck className="w-3.5 h-3.5" />
                  <span>USDT Wallet Payment</span>
                </div>
                <div className="flex justify-between text-xs">
                  <span className="text-muted-foreground">Balance</span>
                  <span className={`font-mono font-semibold ${!canAfford ? "text-destructive" : ""}`}>
                    {fmtUsdt(user?.walletBalance)} USDT
                  </span>
                </div>
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
