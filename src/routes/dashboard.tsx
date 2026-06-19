import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useQuery } from "@tanstack/react-query";
import { MapPin, Calendar, Megaphone } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { CustomerSelectionCard, type SelectionRow } from "@/components/CustomerSelectionCard";
import { CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "My Project | Highland Remodeling" }],
  }),
  component: Dashboard,
});

function Dashboard() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "admin") navigate({ to: "/admin" });
  }, [session, role, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["customer-data", session?.user?.id],
    enabled: !!session && role === "customer",
    queryFn: async () => {
      const { data: projects } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1);
      const project = projects?.[0] ?? null;
      if (!project) return { project: null, selections: [], updates: [] };

      const [{ data: selections }, { data: updates }] = await Promise.all([
        supabase.from("selections").select("*").eq("project_id", project.id).order("sort_order"),
        supabase
          .from("project_updates")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
      ]);
      return { project, selections: selections ?? [], updates: updates ?? [] };
    },
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="My Project" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        {isLoading ? (
          <p className="py-20 text-center text-muted-foreground">Loading your project…</p>
        ) : !data?.project ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold">No project yet</h2>
            <p className="mt-2 text-muted-foreground">
              Your contractor hasn't set up your project. Please check back soon.
            </p>
          </div>
        ) : (
          <>
            <section className="overflow-hidden rounded-2xl bg-[image:var(--gradient-navy)] p-6 text-[oklch(0.97_0.01_255)] shadow-[var(--shadow-soft)]">
              <div className="flex items-center justify-between gap-3">
                <h1 className="text-2xl font-bold text-[oklch(0.99_0.005_250)]">{data.project.name}</h1>
                <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
                  {data.project.status}
                </span>
              </div>
              <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[oklch(0.88_0.02_255)]">
                {data.project.address && (
                  <span className="inline-flex items-center gap-1.5">
                    <MapPin className="h-4 w-4" /> {data.project.address}
                  </span>
                )}
                {data.project.start_date && (
                  <span className="inline-flex items-center gap-1.5">
                    <Calendar className="h-4 w-4" /> Started{" "}
                    {new Date(data.project.start_date).toLocaleDateString()}
                  </span>
                )}
              </div>
            </section>

            {data.updates.length > 0 && (
              <section className="mt-6">
                <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                  <Megaphone className="h-5 w-5 text-accent" /> Project Updates
                </h2>
                <div className="space-y-3">
                  {data.updates.map((u) => (
                    <div key={u.id} className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                      <div className="flex items-center justify-between gap-2">
                        <h3 className="font-semibold text-foreground">{u.title}</h3>
                        <time className="text-xs text-muted-foreground">
                          {new Date(u.created_at).toLocaleDateString()}
                        </time>
                      </div>
                      {u.body && <p className="mt-1 text-sm text-muted-foreground">{u.body}</p>}
                    </div>
                  ))}
                </div>
              </section>
            )}

            <section className="mt-8">
              <h2 className="mb-1 text-lg font-semibold">Your Selections</h2>
              <p className="mb-4 text-sm text-muted-foreground">
                Review each item, then approve or request a change.
              </p>
              {data.selections.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                  No selections have been added yet.
                </p>
              ) : (
                <div className="space-y-8">
                  {CATEGORIES.filter((cat) =>
                    data.selections.some((s) => s.category === cat),
                  ).map((cat) => (
                    <div key={cat}>
                      <h3 className="mb-3 border-l-4 border-accent pl-3 text-base font-bold uppercase tracking-wide text-foreground">
                        {cat}
                      </h3>
                      <div className="grid gap-3 md:grid-cols-2">
                        {data.selections
                          .filter((s) => s.category === cat)
                          .map((s) => (
                            <CustomerSelectionCard key={s.id} item={s as SelectionRow} />
                          ))}
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </section>
          </>
        )}
      </main>
    </div>
  );
}