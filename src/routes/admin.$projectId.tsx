import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import {
  ArrowLeft,
  Plus,
  Trash2,
  Megaphone,
  ExternalLink,
  ArrowUp,
  ArrowDown,
  Check,
  Library,
  FileDown,
  History,
  User,
  Phone,
  Mail,
  MapPin,
  Pencil,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { EnlargeableImage } from "@/components/EnlargeableImage";
import { SelectionNotes } from "@/components/SelectionNotes";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES, PROJECT_STATUSES, PROJECT_TYPES, formatCurrency, isValidEmail, isValidPhone } from "@/lib/constants";
import { syncSelectionsVersion } from "@/lib/selections.functions";
import { generateSelectionsPdf, generatePmSpecPdf } from "@/lib/exportSelectionsPdf";
import { listCustomers } from "@/lib/admin.functions";

export const Route = createFileRoute("/admin/$projectId")({
  head: () => ({ meta: [{ title: "Manage Project | Highland Remodeling" }] }),
  component: ProjectDetail,
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
  active: boolean;
};

type OptionRow = {
  id: string;
  project_id: string;
  catalog_item_id: string;
  category: string;
  sort_order: number;
  is_selected: boolean;
  status: string;
  customer_notes: string | null;
  master_catalog: CatalogItem | null;
};

function ProjectDetail() {
  const { projectId } = Route.useParams();
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const syncVersion = useServerFn(syncSelectionsVersion);
  const listCustomersFn = useServerFn(listCustomers);
  const [exporting, setExporting] = useState(false);
  const [exportingPm, setExportingPm] = useState(false);
  const [tlFilter, setTlFilter] = useState<"all" | "selections">("all");
  const [custOpen, setCustOpen] = useState(false);

  const customers = useQuery({
    queryKey: ["customers"],
    enabled: role === "admin",
    queryFn: () => listCustomersFn(),
  });

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "customer") navigate({ to: "/dashboard" });
  }, [session, role, loading, navigate]);

  const { data, isLoading } = useQuery({
    queryKey: ["admin-project", projectId],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: project }, { data: options }, { data: updates }] = await Promise.all([
        supabase.from("projects").select("*").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_selection_options")
          .select("*, master_catalog(*)")
          .eq("project_id", projectId)
          .order("sort_order"),
        supabase.from("project_updates").select("*").eq("project_id", projectId).order("created_at", { ascending: false }),
      ]);
      return {
        project,
        options: (options ?? []) as unknown as OptionRow[],
        updates: updates ?? [],
      };
    },
  });

  const removeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("project_selection_options").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
      toast.success("Removed from project");
    },
  });

  const categoryMut = useMutation({
    mutationFn: async ({ id, category }: { id: string; category: string }) => {
      const { error } = await supabase.from("project_selection_options").update({ category }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-project", projectId] }),
  });

  const reorderMut = useMutation({
    mutationFn: async (rows: { id: string; sort_order: number }[]) => {
      for (const r of rows) {
        const { error } = await supabase
          .from("project_selection_options")
          .update({ sort_order: r.sort_order })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["admin-project", projectId] }),
  });

  // project updates
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

  const [addOpen, setAddOpen] = useState(false);

  const options = data?.options ?? [];

  const assignedProfile =
    (customers.data ?? []).find((c) => c.id === data?.project?.customer_id) ?? null;

  // Backfill empty project snapshot fields from the assigned customer profile.
  useEffect(() => {
    const project = data?.project;
    if (!project || !project.customer_id || !assignedProfile) return;
    const patch: {
      customer_name?: string;
      customer_phone?: string;
      customer_email?: string;
      project_address?: string;
      address?: string;
    } = {};
    if (!project.customer_name && assignedProfile.full_name)
      patch.customer_name = assignedProfile.full_name;
    if (!project.customer_phone && assignedProfile.phone)
      patch.customer_phone = assignedProfile.phone;
    if (!project.customer_email && assignedProfile.email)
      patch.customer_email = assignedProfile.email;
    if (!project.project_address && !project.address && assignedProfile.address) {
      patch.project_address = assignedProfile.address;
      patch.address = assignedProfile.address;
    }
    if (Object.keys(patch).length === 0) return;
    (async () => {
      const { error } = await supabase.from("projects").update(patch).eq("id", project.id);
      if (!error) qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.project, assignedProfile]);

  const timeline = useQuery({
    queryKey: ["admin-timeline", projectId],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("project_timeline_events")
        .select("*")
        .eq("project_id", projectId)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const handleExport = async () => {
    if (!data?.project) return;
    setExporting(true);
    try {
      let customerName = "—";
      if (data.project.customer_id) {
        const { data: prof } = await supabase
          .from("profiles")
          .select("full_name, email")
          .eq("id", data.project.customer_id)
          .maybeSingle();
        customerName = prof?.full_name || prof?.email || "—";
      }
      const { version, lastModified } = await syncVersion({
        data: { projectId },
      });
      await generateSelectionsPdf({
        projectName: data.project.name,
        customerName,
        address: data.project.address,
        version,
        lastModified,
        options: options.map((o) => ({
          id: o.id,
          category: o.category,
          customer_notes: o.customer_notes,
          master_catalog: o.master_catalog,
        })),
      });
      qc.invalidateQueries({ queryKey: ["admin-timeline", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      setExporting(false);
    }
  };

  const resolveCustomerName = async () => {
    if (!data?.project?.customer_id) return "—";
    const { data: prof } = await supabase
      .from("profiles")
      .select("full_name, email")
      .eq("id", data.project.customer_id)
      .maybeSingle();
    return prof?.full_name || prof?.email || "—";
  };

  const handleExportPm = async () => {
    if (!data?.project) return;
    setExportingPm(true);
    try {
      const customerName = await resolveCustomerName();
      const { version, lastModified } = await syncVersion({ data: { projectId } });
      await generatePmSpecPdf({
        projectName: data.project.name,
        customerName,
        address: data.project.address,
        version,
        lastModified,
        options: options.map((o) => ({
          id: o.id,
          category: o.category,
          customer_notes: o.customer_notes,
          status: o.status,
          master_catalog: o.master_catalog
            ? {
                product_name: o.master_catalog.product_name,
                vendor: o.master_catalog.vendor,
                image_url: o.master_catalog.image_url,
                product_url: o.master_catalog.product_url,
                price: o.master_catalog.price,
                description: o.master_catalog.description,
              }
            : null,
        })),
      });
      qc.invalidateQueries({ queryKey: ["admin-timeline", projectId] });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      setExportingPm(false);
    }
  };

  const move = (cat: string, index: number, dir: -1 | 1) => {
    const items = options.filter((o) => o.category === cat);
    const target = index + dir;
    if (target < 0 || target >= items.length) return;
    const a = items[index];
    const b = items[target];
    reorderMut.mutate([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]);
  };

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader subtitle="Contractor Admin" />
        <p className="p-10 text-center text-muted-foreground">Loading…</p>
      </div>
    );
  }

  const project = data?.project;

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
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <h1 className="text-2xl font-bold text-[oklch(0.99_0.005_250)]">{project.name}</h1>
                  {project.project_type && (
                    <p className="mt-1 text-sm text-[oklch(0.88_0.02_255)]">
                      {PROJECT_TYPES.find((t) => t.value === project.project_type)?.label ?? project.project_type}
                    </p>
                  )}
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  className="shrink-0 bg-card text-foreground"
                  onClick={() => setCustOpen(true)}
                >
                  <Pencil className="h-4 w-4" /> Edit Banner Details
                </Button>
              </div>

              <div className="mt-4 grid gap-x-6 gap-y-1.5 text-sm text-[oklch(0.92_0.02_255)] sm:grid-cols-2">
                <span className="inline-flex items-center gap-1.5">
                  <User className="h-4 w-4" /> {project.customer_name || "No name on file"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Phone className="h-4 w-4" /> {project.customer_phone || "No phone"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <Mail className="h-4 w-4" /> {project.customer_email || "No email"}
                </span>
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-4 w-4" /> {project.project_address || project.address || "No address"}
                </span>
              </div>

              {project.project_description && (
                <p className="mt-3 whitespace-pre-wrap text-sm text-[oklch(0.88_0.02_255)]">
                  {project.project_description}
                </p>
              )}

              <div className="mt-4 flex items-center gap-2 text-sm text-[oklch(0.92_0.02_255)]">
                <span className="text-[oklch(0.88_0.02_255)]">Status:</span>
                <span className="rounded-full bg-card px-3 py-0.5 font-medium text-foreground">{project.status}</span>
              </div>
            </section>

            <EditCustomerInfoDialog
              open={custOpen}
              onOpenChange={setCustOpen}
              projectId={projectId}
              project={project}
              customers={customers.data ?? []}
              onSaved={() => {
                qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
                qc.invalidateQueries({ queryKey: ["admin-timeline", projectId] });
              }}
            />

            {Array.isArray(project.intake_photos) && project.intake_photos.length > 0 && (
              <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
                <h2 className="mb-3 text-lg font-semibold">Intake / Inspiration Photos</h2>
                <div className="flex flex-wrap gap-2">
                  {project.intake_photos.map((path: string) => (
                    <EnlargeableImage key={path} path={path} alt="inspiration" className="h-20 w-20 rounded-lg" />
                  ))}
                </div>
              </section>
            )}

            {/* Selection options */}
            <section className="mt-8">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <h2 className="text-lg font-semibold">Selection Options</h2>
                <div className="flex gap-2">
                  <Button variant="outline" size="sm" asChild>
                    <Link to="/admin/catalog"><Library className="h-4 w-4" /> Catalog</Link>
                  </Button>
                  <Button variant="outline" size="sm" disabled={exporting || options.length === 0} onClick={handleExport}>
                    <FileDown className="h-4 w-4" /> {exporting ? "Exporting…" : "Export Selections List"}
                  </Button>
                  <Button variant="outline" size="sm" disabled={exportingPm || options.length === 0} onClick={handleExportPm}>
                    <FileDown className="h-4 w-4" /> {exportingPm ? "Exporting…" : "PM Specification PDF"}
                  </Button>
                  <Button variant="hero" size="sm" onClick={() => setAddOpen(true)}>
                    <Plus className="h-4 w-4" /> Add from Catalog
                  </Button>
                </div>
              </div>

              <div className="mt-4 space-y-6">
                {CATEGORIES.filter((cat) => options.some((o) => o.category === cat)).map((cat) => {
                  const items = options.filter((o) => o.category === cat);
                  return (
                    <div key={cat}>
                      <h3 className="mb-2 border-l-4 border-accent pl-3 text-sm font-bold uppercase tracking-wide">{cat}</h3>
                      <div className="space-y-2">
                        {items.map((o, idx) => {
                          const c = o.master_catalog;
                          return (
                            <div key={o.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                              <div className="flex gap-3">
                              <EnlargeableImage path={c?.image_url ?? null} alt={c?.product_name ?? ""} className="h-16 w-16 shrink-0 rounded-lg" />
                              <div className="min-w-0 flex-1">
                                <div className="flex items-start justify-between gap-2">
                                  <h4 className="truncate font-semibold">{c?.product_name ?? "Unknown product"}</h4>
                                  {o.status === "Approved" ? (
                                    <span className="inline-flex shrink-0 items-center gap-1 rounded-full bg-success/15 px-2 py-0.5 text-xs font-semibold text-[oklch(0.45_0.13_150)]">
                                      <Check className="h-3 w-3" /> Approved
                                    </span>
                                  ) : o.status === "Change Requested" ? (
                                    <span className="inline-flex shrink-0 items-center rounded-full bg-accent/15 px-2 py-0.5 text-xs font-semibold text-accent">
                                      Change Requested
                                    </span>
                                  ) : (
                                    <span className="inline-flex shrink-0 items-center rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-secondary-foreground">
                                      Pending
                                    </span>
                                  )}
                                </div>
                                <p className="text-sm text-muted-foreground">
                                  {c?.vendor ? `${c.vendor} · ` : ""}{formatCurrency(c?.price)}
                                </p>
                                {o.status === "Change Requested" && o.customer_notes && (
                                  <p className="mt-1 rounded-md bg-secondary px-2 py-1 text-sm text-muted-foreground">
                                    Customer note: {o.customer_notes}
                                  </p>
                                )}
                                {c?.product_url && (
                                  <a href={c.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                                    Product <ExternalLink className="h-3 w-3" />
                                  </a>
                                )}
                                <div className="mt-2 flex flex-wrap items-center gap-2">
                                  <Select value={o.category} onValueChange={(v) => categoryMut.mutate({ id: o.id, category: v })}>
                                    <SelectTrigger className="h-8 w-40"><SelectValue /></SelectTrigger>
                                    <SelectContent>
                                      {CATEGORIES.map((cc) => <SelectItem key={cc} value={cc}>{cc}</SelectItem>)}
                                    </SelectContent>
                                  </Select>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === 0} onClick={() => move(cat, idx, -1)}>
                                    <ArrowUp className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="icon" className="h-8 w-8" disabled={idx === items.length - 1} onClick={() => move(cat, idx, 1)}>
                                    <ArrowDown className="h-4 w-4" />
                                  </Button>
                                  <Button variant="ghost" size="sm" onClick={() => removeMut.mutate(o.id)}>
                                    <Trash2 className="h-3.5 w-3.5 text-destructive" />
                                  </Button>
                                </div>
                              </div>
                              </div>
                              <div className="mt-3 border-t border-border pt-3">
                                <SelectionNotes optionId={o.id} projectId={projectId} />
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
                {options.length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    No products added yet. Use “Add from Catalog” to assign options for this project.
                  </p>
                )}
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

            {/* Timeline */}
            <section className="mt-10">
              <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
                <h2 className="flex items-center gap-2 text-lg font-semibold">
                  <History className="h-5 w-5 text-accent" /> Timeline
                </h2>
                <div className="flex gap-1">
                  {(["all", "selections"] as const).map((f) => (
                    <Button
                      key={f}
                      variant={tlFilter === f ? "secondary" : "ghost"}
                      size="sm"
                      onClick={() => setTlFilter(f)}
                    >
                      {f === "all" ? "All" : "Selections"}
                    </Button>
                  ))}
                </div>
              </div>
              <div className="space-y-2">
                {(timeline.data ?? [])
                  .filter((e) => tlFilter === "all" || e.category === tlFilter)
                  .map((e) => (
                    <div key={e.id} className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                      <div className="flex items-start justify-between gap-2">
                        <h3 className="font-semibold text-sm">{e.title}</h3>
                        <time className="shrink-0 text-xs text-muted-foreground">
                          {new Date(e.created_at).toLocaleString()}
                        </time>
                      </div>
                      {e.description && (
                        <p className="mt-0.5 text-sm text-muted-foreground">{e.description}</p>
                      )}
                    </div>
                  ))}
                {(timeline.data ?? []).filter((e) => tlFilter === "all" || e.category === tlFilter).length === 0 && (
                  <p className="rounded-lg border border-dashed border-border px-3 py-4 text-center text-sm text-muted-foreground">
                    No timeline events yet.
                  </p>
                )}
              </div>
            </section>

            <AddFromCatalogDialog
              projectId={projectId}
              open={addOpen}
              onOpenChange={setAddOpen}
              existingCatalogIds={options.map((o) => o.catalog_item_id)}
            />
          </>
        )}
      </main>
    </div>
  );
}

function AddFromCatalogDialog({
  projectId,
  open,
  onOpenChange,
  existingCatalogIds,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingCatalogIds: string[];
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: items, isLoading } = useQuery({
    queryKey: ["catalog-active"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_catalog")
        .select("*")
        .eq("active", true)
        .order("category")
        .order("product_name");
      if (error) throw error;
      return data as CatalogItem[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const { error } = await supabase.from("project_selection_options").insert({
        project_id: projectId,
        catalog_item_id: item.id,
        category: item.category,
        sort_order: existingCatalogIds.length + 1,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
      toast.success("Added to project");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (items ?? []).filter((i) => {
      if (existingCatalogIds.includes(i.id)) return false;
      if (!q) return true;
      return (
        i.product_name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.vendor ?? "").toLowerCase().includes(q)
      );
    });
  }, [items, search, existingCatalogIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add from Master Catalog</DialogTitle>
        </DialogHeader>
        <Input placeholder="Search products…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading catalog…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No products available.</p>
          ) : (
            filtered.map((i) => (
              <div key={i.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5">
                <SignedImage path={i.image_url} alt={i.product_name} className="h-12 w-12 shrink-0 rounded-lg object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.category}{i.vendor ? ` · ${i.vendor}` : ""} · {formatCurrency(i.price)}</p>
                </div>
                <Button variant="orange" size="sm" disabled={addMut.isPending} onClick={() => addMut.mutate(i)}>
                  <Plus className="h-4 w-4" /> Add
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}

type ProjectCustomerInfo = {
  customer_id: string | null;
  customer_name: string | null;
  customer_phone: string | null;
  customer_email: string | null;
  project_address: string | null;
  address: string | null;
  project_type: string | null;
  project_description: string | null;
  status: string;
};

function EditCustomerInfoDialog({
  open,
  onOpenChange,
  projectId,
  project,
  customers,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  project: ProjectCustomerInfo;
  customers: { id: string; full_name: string | null; email: string | null }[];
  onSaved: () => void;
}) {
  const UNASSIGNED = "__unassigned__";
  const [customerId, setCustomerId] = useState<string>(project.customer_id ?? UNASSIGNED);
  const [name, setName] = useState(project.customer_name ?? "");
  const [phone, setPhone] = useState(project.customer_phone ?? "");
  const [email, setEmail] = useState(project.customer_email ?? "");
  const [address, setAddress] = useState(project.project_address ?? project.address ?? "");
  const [type, setType] = useState(project.project_type ?? "");
  const [description, setDescription] = useState(project.project_description ?? "");
  const [status, setStatus] = useState(project.status);

  useEffect(() => {
    if (open) {
      setCustomerId(project.customer_id ?? UNASSIGNED);
      setName(project.customer_name ?? "");
      setPhone(project.customer_phone ?? "");
      setEmail(project.customer_email ?? "");
      setAddress(project.project_address ?? project.address ?? "");
      setType(project.project_type ?? "");
      setDescription(project.project_description ?? "");
      setStatus(project.status);
    }
  }, [open, project]);

  const saveMut = useMutation({
    mutationFn: async () => {
      const newCustomerId = customerId === UNASSIGNED ? null : customerId;
      const customerChanged = newCustomerId !== (project.customer_id ?? null);

      const { error } = await supabase
        .from("projects")
        .update({
          customer_id: newCustomerId,
          customer_name: name.trim() || null,
          customer_phone: phone.trim() || null,
          customer_email: email.trim() || null,
          project_address: address.trim() || null,
          address: address.trim() || null,
          project_type: type || null,
          project_description: description.trim() || null,
          status,
        })
        .eq("id", projectId);
      if (error) throw error;

      const events: { title: string; description: string }[] = [
        {
          title: "Banner details updated",
          description: "An admin updated the project and customer details for this project",
        },
      ];
      if (customerChanged) {
        const newName =
          customers.find((c) => c.id === newCustomerId)?.full_name ??
          customers.find((c) => c.id === newCustomerId)?.email ??
          (newCustomerId ? "a customer" : "no one");
        events.push({
          title: "Customer assigned to project changed",
          description: `The assigned customer was changed to ${newName}`,
        });
      }
      await supabase.from("project_timeline_events").insert(
        events.map((e) => ({
          project_id: projectId,
          category: "project",
          title: e.title,
          description: e.description,
        })),
      );
    },
    onSuccess: () => {
      toast.success("Customer info saved");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed to save"),
  });

  const emailOk = email.trim() === "" || isValidEmail(email);
  const phoneOk = phone.trim() === "" || isValidPhone(phone);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Edit Banner Details</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Project Type</Label>
            <Select value={type} onValueChange={setType}>
              <SelectTrigger><SelectValue placeholder="Select a type" /></SelectTrigger>
              <SelectContent>
                {PROJECT_TYPES.map((t) => (
                  <SelectItem key={t.value} value={t.value}>{t.label}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Job Description</Label>
            <Textarea rows={4} value={description} onChange={(e) => setDescription(e.target.value)} placeholder="Describe the job…" />
          </div>
          <div className="space-y-1.5">
            <Label>Project Status</Label>
            <Select value={status} onValueChange={setStatus}>
              <SelectTrigger><SelectValue /></SelectTrigger>
              <SelectContent>
                {PROJECT_STATUSES.map((s) => <SelectItem key={s} value={s}>{s}</SelectItem>)}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Assigned Customer</Label>
            <Select value={customerId} onValueChange={setCustomerId}>
              <SelectTrigger><SelectValue placeholder="Select a customer" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={UNASSIGNED}>Unassigned</SelectItem>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.full_name || "—"} — {c.email}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-1.5">
            <Label>Full Name</Label>
            <Input value={name} onChange={(e) => setName(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <Label>Phone Number</Label>
            <Input type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} />
            {!phoneOk && <p className="text-xs text-destructive">Enter a valid phone number.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Email Address</Label>
            <Input type="email" value={email} onChange={(e) => setEmail(e.target.value)} />
            {!emailOk && <p className="text-xs text-destructive">Enter a valid email address.</p>}
          </div>
          <div className="space-y-1.5">
            <Label>Project Address</Label>
            <Input value={address} onChange={(e) => setAddress(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button
            variant="hero"
            disabled={saveMut.isPending || !emailOk || !phoneOk}
            onClick={() => saveMut.mutate()}
          >
            {saveMut.isPending ? "Saving…" : "Save Banner Details"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
