import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, Megaphone, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { StatusBadge } from "@/components/StatusBadge";
import { SelectionDialog, type EditableSelection } from "@/components/SelectionDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  CATEGORIES,
  PROJECT_STATUSES,
  formatCurrency,
  type SelectionStatus,
} from "@/lib/constants";

export const Route = createFileRoute("/admin/$projectId")({
  head: () => ({ meta: [{ title: "Manage Project | Highland Remodeling" }] }),
  component: ProjectDetail,
});

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "customer") navigate({ to: "/dashboard" });
  }, [session, role, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-project", projectId],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: project }, { data: selections }, { data: updates }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase.from("selections").select("*").eq("project_id", projectId).order("sort_order"),
        supabase.from("project_updates").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      return { project, selections: selections ?? [], updates: updates ?? [] };
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableSelection | undefined>();
  const [addCategory, setAddCategory] = useState<string>();

  const statusMut = useMutation({
    mutationFn: async (status: string) => {
      const { error } = await supabase.from("projects").update({ status }).eq("id", projectId);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-project", projectId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("selections").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
      toast.success("Selection removed");
    },
  });

  const [uTitle, setUTitle] = useState("");
  const [uBody, setUBody] = useState("");
  const updateMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("project_updates").insert({
        project_id: projectId,
        title: uTitle,
        body: uBody || null,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
      toast.success("Update posted");
      setUTitle(""); setUBody("");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteUpdateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_updates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-project", projectId] }),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader subtitle="Contractor Admin" />
        <p className="p-10 text-center text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const project = data?.project;
  const selections = data?.selections ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        {!project ? (
          <p className="text-muted-foreground">Project not found.</p>
        ) : (
          <>
            <section className="rounded-2xl bg-[image:var(--gradient-navy)] p-6 text-[oklch(0.97_0.01_255)] shadow-[var(--shadow-soft)]">
              <h1 className="text-2xl font-bold text-[oklch(0.99_0.005_250)]">{project.name}</h1>
              <p className="mt-1 text-sm text-[oklch(0.88_0.02_255)]">{project.address || "No address"}</p>
              <div className="mt-4 flex items-center gap-2">
                <span className="text-sm text-[oklch(0.88_0.02_255)]">Status:</span>
                <Select value={project.status} onValueChange={(v) => statusMut.mutate(v)}>
                  <SelectTrigger className="h-8 w-44 bg-card text-foreground"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    {PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </section>

            {/* Selections */}
            <section className="mt-8">
              <div className="flex items-center justify-between">
                <h2 className="text-lg font-semibold">Selections</h2>
                <Button
                  variant="hero"
                  size="sm"
                  onClick={() => { setEditing(undefined); setAddCategory(undefined); setDialogOpen(true); }}
                >
                  <Plus className="h-4 w-4" /> Add Selection
                </Button>
              </div>

              <div className="mt-4 space-y-6">
                {CATEGORIES.map((cat) => {
                  const items = selections.filter((s) => s.category === cat);
                  return (
                    <div key={cat}>
                      <div className="mb-2 flex items-center justify-between">
                        <h3 className="border-l-4 border-accent pl-3 text-sm font-bold uppercase tracking-wide">{cat}</h3>
                        <Button
                          variant="ghost"
                          size="sm"
                          onClick={() => { setEditing(undefined); setAddCategory(cat); setDialogOpen(true); }}
                        >
                          <Plus className="h-3.5 w-3.5" /> Add
                        </Button>
                      </div>
                      {items.length === 0 ? (
                        <p className="rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted-foreground">
                          No items in this category.
                        </p>
                      ) : (
                        <div className="space-y-2">
                          {items.map((s) => (
                            <div key={s.id} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                              <SignedImage path={s.image_url} alt={s.item_name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="truncate font-semibold">{s.item_name}</h4>
                                  <StatusBadge status={s.status as SelectionStatus} />
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {formatCurrency(s.allowance_price)} allowance · {formatCurrency(s.actual_price)} actual
                                </p>
                                {s.product_link && (
                                  <a href={s.product_link} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                                    Product <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                {s.customer_notes && (
                                  <p className="mt-1 text-sm"><span className="font-medium">Customer: </span><span className="text-muted-foreground">{s.customer_notes}</span></p>
                                )}
                                <div className="mt-2 flex gap-1">
                                  <Button variant="outline" size="sm" onClick={() => { setEditing(s as EditableSelection); setDialogOpen(true); }}>
                                    <Pencil className="h-3.5 w-3.5" /> Edit
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(s.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                            </div>
                          ))}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </section>

            {/* Updates */}
            <section className="mt-10">
              <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
                <Megaphone className="h-5 w-5 text-accent" /> Project Updates
              </h2>
              <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                <div className="space-y-2">
                  <div className="space-y-1.5">
                    <Label>Title</Label>
                    <Input value={uTitle} onChange={(e) => setUTitle(e.target.value)} placeholder="Tile arrived on site" />
                  </div>
                  <div className="space-y-1.5">
                    <Label>Message</Label>
                    <Textarea value={uBody} onChange={(e) => setUBody(e.target.value)} rows={2} />
                  </div>
                  <Button variant="hero" size="sm" disabled={updateMut.isPending || !uTitle} onClick={() => updateMut.mutate()}>
                    Post Update
                  </Button>
                </div>
              </div>
              <div className="mt-3 space-y-2">
                {(data?.updates ?? []).map((u) => (
                  <div key={u.id} className="flex items-start justify-between gap-3 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
                    <div>
                      <h3 className="font-semibold">{u.title}</h3>
                      {u.body && <p className="text-sm text-muted-foreground">{u.body}</p>}
                      <time className="text-xs text-muted-foreground">{new Date(u.created_at).toLocaleString()}</time>
                    </div>
                    <Button variant="ghost" size="icon" onClick={() => deleteUpdateMut.mutate(u.id)}>
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                ))}
              </div>
            </section>

            <SelectionDialog
              projectId={projectId}
              open={dialogOpen}
              onOpenChange={setDialogOpen}
              existing={editing}
              defaultCategory={addCategory}
            />
          </>
        )}
      </main>
    </div>
  );
}