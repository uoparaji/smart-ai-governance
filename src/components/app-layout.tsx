import { Link, useRouterState, useNavigate } from "@tanstack/react-router";
import {
  LayoutDashboard, Boxes, ShieldAlert, GitPullRequestArrow,
  FileText, ScrollText, CheckCircle2, Settings, LogOut, Shield, Search,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useCurrentUser } from "@/lib/use-current-user";
import { Button } from "@/components/ui/button";
import { useQueryClient } from "@tanstack/react-query";

const NAV = [
  { to: "/dashboard", label: "Dashboard", icon: LayoutDashboard },
  { to: "/systems", label: "AI Registry", icon: Boxes },
  { to: "/approvals", label: "Approvals", icon: GitPullRequestArrow },
  { to: "/incidents", label: "Incidents", icon: ShieldAlert },
  { to: "/compliance", label: "Compliance", icon: CheckCircle2 },
  { to: "/reports", label: "Reports", icon: FileText },
  { to: "/audit", label: "Audit Trail", icon: ScrollText },
  { to: "/settings", label: "Settings", icon: Settings },
] as const;

export function AppLayout({ children }: { children: React.ReactNode }) {
  const pathname = useRouterState({ select: (s) => s.location.pathname });
  const { data: me } = useCurrentUser();
  const navigate = useNavigate();
  const qc = useQueryClient();

  async function signOut() {
    await qc.cancelQueries();
    qc.clear();
    await supabase.auth.signOut();
    navigate({ to: "/auth", replace: true });
  }

  return (
    <div className="min-h-screen flex bg-background text-foreground">
      <aside className="w-60 shrink-0 bg-sidebar border-r border-sidebar-border flex flex-col">
        <div className="h-14 flex items-center gap-2 px-4 border-b border-sidebar-border">
          <div className="size-7 rounded-md bg-primary grid place-items-center">
            <Shield className="size-4 text-primary-foreground" />
          </div>
          <span className="font-semibold tracking-tight text-sidebar-foreground">GovernAI</span>
        </div>
        <nav className="flex-1 p-2 space-y-0.5">
          {NAV.map(({ to, label, icon: Icon }) => {
            const active = pathname === to || (to !== "/dashboard" && pathname.startsWith(to));
            return (
              <Link
                key={to} to={to}
                className={`flex items-center gap-2.5 px-2.5 py-1.5 rounded-md text-sm transition-colors ${
                  active
                    ? "bg-sidebar-accent text-sidebar-accent-foreground"
                    : "text-sidebar-foreground/80 hover:bg-sidebar-accent/60 hover:text-sidebar-foreground"
                }`}
              >
                <Icon className="size-4" />
                {label}
              </Link>
            );
          })}
        </nav>
        <div className="p-3 border-t border-sidebar-border space-y-2">
          <div className="px-2 text-xs">
            <p className="font-medium text-sidebar-foreground truncate">{me?.profile?.full_name || me?.user.email}</p>
            <p className="text-muted-foreground truncate">{(me?.roles ?? []).join(", ") || "no role"}</p>
          </div>
          <Button variant="ghost" size="sm" className="w-full justify-start" onClick={signOut}>
            <LogOut className="size-4 mr-2" /> Sign out
          </Button>
        </div>
      </aside>
      <main className="flex-1 min-w-0 flex flex-col">
        <header className="h-14 border-b border-border flex items-center gap-3 px-6 no-print">
          <Search className="size-4 text-muted-foreground" />
          <input
            placeholder="Search…"
            className="bg-transparent text-sm flex-1 outline-none placeholder:text-muted-foreground"
          />
        </header>
        <div className="flex-1 overflow-auto">{children}</div>
      </main>
    </div>
  );
}
