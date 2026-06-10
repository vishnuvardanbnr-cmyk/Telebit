import { useLocation } from "wouter";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { 
  useGetCart, 
  useGetMe,
  useCreateOrder 
} from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useQueryClient } from "@tanstack/react-query";
import { ShieldCheck } from "lucide-react";
import { fmtUsdt } from "@/lib/utils";
import { useToast } from "@/hooks/use-toast";

const shippingSchema = z.object({
  fullName: z.string().min(1, "Full name is required"),
  addressLine1: z.string().min(1, "Address is required"),
  addressLine2: z.string().optional(),
  city: z.string().min(1, "City is required"),
  state: z.string().optional(),
  postalCode: z.string().optional(),
  country: z.string().min(1, "Country is required"),
  phone: z.string().optional()
});

type ShippingFormValues = z.infer<typeof shippingSchema>;

export default function Checkout() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  const { data: cart } = useGetCart();
  const { data: user } = useGetMe();

  const form = useForm<ShippingFormValues>({
    resolver: zodResolver(shippingSchema),
    defaultValues: {
      fullName: user?.fullName || "",
      addressLine1: "",
      addressLine2: "",
      city: "",
      state: "",
      postalCode: "",
      country: "",
      phone: ""
    }
  });

  const createOrder = useCreateOrder({
    mutation: {
      onSuccess: (order) => {
        toast({
          title: "Order Placed Successfully",
          description: "Your order has been confirmed.",
        });
        queryClient.invalidateQueries({ queryKey: ["/api/cart"] });
        queryClient.invalidateQueries({ queryKey: ["/api/users/me"] });
        setLocation(`/orders/${order.id}`);
      },
      onError: (err: any) => {
        toast({
          title: "Order Failed",
          description: err.message || "Failed to place order. Check your balance.",
          variant: "destructive"
        });
      }
    }
  });

  const onSubmit = (data: ShippingFormValues) => {
    createOrder.mutate({ data: { shippingAddress: data } });
  };

  if (!cart || cart.items.length === 0) {
    setLocation("/cart");
    return null;
  }

  const balance = Number(user?.walletBalance || "0");
  const subtotal = Number(cart.subtotal);
  const canAfford = balance >= subtotal;

  return (
    <div className="container mx-auto px-4 md:px-8 py-8 max-w-6xl">
      <h1 className="text-3xl font-black uppercase tracking-wider mb-8">Checkout</h1>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-12">
        <div>
          <h2 className="text-xl font-bold uppercase tracking-wider mb-6 pb-2 border-b border-border">Shipping Address</h2>
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-4">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Full Name</FormLabel>
                    <FormControl>
                      <Input placeholder="John Doe" className="rounded-none bg-card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine1"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address Line 1</FormLabel>
                    <FormControl>
                      <Input placeholder="123 Main St" className="rounded-none bg-card" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="addressLine2"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Address Line 2 (Optional)</FormLabel>
                    <FormControl>
                      <Input placeholder="Apt 4B" className="rounded-none bg-card" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="city"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">City</FormLabel>
                      <FormControl>
                        <Input placeholder="New York" className="rounded-none bg-card" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="state"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">State/Province</FormLabel>
                      <FormControl>
                        <Input placeholder="NY" className="rounded-none bg-card" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={form.control}
                  name="postalCode"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Postal Code</FormLabel>
                      <FormControl>
                        <Input placeholder="10001" className="rounded-none bg-card" {...field} value={field.value || ""} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />

                <FormField
                  control={form.control}
                  name="country"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Country</FormLabel>
                      <FormControl>
                        <Input placeholder="United States" className="rounded-none bg-card" {...field} />
                      </FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
              
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider text-muted-foreground">Phone Number</FormLabel>
                    <FormControl>
                      <Input placeholder="+1 555 123 4567" className="rounded-none bg-card" {...field} value={field.value || ""} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="pt-8">
                <Button 
                  type="submit" 
                  className="w-full rounded-none h-14 font-bold uppercase tracking-wider text-lg"
                  disabled={!canAfford || createOrder.isPending}
                >
                  <ShieldCheck className="mr-2 h-5 w-5" />
                  {createOrder.isPending ? "Processing..." : `Pay ${fmtUsdt(cart.subtotal)} USDT`}
                </Button>
              </div>
            </form>
          </Form>
        </div>

        <div>
          <div className="bg-card border border-border p-6 sticky top-24">
            <h2 className="text-lg font-bold uppercase tracking-wider mb-6 border-b border-border pb-4">Order Summary</h2>
            
            <div className="space-y-4 mb-6 border-b border-border pb-6">
              {cart.items.map(item => (
                <div key={item.id} className="flex justify-between items-start text-sm">
                  <div>
                    <div className="font-bold">{item.product.name}</div>
                    <div className="text-muted-foreground text-xs">Qty: {item.quantity} × {fmtUsdt(item.priceUsdt)} USDT</div>
                  </div>
                  <div className="font-mono">{fmtUsdt(Number(item.priceUsdt) * item.quantity)} USDT</div>
                </div>
              ))}
            </div>

            <div className="space-y-3 text-sm mb-6 border-b border-border pb-6">
              <div className="flex justify-between">
                <span className="text-muted-foreground uppercase tracking-wider">Subtotal</span>
                <span className="font-mono">{fmtUsdt(cart.subtotal)} USDT</span>
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground uppercase tracking-wider">Shipping</span>
                <span className="font-mono text-green-500">Free</span>
              </div>
            </div>
            
            <div className="flex justify-between items-center mb-8">
              <span className="font-bold uppercase tracking-wider">Total</span>
              <span className="text-2xl font-black text-primary">{fmtUsdt(cart.subtotal)} <span className="text-sm">USDT</span></span>
            </div>

            <div className="bg-muted/30 p-4 border border-border/50">
              <div className="flex items-center gap-2 mb-2">
                <ShieldCheck className="h-4 w-4 text-primary" />
                <span className="uppercase tracking-wider text-xs font-bold">Payment Method</span>
              </div>
              <div className="flex justify-between items-center text-sm">
                <span className="text-muted-foreground">USDT Wallet Balance</span>
                <span className={`font-mono font-bold ${!canAfford ? 'text-destructive' : ''}`}>
                  {fmtUsdt(user?.walletBalance)} USDT
                </span>
              </div>
              {!canAfford && (
                <div className="text-destructive text-xs uppercase tracking-wider mt-2 font-bold">
                  Insufficient balance. Deposit USDT to continue.
                </div>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
