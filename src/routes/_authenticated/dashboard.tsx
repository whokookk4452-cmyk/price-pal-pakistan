import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Clock, Sparkles, ShoppingCart, Store, TrendingDown, Wallet } from "lucide-react";
import { formatPKR, getLatestPrices, getOrCreateDefaultList } from "@/lib/data";

export const Route = createFileRoute("/_authenticated/dashboard")({
  component: Dashboard,
  head: () => ({
    title: "Dashboard | SastaBazaar",
    meta: [
      {
        name: "description",
        content: "View your grocery budget, shopping list estimate, and recent price reports from across Pakistan.",
      },
      { property: "og:title", content: "Dashboard | SastaBazaar" },
      {
        property: "og:description",
        content: "View your grocery budget, shopping list estimate, and recent price reports from across Pakistan.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
});

function Dashboard() {
  const { user } = Route.useRouteContext();

  const { data } = useQuery({
    queryKey: ["dashboard", user.id],
    queryFn: async () => {
      const [{ data: profile }, list, { data: recentReports }] = await Promise.all([
        supabase.from("profiles").select("name, monthly_budget").eq("id", user.id).maybeSingle(),
        getOrCreateDefaultList(user.id),
        supabase
          .from("price_reports")
          .select("id, price, store_name, city, created_at, products(name)")
          .order("created_at", { ascending: false })
          .limit(5),
      ]);
      const { data: items } = await supabase
        .from("shopping_list_items")
        .select("quantity, products(id, name)")
        .eq("list_id", list.id);
      type Item = { quantity: number; products: { id: string; name: string } | null };
      const rows = (items ?? []) as Item[];
      type RecentReport = {
        id: string;
        price: number;
        store_name: string;
        city: string;
        created_at: string;
        products: { name: string } | null;
      };
      const reports = (recentReports ?? []) as RecentReport[];
      const productIds = rows.map((i) => i.products?.id).filter(Boolean) as string[];
      const prices = await getLatestPrices(productIds);
      const total = rows.reduce((acc, i) => {
        const p = i.products ? prices.get(i.products.id) : undefined;
        return acc + (p ? Number(p.price) * Number(i.quantity) : 0);
      }, 0);
      const budget = Number(profile?.monthly_budget ?? 0);
      return {
        name: profile?.name ?? "",
        budget,
        total,
        itemCount: rows.length,
        listId: list.id,
        recentReports: reports,
      };
    },
  });

  const pct = data && data.budget > 0 ? Math.min(100, (data.total / data.budget) * 100) : 0;
  const over = data ? data.total > data.budget && data.budget > 0 : false;

  return (
    <div className="p-4 md:p-8 max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">
          Assalam-o-Alaikum{data?.name ? `, ${data.name}` : ""} 👋
        </h1>
        <p className="text-muted-foreground">Here's your grocery snapshot for the month.</p>
      </div>

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Monthly Budget</CardTitle>
            <Wallet className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? formatPKR(data.budget) : "—"}</div>
            <Link to="/budget" className="text-xs text-primary hover:underline">
              Edit budget
            </Link>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">List Estimate</CardTitle>
            <ShoppingCart className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold">{data ? formatPKR(data.total) : "—"}</div>
            <p className="text-xs text-muted-foreground">{data?.itemCount ?? 0} items</p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="pb-2 flex-row items-center justify-between space-y-0">
            <CardTitle className="text-sm font-medium text-muted-foreground">Status</CardTitle>
            <TrendingDown className="size-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className={`text-2xl font-bold ${over ? "text-destructive" : "text-success"}`}>
              {over ? "Over budget" : "On track"}
            </div>
            <p className="text-xs text-muted-foreground">
              {data && data.budget > 0
                ? over
                  ? `${formatPKR(data.total - data.budget)} over`
                  : `${formatPKR(data.budget - data.total)} left`
                : "Set a budget"}
            </p>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Budget usage</CardTitle>
        </CardHeader>
        <CardContent>
          <Progress value={pct} className={over ? "[&>*]:bg-destructive" : ""} />
          <p className="text-xs text-muted-foreground mt-2">{Math.round(pct)}% used</p>
        </CardContent>
      </Card>

      <Card className="bg-gradient-to-br from-primary/10 via-accent/40 to-background border-primary/20">
        <CardContent className="p-6 flex flex-col md:flex-row items-start md:items-center justify-between gap-4">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <Sparkles className="size-5 text-primary" />
              <h3 className="font-semibold text-lg">Ask the AI Shopping Assistant</h3>
            </div>
            <p className="text-sm text-muted-foreground max-w-lg">
              Get smart, budget-friendly recommendations using real prices reported by shoppers across Pakistan.
            </p>
          </div>
          <Button asChild size="lg">
            <Link to="/assistant">Chat now</Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <Clock className="size-5 text-primary" />
            <CardTitle className="text-base">Recent Price Reports</CardTitle>
          </div>
          <p className="text-sm text-muted-foreground">Latest prices submitted by shoppers across Pakistan.</p>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {data?.recentReports && data.recentReports.length > 0 ? (
              data.recentReports.map((report) => (
                <div
                  key={report.id}
                  className="flex items-center justify-between gap-4 p-3 rounded-lg border border-border bg-background/50 hover:bg-accent/30 transition-colors"
                >
                  <div className="min-w-0 flex-1">
                    <div className="font-medium truncate">
                      {report.products?.name ?? "Unknown product"}
                    </div>
                    <div className="flex items-center gap-1 text-sm text-muted-foreground">
                      <Store className="size-3.5" />
                      <span className="truncate">
                        {report.store_name} • {report.city}
                      </span>
                    </div>
                  </div>
                  <div className="text-right shrink-0">
                    <div className="font-semibold text-success">{formatPKR(Number(report.price))}</div>
                    <div className="text-xs text-muted-foreground">
                      {new Date(report.created_at).toLocaleDateString("en-PK", {
                        day: "numeric",
                        month: "short",
                      })}
                    </div>
                  </div>
                </div>
              ))
            ) : (
              <p className="text-sm text-muted-foreground">No price reports yet.</p>
            )}
          </div>
        </CardContent>
      </Card>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Quick actions</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-wrap gap-2">
            <Button variant="secondary" asChild>
              <Link to="/products">Browse products</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/list">Edit shopping list</Link>
            </Button>
            <Button variant="secondary" asChild>
              <Link to="/budget">Set budget</Link>
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
