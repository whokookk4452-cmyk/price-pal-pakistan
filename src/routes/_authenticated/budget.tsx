import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Progress } from "@/components/ui/progress";
import { formatPKR, getLatestPrices, getOrCreateDefaultList } from "@/lib/data";
import { useEffect, useState } from "react";
import { toast } from "sonner";

export const Route = createFileRoute("/_authenticated/budget")({
  component: BudgetPage,
});

function BudgetPage() {
  const { user } = Route.useRouteContext();
  const qc = useQueryClient();
  const [budget, setBudget] = useState("");

  const { data } = useQuery({
    queryKey: ["budget", user.id],
    queryFn: async () => {
      const [{ data: profile }, list] = await Promise.all([
        supabase.from("profiles").select("monthly_budget").eq("id", user.id).maybeSingle(),
        getOrCreateDefaultList(user.id),
      ]);
      const { data: items } = await supabase
        .from("shopping_list_items")
        .select("quantity, product_id")
        .eq("list_id", list.id);
      const rows = items ?? [];
      const prices = await getLatestPrices(rows.map((r) => r.product_id));
      const total = rows.reduce((acc, r) => {
        const p = prices.get(r.product_id);
        return acc + (p ? Number(p.price) * Number(r.quantity) : 0);
      }, 0);
      return { budget: Number(profile?.monthly_budget ?? 0), total };
    },
  });

  useEffect(() => {
    if (data?.budget !== undefined) setBudget(String(data.budget));
  }, [data?.budget]);

  const save = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("profiles")
        .update({ monthly_budget: Number(budget) })
        .eq("id", user.id);
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Budget updated");
      qc.invalidateQueries();
    },
    onError: (e: Error) => toast.error(e.message),
  });

  const pct = data && data.budget > 0 ? Math.min(100, (data.total / data.budget) * 100) : 0;
  const over = data ? data.total > data.budget && data.budget > 0 : false;

  return (
    <div className="p-4 md:p-8 max-w-3xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Budget Planner</h1>
        <p className="text-muted-foreground">Set your monthly grocery budget and see how your list stacks up.</p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>Monthly budget (PKR)</CardTitle>
        </CardHeader>
        <CardContent>
          <form
            className="flex gap-2 max-w-sm"
            onSubmit={(e) => {
              e.preventDefault();
              save.mutate();
            }}
          >
            <div className="flex-1 space-y-2">
              <Label htmlFor="b">Amount</Label>
              <Input id="b" type="number" min="0" step="500" value={budget} onChange={(e) => setBudget(e.target.value)} />
            </div>
            <Button type="submit" className="self-end" disabled={save.isPending}>
              {save.isPending ? "Saving…" : "Save"}
            </Button>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>This month vs. your list</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="grid grid-cols-2 gap-4">
            <div>
              <p className="text-sm text-muted-foreground">Budget</p>
              <p className="text-2xl font-bold">{formatPKR(data?.budget ?? 0)}</p>
            </div>
            <div>
              <p className="text-sm text-muted-foreground">List estimate</p>
              <p className="text-2xl font-bold">{formatPKR(data?.total ?? 0)}</p>
            </div>
          </div>
          <Progress value={pct} className={over ? "[&>*]:bg-destructive" : ""} />
          <p className={`text-sm font-medium ${over ? "text-destructive" : "text-success"}`}>
            {data && data.budget > 0
              ? over
                ? `You're ${formatPKR(data.total - data.budget)} over budget.`
                : `You have ${formatPKR(data.budget - data.total)} remaining.`
              : "Set a budget above to see your status."}
          </p>
        </CardContent>
      </Card>
    </div>
  );
}
