import { createServerFn } from "@tanstack/react-start";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { z } from "zod";

const SYSTEM_PROMPT = `You are a budget-conscious shopping assistant for users in Pakistan. You receive the user's shopping list, their monthly budget, and recent price data submitted by other users for each product (store name, city, price, date). Recommend the cheapest reliable option per item, note if a price looks outdated (more than 30 days old), estimate the total cost of the list, and tell the user clearly if they are over budget with specific suggestions to cut cost. Respond in simple, friendly English, use PKR for currency, and be concise and practical like a helpful friend rather than a formal analyst.`;

const Input = z.object({ message: z.string().min(1).max(2000) });

type Msg = { role: "system" | "user" | "assistant"; content: string };

export const sendChatMessage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((d: unknown) => Input.parse(d))
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const apiKey = process.env.LOVABLE_API_KEY;
    if (!apiKey) throw new Error("Missing LOVABLE_API_KEY");

    // Gather context: profile, active list + items + prices
    const [{ data: profile }, { data: lists }] = await Promise.all([
      supabase.from("profiles").select("name, monthly_budget").eq("id", userId).maybeSingle(),
      supabase
        .from("shopping_lists")
        .select("id, name, shopping_list_items(quantity, products(id, name, category))")
        .eq("user_id", userId)
        .order("created_at", { ascending: true })
        .limit(1),
    ]);

    const list = lists?.[0];
    type Item = { quantity: number; products: { id: string; name: string; category: string } | null };
    const items: Item[] = (list?.shopping_list_items ?? []) as Item[];
    const productIds = items.map((i) => i.products?.id).filter(Boolean) as string[];

    let recentPrices: Record<
      string,
      { store: string; city: string; price: number; date: string }[]
    > = {};
    if (productIds.length > 0) {
      const { data: reports } = await supabase
        .from("price_reports")
        .select("product_id, store_name, city, price, created_at")
        .in("product_id", productIds)
        .order("created_at", { ascending: false })
        .limit(200);
      for (const r of reports ?? []) {
        const arr = (recentPrices[r.product_id] ||= []);
        if (arr.length < 5)
          arr.push({ store: r.store_name, city: r.city, price: Number(r.price), date: r.created_at });
      }
    }

    const contextBlock = {
      monthly_budget_pkr: Number(profile?.monthly_budget ?? 0),
      shopping_list: items.map((i) => ({
        product: i.products?.name,
        category: i.products?.category,
        quantity: Number(i.quantity),
        recent_prices: i.products ? recentPrices[i.products.id] ?? [] : [],
      })),
    };

    // Load history (last 20 messages)
    const { data: history } = await supabase
      .from("chat_messages")
      .select("role, content")
      .eq("user_id", userId)
      .order("created_at", { ascending: true })
      .limit(40);

    const messages: Msg[] = [
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "system",
        content: `Current context (JSON):\n${JSON.stringify(contextBlock, null, 2)}\nToday's date: ${new Date().toISOString().slice(0, 10)}`,
      },
      ...((history ?? []) as Msg[]),
      { role: "user", content: data.message },
    ];

    // Persist user message
    await supabase.from("chat_messages").insert({ user_id: userId, role: "user", content: data.message });

    const res = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({ model: "google/gemini-2.5-flash", messages }),
    });

    if (!res.ok) {
      const text = await res.text();
      if (res.status === 429) throw new Error("The assistant is busy right now, please try again in a moment.");
      if (res.status === 402) throw new Error("AI credits exhausted. Please add credits to continue.");
      throw new Error(`AI error: ${text.slice(0, 200)}`);
    }
    const json = (await res.json()) as { choices?: { message?: { content?: string } }[] };
    const reply = json.choices?.[0]?.message?.content?.trim() || "Sorry, I couldn't generate a reply.";

    await supabase.from("chat_messages").insert({ user_id: userId, role: "assistant", content: reply });

    return { reply };
  });

export const getChatHistory = createServerFn({ method: "GET" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    const { supabase, userId } = context;
    const { data } = await supabase
      .from("chat_messages")
      .select("id, role, content, created_at")
      .eq("user_id", userId)
      .order("created_at", { ascending: true });
    return { messages: data ?? [] };
  });

export const clearChatHistory = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .handler(async ({ context }) => {
    await context.supabase.from("chat_messages").delete().eq("user_id", context.userId);
    return { ok: true };
  });
