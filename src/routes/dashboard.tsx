import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MapPin, Calendar, Megaphone, ExternalLink, Check, MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { CATEGORIES, formatCurrency } from "@/lib/constants";

export const Route = createFileRoute("/dashboard")({
  head: () => ({
    meta: [{ title: "My Project | Highland Remodeling" }],
  }),
  component: Dashboard,
});

type CatalogItem = {
  id: string;
  product_name: string;
  category: string;
  vendor: string | null;
  price: number | null;
  image_url: string | null;
  product_url: string | null;
  description: string | null;
};

type OptionRow = {
  id: string;
  category: string;
  sort_order: number;
  is_selected: boolean;
  status: string;
  customer_notes: string | null;
  catalog_item_id: string;
  master_catalog: CatalogItem | null;
};

function Dashboard() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

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
      if (!project) return { project: null, options: [] as OptionRow[], updates: [] };

      const [{ data: options }, { data: updates }] = await Promise.all([
        supabase
          .from("project_selection_options")
          .select("*, master_catalog(*)")
          .eq("project_id", project.id)
          .order("sort_order"),
        supabase
          .from("project_updates")
          .select("*")
          .eq("project_id", project.id)
          .order("created_at", { ascending: false }),
      ]);
      return {
        project,
        options: (options ?? []) as unknown as OptionRow[],
        updates: updates ?? [],
      };
    },
  });

  // notes drafts when requesting a change: optionId -> note text
  const [noteDrafts, setNoteDrafts] = useState<Record<string, string>>({});

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_selection_options")
        .update({ status: "Approved", customer_notes: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-data"] });
      toast.success("Selection approved!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const changeMut = useMutation({
    mutationFn: async ({ id, note }: { id: string; note: string }) => {
      const { error } = await supabase
        .from("project_selection_options")
        .update({ status: "Change Requested", customer_notes: note || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-data"] });
      toast.success("Change requested. Your contractor will be in touch.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  const options = data?.options ?? [];
  const categoriesWithOptions = CATEGORIES.filter((cat) => options.some((o) => o.category === cat));

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
                Review each selection and approve it, or request a change with a note.
              </p>
              {options.length === 0 ? (
                <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                  No options have been added yet.
                </p>
              ) : (
                  <div className="space-y-8">
                    {categoriesWithOptions.map((cat) => (
                      <div key={cat}>
                        <h3 className="mb-3 border-l-4 border-accent pl-3 text-base font-bold uppercase tracking-wide text-foreground">
                          {cat}
                        </h3>
                        <div className="grid gap-3 md:grid-cols-2">
                          {options
                            .filter((o) => o.category === cat)
                            .map((o) => {
                              const c = o.master_catalog;
                              const approved = o.status === "Approved";
                              const changeRequested = o.status === "Change Requested";
                              return (
                                <div
                                  key={o.id}
                                  className={`overflow-hidden rounded-xl border bg-card text-left shadow-[var(--shadow-card)] ${
                                    approved
                                      ? "border-success"
                                      : changeRequested
                                        ? "border-accent"
                                        : "border-border"
                                  }`}
                                >
                                  <div className="flex gap-3 p-3">
                                    <SignedImage
                                      path={c?.image_url ?? null}
                                      alt={c?.product_name ?? ""}
                                      className="h-24 w-24 shrink-0 rounded-lg object-cover"
                                    />
                                    <div className="min-w-0 flex-1">
                                      <div className="flex items-start justify-between gap-2">
                                        <h4 className="font-semibold text-foreground">{c?.product_name}</h4>
                                        {approved ? (
                                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success px-2 py-0.5 text-xs font-semibold text-primary-foreground">
                                            <Check className="h-3 w-3" /> Approved
                                          </span>
                                        ) : changeRequested ? (
                                          <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-xs font-semibold text-accent-foreground">
                                            <MessageSquare className="h-3 w-3" /> Change Requested
                                          </span>
                                        ) : (
                                          <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                                            Pending
                                          </span>
                                        )}
                                      </div>
                                      {c?.vendor && <p className="text-sm text-muted-foreground">{c.vendor}</p>}
                                      <p className="text-sm font-medium text-foreground">{formatCurrency(c?.price)}</p>
                                      {c?.description && (
                                        <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{c.description}</p>
                                      )}
                                      {c?.product_url && (
                                        <a
                                          href={c.product_url}
                                          target="_blank"
                                          rel="noreferrer"
                                          onClick={(e) => e.stopPropagation()}
                                          className="mt-1 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
                                        >
                                          View product <ExternalLink className="h-3.5 w-3.5" />
                                        </a>
                                      )}
                                    </div>
                                  </div>
                                  <div className="border-t border-border p-3">
                                    {changeRequested && o.customer_notes && (
                                      <p className="mb-2 rounded-md bg-secondary px-3 py-2 text-sm text-muted-foreground">
                                        Your note: {o.customer_notes}
                                      </p>
                                    )}
                                    <Textarea
                                      rows={2}
                                      placeholder="Add a note for your contractor (optional)"
                                      value={noteDrafts[o.id] ?? o.customer_notes ?? ""}
                                      onChange={(e) =>
                                        setNoteDrafts((p) => ({ ...p, [o.id]: e.target.value }))
                                      }
                                      className="mb-2"
                                    />
                                    <div className="flex flex-wrap gap-2">
                                      <Button
                                        variant="success"
                                        size="sm"
                                        disabled={approveMut.isPending}
                                        onClick={() => approveMut.mutate(o.id)}
                                      >
                                        <Check className="h-4 w-4" /> Approve
                                      </Button>
                                      <Button
                                        variant="outline"
                                        size="sm"
                                        disabled={changeMut.isPending}
                                        onClick={() =>
                                          changeMut.mutate({
                                            id: o.id,
                                            note: noteDrafts[o.id] ?? o.customer_notes ?? "",
                                          })
                                        }
                                      >
                                        <MessageSquare className="h-4 w-4" /> Request Change
                                      </Button>
                                    </div>
                                  </div>
                                </div>
                              );
                            })}
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
