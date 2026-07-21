import { supabase } from "@/integrations/supabase/client";

export type Product = { id: string; name: string; category: string };
export type PriceReport = {
  id: string;
  product_id: string;
  store_name: string;
  city: string;
  price: number;
  reported_by: string | null;
  still_accurate_count: number;
  created_at: string;
};

/** Get the latest price report per product id. */
export async function getLatestPrices(productIds: string[]) {
  if (productIds.length === 0) return new Map<string, PriceReport>();
  const { data } = await supabase
    .from("price_reports")
    .select("*")
    .in("product_id", productIds)
    .order("created_at", { ascending: false });
  const map = new Map<string, PriceReport>();
  for (const r of (data ?? []) as PriceReport[]) {
    if (!map.has(r.product_id)) map.set(r.product_id, r);
  }
  return map;
}

export async function getOrCreateDefaultList(userId: string) {
  const { data: existing } = await supabase
    .from("shopping_lists")
    .select("id, name")
    .eq("user_id", userId)
    .order("created_at", { ascending: true })
    .limit(1);
  if (existing && existing.length > 0) return existing[0];
  const { data: created, error } = await supabase
    .from("shopping_lists")
    .insert({ user_id: userId, name: "My Shopping List" })
    .select("id, name")
    .single();
  if (error) throw error;
  return created;
}

export function formatPKR(n: number) {
  return "Rs. " + Math.round(n).toLocaleString("en-PK");
}
