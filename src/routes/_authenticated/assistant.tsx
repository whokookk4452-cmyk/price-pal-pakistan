import { createFileRoute } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { toast } from "sonner";
import { useEffect, useRef, useState } from "react";
import { Sparkles, Send, Trash2, ShoppingBasket } from "lucide-react";
import { sendChatMessage, getChatHistory, clearChatHistory } from "@/lib/ai-chat.functions";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated/assistant")({
  component: AssistantPage,
});

const SUGGESTIONS = [
  "Can I afford chicken and rice this week?",
  "Where's the cheapest place to buy rice?",
  "How can I cut my list to stay under budget?",
  "Which items on my list are most overpriced?",
];

function AssistantPage() {
  const qc = useQueryClient();
  const send = useServerFn(sendChatMessage);
  const history = useServerFn(getChatHistory);
  const clear = useServerFn(clearChatHistory);

  const [input, setInput] = useState("");
  const scrollRef = useRef<HTMLDivElement>(null);

  const { data } = useQuery({
    queryKey: ["chat"],
    queryFn: () => history(),
  });
  const messages = data?.messages ?? [];

  const mSend = useMutation({
    mutationFn: (message: string) => send({ data: { message } }),
    onMutate: async (message: string) => {
      const prev = qc.getQueryData<{ messages: typeof messages }>(["chat"]);
      qc.setQueryData(["chat"], {
        messages: [
          ...(prev?.messages ?? []),
          { id: "local-" + Date.now(), role: "user", content: message, created_at: new Date().toISOString() },
        ],
      });
      return { prev };
    },
    onError: (e: Error, _v, ctx) => {
      toast.error(e.message);
      if (ctx?.prev) qc.setQueryData(["chat"], ctx.prev);
    },
    onSettled: () => qc.invalidateQueries({ queryKey: ["chat"] }),
  });

  const mClear = useMutation({
    mutationFn: () => clear(),
    onSuccess: () => {
      toast.success("Conversation cleared");
      qc.invalidateQueries({ queryKey: ["chat"] });
    },
  });

  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages.length, mSend.isPending]);

  const handleSend = (text: string) => {
    const t = text.trim();
    if (!t || mSend.isPending) return;
    setInput("");
    mSend.mutate(t);
  };

  return (
    <div className="flex flex-col h-[calc(100vh-3.5rem)] md:h-screen max-w-3xl mx-auto w-full">
      <header className="p-4 border-b border-border flex items-center justify-between bg-card">
        <div className="flex items-center gap-2">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <Sparkles className="size-4" />
          </div>
          <div>
            <h1 className="font-semibold">AI Shopping Assistant</h1>
            <p className="text-xs text-muted-foreground">Powered by real reported prices</p>
          </div>
        </div>
        {messages.length > 0 && (
          <Button variant="ghost" size="sm" onClick={() => mClear.mutate()}>
            <Trash2 className="size-4" /> Clear
          </Button>
        )}
      </header>

      <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-8 space-y-6">
            <div className="inline-flex size-16 rounded-2xl bg-primary/10 items-center justify-center">
              <ShoppingBasket className="size-8 text-primary" />
            </div>
            <div>
              <h2 className="text-lg font-semibold">Hi! I'm your shopping assistant.</h2>
              <p className="text-sm text-muted-foreground max-w-md mx-auto mt-1">
                Ask me anything about your shopping list, prices, and budget. I use real reports from
                shoppers across Pakistan.
              </p>
            </div>
            <div className="flex flex-wrap gap-2 justify-center max-w-lg mx-auto">
              {SUGGESTIONS.map((s) => (
                <button
                  key={s}
                  onClick={() => handleSend(s)}
                  className="text-sm px-3 py-1.5 rounded-full bg-secondary hover:bg-accent border border-border transition-colors"
                >
                  {s}
                </button>
              ))}
            </div>
          </div>
        )}

        {messages.map((m) => (
          <div key={m.id} className={cn("flex", m.role === "user" ? "justify-end" : "justify-start")}>
            <div
              className={cn(
                "max-w-[85%] rounded-2xl px-4 py-2.5 whitespace-pre-wrap text-sm",
                m.role === "user"
                  ? "bg-primary text-primary-foreground rounded-br-sm"
                  : "bg-secondary text-secondary-foreground rounded-bl-sm",
              )}
            >
              {m.content}
            </div>
          </div>
        ))}
        {mSend.isPending && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl rounded-bl-sm px-4 py-3 text-sm text-muted-foreground">
              <span className="inline-flex gap-1">
                <span className="size-1.5 rounded-full bg-current animate-bounce" />
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:150ms]" />
                <span className="size-1.5 rounded-full bg-current animate-bounce [animation-delay:300ms]" />
              </span>
            </div>
          </div>
        )}
      </div>

      <Card className="m-4 border-primary/20">
        <CardContent className="p-3">
          <form
            className="flex gap-2 items-end"
            onSubmit={(e) => {
              e.preventDefault();
              handleSend(input);
            }}
          >
            <Textarea
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && !e.shiftKey) {
                  e.preventDefault();
                  handleSend(input);
                }
              }}
              placeholder="Ask about your list, prices, or budget…"
              className="min-h-[44px] max-h-32 resize-none border-0 focus-visible:ring-0 shadow-none"
              disabled={mSend.isPending}
            />
            <Button type="submit" size="icon" disabled={mSend.isPending || !input.trim()}>
              <Send className="size-4" />
            </Button>
          </form>
        </CardContent>
      </Card>
    </div>
  );
}
