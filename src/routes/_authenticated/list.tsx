import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { formatPKR, getLatestPrices, getOrCreateDefaultList } from "@/lib/data";
import { toast } from "sonner";
import { Trash2, Plus, ShoppingCart } from "lucide-react";
import { useState } from "react";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";

export const Route = createFileRoute("/_authenticated/list")({
  component: ListPage,
});

type Row = {
  id: string;
  quantity: number;
  product_id: string;
  products: { id: string; name: string; category: string } | null;
};

function ListPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [pickerOpen, setPickerOpen] = useState(false);

  const { data } = useQuery({
    queryKey: ["list", user.id],
    queryFn: async () => {
      const list = await getOrCreateDefaultList(user.id);
      const [{ data: items }, { data: profile }, { data: allProducts }] = await Promise.all([
        supabase
          .from("shopping_list_items")
          .select("id, quantity, product_id, products(id, name, category)")
          .eq("list_id", list.id)
          .order("created_at"),
        supabase.from("profiles").select("monthly_budget").eq("id", user.id).maybeSingle(),
        supabase.from("products").select("id, name, category").order("name"),
      ]);
      const rows = (items ?? []) as Row[];
      const prices = await getLatestPrices(rows.map((r) => r.product_id));
      return {
        list,
        rows,
        prices,
        budget: Number(profile?.monthly_budget ?? 0),
        products: allProducts ?? [],
      };
    },
  });

  const addItem = useMutation({
    mutationFn: async (productId: string) => {
      if (!data?.list) return;
      const existing = data.rows.find((r) => r.product_id === productId);
      if (existing) {
        await supabase
          .from("shopping_list_items")
          .update({ quantity: Number(existing.quantity) + 1 })
          .eq("id", existing.id);
      } else {
        await supabase
          .from("shopping_list_items")
          .insert({ list_id: data.list.id, product_id: productId, quantity: 1 });
      }
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["list", user.id] });
      setPickerOpen(false);
    },
  });

  const updateQty = useMutation({
    mutationFn: async ({ id, qty }: { id: string; qty: number }) => {
      await supabase.from("shopping_list_items").update({ quantity: qty }).eq("id", id);
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["list", user.id] }),
  });

  const removeItem = useMutation({
    mutationFn: async (id: string) => {
      await supabase.from("shopping_list_items").delete().eq("id", id);
    },
    onSuccess: () => {
      toast.success("Removed");
      qc.invalidateQueries({ queryKey: ["list", user.id] });
    },
  });

  const total =
    data?.rows.reduce((acc, r) => {
      const p = data.prices.get(r.product_id);
      return acc + (p ? Number(p.price) * Number(r.quantity) : 0);
    }, 0) ?? 0;
  const budget = data?.budget ?? 0;
  const over = budget > 0 && total > budget;

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">Shopping List</h1>
          <p className="text-muted-foreground">Estimated using the most recent reported prices.</p>
        </div>
        <Popover open={pickerOpen} onOpenChange={setPickerOpen}>
          <PopoverTrigger asChild>
            <Button>
              <Plus className="size-4" /> Add product
            </Button>
          </PopoverTrigger>
          <PopoverContent className="w-80 p-0" align="end">
            <Command>
              <CommandInput placeholder="Search products..." />
              <CommandList>
                <CommandEmpty>No products found.</CommandEmpty>
                <CommandGroup>
                  {data?.products.map((p) => (
                    <CommandItem key={p.id} value={p.name} onSelect={() => addItem.mutate(p.id)}>
                      {p.name}
                      <span className="ml-auto text-xs text-muted-foreground">{p.category}</span>
                    </CommandItem>
                  ))}
                </CommandGroup>
              </CommandList>
            </Command>
          </PopoverContent>
        </Popover>
      </div>

      <Card className={over ? "border-destructive/50" : "border-success/50"}>
        <CardContent className="p-6 flex flex-wrap items-center justify-between gap-4">
          <div>
            <p className="text-sm text-muted-foreground">Estimated total</p>
            <p className="text-3xl font-bold">{formatPKR(total)}</p>
          </div>
          <div className="text-right">
            <p className="text-sm text-muted-foreground">Monthly budget</p>
            <p className="text-lg font-medium">{formatPKR(budget)}</p>
            <p className={`text-sm font-medium mt-1 ${over ? "text-destructive" : "text-success"}`}>
              {budget === 0
                ? "Set a budget on Budget page"
                : over
                  ? `${formatPKR(total - budget)} over budget`
                  : `${formatPKR(budget - total)} remaining`}
            </p>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base flex items-center gap-2">
            <ShoppingCart className="size-4" /> Items
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.rows.length === 0 && (
            <p className="p-8 text-center text-muted-foreground">
              Your list is empty. Add products to start planning.
            </p>
          )}
          <ul className="divide-y divide-border">
            {data?.rows.map((r) => {
              const price = data.prices.get(r.product_id);
              const line = price ? Number(price.price) * Number(r.quantity) : 0;
              return (
                <li key={r.id} className="p-4 flex items-center gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="font-medium truncate">{r.products?.name}</div>
                    <div className="text-xs text-muted-foreground">
                      {price
                        ? `${formatPKR(Number(price.price))} · ${price.store_name}, ${price.city}`
                        : "No price data — report one!"}
                    </div>
                  </div>
                  <Input
                    type="number"
                    min="1"
                    step="1"
                    value={Number(r.quantity)}
                    onChange={(e) => updateQty.mutate({ id: r.id, qty: Number(e.target.value) })}
                    className="w-20"
                  />
                  <div className="w-24 text-right font-semibold">{formatPKR(line)}</div>
                  <Button size="icon" variant="ghost" onClick={() => removeItem.mutate(r.id)}>
                    <Trash2 className="size-4" />
                  </Button>
                </li>
              );
            })}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}
