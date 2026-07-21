import { createFileRoute, Link } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { formatPKR, getOrCreateDefaultList, type PriceReport } from "@/lib/data";
import { useState } from "react";
import { toast } from "sonner";
import { ArrowLeft, CheckCircle2, Plus } from "lucide-react";
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from "recharts";
import { format, startOfWeek } from "date-fns";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogFooter,
} from "@/components/ui/dialog";

export const Route = createFileRoute("/_authenticated/products/$id")({
  component: ProductDetail,
});

function ProductDetail() {
  const { id } = Route.useParams();
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [open, setOpen] = useState(false);
  const [store, setStore] = useState("");
  const [city, setCity] = useState("");
  const [price, setPrice] = useState("");

  const { data } = useQuery({
    queryKey: ["product", id],
    queryFn: async () => {
      const [{ data: product }, { data: reports }] = await Promise.all([
        supabase.from("products").select("*").eq("id", id).single(),
        supabase
          .from("price_reports")
          .select("*")
          .eq("product_id", id)
          .order("created_at", { ascending: false }),
      ]);
      return { product, reports: (reports ?? []) as PriceReport[] };
    },
  });

  const addReport = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("price_reports").insert({
        product_id: id,
        store_name: store,
        city,
        price: Number(price),
        reported_by: user.id,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Price reported. Thank you!");
      setOpen(false);
      setStore("");
      setCity("");
      setPrice("");
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const confirm = useMutation({
    mutationFn: async (reportId: string) => {
      const { error } = await supabase.rpc("confirm_price_report", { _report_id: reportId });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Thanks for confirming!");
      qc.invalidateQueries({ queryKey: ["product", id] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const addToList = useMutation({
    mutationFn: async () => {
      const list = await getOrCreateDefaultList(user.id);
      const { error } = await supabase
        .from("shopping_list_items")
        .insert({ list_id: list.id, product_id: id, quantity: 1 });
      if (error) throw error;
    },
    onSuccess: () => toast.success("Added to your shopping list"),
    onError: (e: Error) => toast.error(e.message),
  });

  const chartData = weeklyAverages(data?.reports ?? []);

  return (
    <div className="p-4 md:p-8 max-w-4xl mx-auto space-y-6">
      <Link to="/products" className="inline-flex items-center text-sm text-muted-foreground hover:text-primary">
        <ArrowLeft className="size-4 mr-1" /> Back to products
      </Link>

      <div className="flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold">{data?.product?.name ?? "Loading..."}</h1>
          {data?.product && <Badge variant="secondary" className="mt-2">{data.product.category}</Badge>}
        </div>
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => addToList.mutate()}>
            <Plus className="size-4" /> Add to list
          </Button>
          <Dialog open={open} onOpenChange={setOpen}>
            <DialogTrigger asChild>
              <Button>Report a price</Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>Report a price</DialogTitle>
              </DialogHeader>
              <form
                className="space-y-3"
                onSubmit={(e) => {
                  e.preventDefault();
                  addReport.mutate();
                }}
              >
                <div className="space-y-2">
                  <Label>Store name</Label>
                  <Input required value={store} onChange={(e) => setStore(e.target.value)} placeholder="e.g. Imtiaz, Metro, local kiryana" />
                </div>
                <div className="space-y-2">
                  <Label>City</Label>
                  <Input required value={city} onChange={(e) => setCity(e.target.value)} placeholder="e.g. Karachi" />
                </div>
                <div className="space-y-2">
                  <Label>Price (PKR)</Label>
                  <Input required type="number" min="0" step="1" value={price} onChange={(e) => setPrice(e.target.value)} />
                </div>
                <DialogFooter>
                  <Button type="submit" disabled={addReport.isPending}>
                    {addReport.isPending ? "Saving…" : "Submit"}
                  </Button>
                </DialogFooter>
              </form>
            </DialogContent>
          </Dialog>
        </div>
      </div>

      {chartData.length > 1 && (
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Price trend (weekly average)</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" />
                  <XAxis dataKey="week" stroke="var(--muted-foreground)" fontSize={12} />
                  <YAxis stroke="var(--muted-foreground)" fontSize={12} />
                  <Tooltip formatter={(v: number) => formatPKR(v)} contentStyle={{ background: "var(--card)", border: "1px solid var(--border)" }} />
                  <Line type="monotone" dataKey="avg" stroke="var(--primary)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </div>
          </CardContent>
        </Card>
      )}

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Recent reports</CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {data?.reports.length === 0 && (
            <p className="p-6 text-muted-foreground text-center">
              No prices reported yet. Be the first!
            </p>
          )}
          <ul className="divide-y divide-border">
            {data?.reports.map((r) => (
              <li key={r.id} className="p-4 flex items-center justify-between gap-3">
                <div className="min-w-0">
                  <div className="font-medium">{r.store_name}</div>
                  <div className="text-xs text-muted-foreground">
                    {r.city} · {format(new Date(r.created_at), "d MMM yyyy")}
                  </div>
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <div className="font-bold text-primary">{formatPKR(Number(r.price))}</div>
                    {r.still_accurate_count > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {r.still_accurate_count} confirmed
                      </div>
                    )}
                  </div>
                  <Button size="sm" variant="ghost" onClick={() => confirm.mutate(r.id)}>
                    <CheckCircle2 className="size-4" /> Still accurate
                  </Button>
                </div>
              </li>
            ))}
          </ul>
        </CardContent>
      </Card>
    </div>
  );
}

function weeklyAverages(reports: PriceReport[]) {
  const buckets = new Map<string, { sum: number; n: number; d: Date }>();
  for (const r of reports) {
    const d = startOfWeek(new Date(r.created_at), { weekStartsOn: 1 });
    const key = d.toISOString().slice(0, 10);
    const b = buckets.get(key) ?? { sum: 0, n: 0, d };
    b.sum += Number(r.price);
    b.n += 1;
    buckets.set(key, b);
  }
  return Array.from(buckets.values())
    .sort((a, b) => a.d.getTime() - b.d.getTime())
    .map((b) => ({ week: format(b.d, "d MMM"), avg: Math.round(b.sum / b.n) }));
}
