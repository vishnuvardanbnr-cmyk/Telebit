import { useState } from "react";
import { 
  useAdminGetShopStats, 
  useAdminListProducts, 
  useAdminListOrders,
  useAdminCreateProduct,
  useAdminUpdateProduct,
  useAdminDeleteProduct,
  useAdminUpdateOrderStatus,
  useAdminCreateCategory,
  useListCategories
} from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { useQueryClient } from "@tanstack/react-query";
import { useToast } from "@/hooks/use-toast";
import { Package, DollarSign, ShoppingCart, Tag, Edit, Trash2 } from "lucide-react";

const productSchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().min(1, "Description is required"),
  priceUsdt: z.string().min(1, "Price is required"),
  compareAtPrice: z.string().optional(),
  stock: z.coerce.number().min(0, "Stock cannot be negative"),
  categoryId: z.string().min(1, "Category is required"),
  imageUrls: z.string().transform(str => str.split(',').map(s => s.trim()).filter(Boolean)),
  isActive: z.boolean().default(true),
  isFeatured: z.boolean().default(false)
});

const categorySchema = z.object({
  name: z.string().min(1, "Name is required"),
  slug: z.string().min(1, "Slug is required"),
  description: z.string().optional(),
  imageUrl: z.string().optional()
});

type ProductFormValues = z.infer<typeof productSchema>;

export default function Admin() {
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [isProductDialogOpen, setIsProductDialogOpen] = useState(false);
  const [isCategoryDialogOpen, setIsCategoryDialogOpen] = useState(false);
  const [editingProduct, setEditingProduct] = useState<any>(null);

  const { data: stats } = useAdminGetShopStats();
  const { data: products } = useAdminListProducts({});
  const { data: orders } = useAdminListOrders({});
  const { data: categories } = useListCategories();

  const createCategory = useAdminCreateCategory({
    mutation: {
      onSuccess: () => {
        toast({ title: "Category created" });
        queryClient.invalidateQueries({ queryKey: ["/api/categories"] });
        setIsCategoryDialogOpen(false);
      }
    }
  });

  const categoryForm = useForm<z.infer<typeof categorySchema>>({
    resolver: zodResolver(categorySchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      imageUrl: ""
    }
  });

  const onSubmitCategory = (data: z.infer<typeof categorySchema>) => {
    createCategory.mutate({ data });
  };

  const createProduct = useAdminCreateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Product created" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
        setIsProductDialogOpen(false);
      }
    }
  });

  const updateProduct = useAdminUpdateProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Product updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
        setIsProductDialogOpen(false);
      }
    }
  });

  const deleteProduct = useAdminDeleteProduct({
    mutation: {
      onSuccess: () => {
        toast({ title: "Product deleted" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/products"] });
      }
    }
  });

  const updateOrderStatus = useAdminUpdateOrderStatus({
    mutation: {
      onSuccess: () => {
        toast({ title: "Order status updated" });
        queryClient.invalidateQueries({ queryKey: ["/api/admin/orders"] });
      }
    }
  });

  const productForm = useForm<ProductFormValues>({
    resolver: zodResolver(productSchema),
    defaultValues: {
      name: "",
      slug: "",
      description: "",
      priceUsdt: "",
      compareAtPrice: "",
      stock: 0,
      categoryId: "",
      imageUrls: [],
      isActive: true,
      isFeatured: false
    }
  });

  const openProductDialog = (product?: any) => {
    if (product) {
      setEditingProduct(product);
      productForm.reset({
        name: product.name,
        slug: product.slug,
        description: product.description,
        priceUsdt: product.priceUsdt,
        compareAtPrice: product.compareAtPrice || "",
        stock: product.stock,
        categoryId: product.categoryId,
        imageUrls: product.imageUrls.join(", "),
        isActive: product.isActive,
        isFeatured: product.isFeatured
      });
    } else {
      setEditingProduct(null);
      productForm.reset({
        name: "",
        slug: "",
        description: "",
        priceUsdt: "",
        compareAtPrice: "",
        stock: 0,
        categoryId: "",
        imageUrls: [],
        isActive: true,
        isFeatured: false
      });
    }
    setIsProductDialogOpen(true);
  };

  const onSubmitProduct = (data: ProductFormValues) => {
    // The zod transform converts string to array, but React Hook Form gives us the array format during submit
    // Make sure we pass an array to the API
    const payload = {
      ...data,
      imageUrls: Array.isArray(data.imageUrls) ? data.imageUrls : (data.imageUrls as string).split(',').map(s => s.trim()).filter(Boolean),
      compareAtPrice: data.compareAtPrice || null
    };

    if (editingProduct) {
      updateProduct.mutate({ productId: editingProduct.id, data: payload });
    } else {
      createProduct.mutate({ data: payload });
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'delivered': return 'bg-green-500/10 text-green-500 border-green-500/20';
      case 'shipped': return 'bg-blue-500/10 text-blue-500 border-blue-500/20';
      case 'confirmed': return 'bg-primary/10 text-primary border-primary/20';
      case 'cancelled': return 'bg-destructive/10 text-destructive border-destructive/20';
      default: return 'bg-muted text-muted-foreground border-border';
    }
  };

  return (
    <div className="container mx-auto px-4 md:px-8 py-8">
      <h1 className="text-3xl font-black uppercase tracking-wider mb-8">Shop Administration</h1>

      {/* Stats Overview */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Revenue</CardTitle>
            <DollarSign className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black text-primary font-mono">{stats?.totalRevenue || "0.00"} USDT</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Total Orders</CardTitle>
            <ShoppingCart className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">{stats?.totalOrders || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Pending Orders</CardTitle>
            <Package className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">{stats?.pendingOrders || 0}</div>
          </CardContent>
        </Card>
        <Card className="rounded-none border-border bg-card">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-bold uppercase tracking-wider text-muted-foreground">Products</CardTitle>
            <Tag className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-black font-mono">{stats?.totalProducts || 0}</div>
          </CardContent>
        </Card>
      </div>

      <Tabs defaultValue="products" className="space-y-6">
        <TabsList className="bg-card border border-border rounded-none h-12 w-full justify-start p-0">
          <TabsTrigger value="products" className="rounded-none h-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary uppercase tracking-wider font-bold text-xs">Products</TabsTrigger>
          <TabsTrigger value="categories" className="rounded-none h-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary uppercase tracking-wider font-bold text-xs">Categories</TabsTrigger>
          <TabsTrigger value="orders" className="rounded-none h-full data-[state=active]:bg-primary/10 data-[state=active]:text-primary data-[state=active]:border-b-2 data-[state=active]:border-primary uppercase tracking-wider font-bold text-xs">Orders</TabsTrigger>
        </TabsList>

        <TabsContent value="products" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-wider">Product Catalog</h2>
            <Button onClick={() => openProductDialog()} className="rounded-none font-bold uppercase tracking-wider text-xs">
              Add Product
            </Button>
          </div>

          <div className="bg-card border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Category</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Price</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Stock</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-center">Status</TableHead>
                  <TableHead className="text-right"></TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {products?.map((product) => (
                  <TableRow key={product.id} className="border-border">
                    <TableCell className="font-bold text-sm">{product.name}</TableCell>
                    <TableCell className="text-xs uppercase tracking-widest text-muted-foreground">{product.categoryName}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{product.priceUsdt} USDT</TableCell>
                    <TableCell className="text-right font-mono">{product.stock}</TableCell>
                    <TableCell className="text-center">
                      <Badge variant="outline" className={`rounded-none text-[10px] uppercase tracking-widest ${product.isActive ? 'bg-green-500/10 text-green-500 border-green-500/20' : 'bg-muted text-muted-foreground'}`}>
                        {product.isActive ? 'Active' : 'Draft'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button variant="ghost" size="icon" onClick={() => openProductDialog(product)} className="h-8 w-8 text-muted-foreground hover:text-primary">
                          <Edit className="h-4 w-4" />
                        </Button>
                        <Button variant="ghost" size="icon" onClick={() => deleteProduct.mutate({ productId: product.id })} className="h-8 w-8 text-muted-foreground hover:text-destructive">
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex justify-between items-center">
            <h2 className="text-xl font-bold uppercase tracking-wider">Category Management</h2>
            <Button onClick={() => setIsCategoryDialogOpen(true)} className="rounded-none font-bold uppercase tracking-wider text-xs">
              Add Category
            </Button>
          </div>

          <div className="bg-card border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Name</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Slug</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Products</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {categories?.map((cat) => (
                  <TableRow key={cat.id} className="border-border">
                    <TableCell className="font-bold text-sm">{cat.name}</TableCell>
                    <TableCell className="text-xs uppercase tracking-widest text-muted-foreground">{cat.slug}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{cat.productCount}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <h2 className="text-xl font-bold uppercase tracking-wider">Order Management</h2>
          <div className="bg-card border border-border">
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Order ID</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Date</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Customer</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs text-right">Total</TableHead>
                  <TableHead className="font-bold uppercase tracking-wider text-xs">Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {orders?.map((order) => (
                  <TableRow key={order.id} className="border-border">
                    <TableCell className="font-mono text-sm">{order.id.split('-')[0].toUpperCase()}</TableCell>
                    <TableCell className="text-sm">{new Date(order.createdAt).toLocaleDateString()}</TableCell>
                    <TableCell className="text-sm">{order.shippingAddress.fullName}</TableCell>
                    <TableCell className="text-right font-mono font-bold text-primary">{order.totalUsdt} USDT</TableCell>
                    <TableCell>
                      <Select 
                        defaultValue={order.status}
                        onValueChange={(val: any) => updateOrderStatus.mutate({ orderId: order.id, data: { status: val } })}
                      >
                        <SelectTrigger className={`h-8 rounded-none text-xs font-bold uppercase tracking-wider w-32 ${getStatusColor(order.status)}`}>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent className="rounded-none">
                          <SelectItem value="pending" className="text-xs uppercase tracking-wider font-bold">Pending</SelectItem>
                          <SelectItem value="confirmed" className="text-xs uppercase tracking-wider font-bold">Confirmed</SelectItem>
                          <SelectItem value="shipped" className="text-xs uppercase tracking-wider font-bold">Shipped</SelectItem>
                          <SelectItem value="delivered" className="text-xs uppercase tracking-wider font-bold">Delivered</SelectItem>
                          <SelectItem value="cancelled" className="text-xs uppercase tracking-wider font-bold">Cancelled</SelectItem>
                        </SelectContent>
                      </Select>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </TabsContent>
      </Tabs>

      <Dialog open={isProductDialogOpen} onOpenChange={setIsProductDialogOpen}>
        <DialogContent className="sm:max-w-[600px] rounded-none border-border bg-background max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black">{editingProduct ? 'Edit Product' : 'Add New Product'}</DialogTitle>
          </DialogHeader>
          <Form {...productForm}>
            <form onSubmit={productForm.handleSubmit(onSubmitProduct)} className="space-y-4 pt-4">
              <div className="grid grid-cols-2 gap-4">
                <FormField
                  control={productForm.control}
                  name="name"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider">Product Name</FormLabel>
                      <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="slug"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider">Slug</FormLabel>
                      <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={productForm.control}
                name="categoryId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Category</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger className="rounded-none bg-card">
                          <SelectValue placeholder="Select a category" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent className="rounded-none">
                        {categories?.map(cat => (
                          <SelectItem key={cat.id} value={cat.id}>{cat.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <div className="grid grid-cols-3 gap-4">
                <FormField
                  control={productForm.control}
                  name="priceUsdt"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider">Price (USDT)</FormLabel>
                      <FormControl><Input type="number" step="0.01" className="rounded-none bg-card font-mono" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="compareAtPrice"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider">Compare Price</FormLabel>
                      <FormControl><Input type="number" step="0.01" className="rounded-none bg-card font-mono" {...field} value={field.value || ""} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <FormField
                  control={productForm.control}
                  name="stock"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel className="text-xs font-bold uppercase tracking-wider">Stock</FormLabel>
                      <FormControl><Input type="number" className="rounded-none bg-card font-mono" {...field} /></FormControl>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>

              <FormField
                control={productForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Description</FormLabel>
                    <FormControl><Textarea className="rounded-none bg-card min-h-[100px]" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={productForm.control}
                name="imageUrls"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Image URLs (comma separated)</FormLabel>
                    <FormControl><Input className="rounded-none bg-card font-mono text-xs" {...field} value={Array.isArray(field.value) ? field.value.join(", ") : field.value} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <Button type="submit" disabled={createProduct.isPending || updateProduct.isPending} className="w-full rounded-none font-bold uppercase tracking-wider">
                {editingProduct ? 'Update Product' : 'Create Product'}
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>

      <Dialog open={isCategoryDialogOpen} onOpenChange={setIsCategoryDialogOpen}>
        <DialogContent className="sm:max-w-[500px] rounded-none border-border bg-background">
          <DialogHeader>
            <DialogTitle className="uppercase tracking-wider font-black">Add New Category</DialogTitle>
          </DialogHeader>
          <Form {...categoryForm}>
            <form onSubmit={categoryForm.handleSubmit(onSubmitCategory)} className="space-y-4 pt-4">
              <FormField
                control={categoryForm.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Category Name</FormLabel>
                    <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="slug"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Slug</FormLabel>
                    <FormControl><Input className="rounded-none bg-card" {...field} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="description"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Description</FormLabel>
                    <FormControl><Textarea className="rounded-none bg-card" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={categoryForm.control}
                name="imageUrl"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase tracking-wider">Image URL</FormLabel>
                    <FormControl><Input className="rounded-none bg-card" {...field} value={field.value || ""} /></FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" disabled={createCategory.isPending} className="w-full rounded-none font-bold uppercase tracking-wider">
                Create Category
              </Button>
            </form>
          </Form>
        </DialogContent>
      </Dialog>
    </div>
  );
}
