import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useMemo, useState } from "react";
import { formatPKR, getLatestPrices } from "@/lib/data";
import { Search } from "lucide-react";

export const Route = createFileRoute("/_authenticated/products")({
  component: ProductsPage,
});

function ProductsPage() {
  const [q, setQ] = useState("");
  const [cat, setCat] = useState<string>("All");

  const { data } = useQuery({
    queryKey: ["products-with-prices"],
    queryFn: async () => {
      const { data: products } = await supabase.from("products").select("*").order("name");
      const ids = (products ?? []).map((p) => p.id);
      const prices = await getLatestPrices(ids);
      return { products: products ?? [], prices };
    },
  });

  const categories = useMemo(() => {
    const s = new Set<string>();
    (data?.products ?? []).forEach((p) => s.add(p.category));
    return ["All", ...Array.from(s).sort()];
  }, [data]);

  const filtered = (data?.products ?? []).filter(
    (p) =>
      (cat === "All" || p.category === cat) && p.name.toLowerCase().includes(q.toLowerCase()),
  );

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Products</h1>
        <p className="text-muted-foreground">Search grocery items and see the latest reported prices.</p>
      </div>

      <div className="flex flex-col sm:flex-row gap-3">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            placeholder="Search rice, oil, milk..."
            value={q}
            onChange={(e) => setQ(e.target.value)}
            className="pl-9"
          />
        </div>
        <div className="flex gap-2 overflow-x-auto pb-1">
          {categories.map((c) => (
            <button
              key={c}
              onClick={() => setCat(c)}
              className={`px-3 py-1.5 text-sm rounded-full border whitespace-nowrap transition-colors ${
                cat === c ? "bg-primary text-primary-foreground border-primary" : "bg-card hover:bg-accent"
              }`}
            >
              {c}
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-3 sm:grid-cols-2">
        {filtered.map((p) => {
          const latest = data?.prices.get(p.id);
          return (
            <Link key={p.id} to="/products/$id" params={{ id: p.id }}>
              <Card className="hover:border-primary transition-colors cursor-pointer">
                <CardContent className="p-4 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <div className="font-medium truncate">{p.name}</div>
                    <Badge variant="secondary" className="mt-1">
                      {p.category}
                    </Badge>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="text-lg font-bold text-primary">
                      {latest ? formatPKR(Number(latest.price)) : "—"}
                    </div>
                    <div className="text-xs text-muted-foreground">
                      {latest ? `${latest.store_name}, ${latest.city}` : "No price yet"}
                    </div>
                  </div>
                </CardContent>
              </Card>
            </Link>
          );
        })}
        {filtered.length === 0 && (
          <p className="text-muted-foreground col-span-full text-center py-12">No products match.</p>
        )}
      </div>
    </div>
  );
}
