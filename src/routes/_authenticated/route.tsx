import { createFileRoute, Outlet, redirect, Link, useNavigate, useRouterState } from "@tanstack/react-router";
import { supabase } from "@/integrations/supabase/client";
import {
  LayoutDashboard,
  Package,
  ShoppingCart,
  Wallet,
  Sparkles,
  User,
  LogOut,
  ShoppingBasket,
  Menu,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { useState } from "react";
import { cn } from "@/lib/utils";

export const Route = createFileRoute("/_authenticated")({
  ssr: false,
  beforeLoad: async () => {
    const { data, error } = await supabase.auth.getUser();
    if (error || !data.user) throw redirect({ to: "/auth" });
    return { user: data.user };
  },
  component: AuthLayout,
});

const nav = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/products", label: "Products", icon: Package },
  { to: "/list", label: "Shopping List", icon: ShoppingCart },
  { to: "/budget", label: "Budget", icon: Wallet },
  { to: "/assistant", label: "AI Assistant", icon: Sparkles },
  { to: "/profile", label: "Profile", icon: User },
] as const;

function AuthLayout() {
  const navigate = useNavigate();
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const [open, setOpen] = useState(false);

  const signOut = async () => {
    await supabase.auth.signOut();
    navigate({ to: "/auth" });
  };

  return (
    <div className="min-h-screen flex bg-background">
      {/* Sidebar - desktop */}
      <aside className="hidden md:flex w-60 flex-col border-r border-border bg-sidebar">
        <div className="p-4 flex items-center gap-2 border-b border-sidebar-border">
          <div className="size-9 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
            <ShoppingBasket className="size-5" />
          </div>
          <div>
            <div className="font-bold leading-tight">AI Price Tracker</div>
            <div className="text-xs text-muted-foreground">Pakistan</div>
          </div>
        </div>
        <nav className="flex-1 p-2 space-y-1">
          {nav.map((n) => {
            const active = pathname === n.to || (n.to !== "/dashboard" && pathname.startsWith(n.to));
            const Icon = n.icon;
            return (
              <Link
                key={n.to}
                to={n.to}
                className={cn(
                  "flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium transition-colors",
                  active
                    ? "bg-primary text-primary-foreground"
                    : "text-sidebar-foreground hover:bg-sidebar-accent",
                )}
              >
                <Icon className="size-4" />
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="p-2 border-t border-sidebar-border">
          <Button variant="ghost" size="sm" onClick={signOut} className="w-full justify-start">
            <LogOut className="size-4" /> Sign out
          </Button>
        </div>
      </aside>

      {/* Mobile top bar */}
      <div className="flex-1 flex flex-col min-w-0">
        <header className="md:hidden flex items-center justify-between border-b border-border p-3 bg-card">
          <div className="flex items-center gap-2">
            <div className="size-8 rounded-lg bg-primary text-primary-foreground flex items-center justify-center">
              <ShoppingBasket className="size-4" />
            </div>
            <span className="font-bold">AI Price Tracker</span>
          </div>
          <Button variant="ghost" size="icon" onClick={() => setOpen((o) => !o)}>
            <Menu className="size-5" />
          </Button>
        </header>
        {open && (
          <nav className="md:hidden border-b border-border bg-card p-2 space-y-1">
            {nav.map((n) => {
              const Icon = n.icon;
              return (
                <Link
                  key={n.to}
                  to={n.to}
                  onClick={() => setOpen(false)}
                  className="flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
                >
                  <Icon className="size-4" />
                  {n.label}
                </Link>
              );
            })}
            <button
              onClick={signOut}
              className="w-full flex items-center gap-3 rounded-md px-3 py-2 text-sm font-medium hover:bg-accent"
            >
              <LogOut className="size-4" /> Sign out
            </button>
          </nav>
        )}
        <main className="flex-1 overflow-auto">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
