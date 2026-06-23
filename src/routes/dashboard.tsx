import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { useServerFn } from "@tanstack/react-start";
import { toast } from "sonner";
import { MapPin, Calendar, Megaphone, ExternalLink, Check, MessageSquare, FileDown, ChevronRight, Plus, Images } from "lucide-react";
import { User, Phone, Mail } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { EnlargeableImage } from "@/components/EnlargeableImage";
import { ImageGallery } from "@/components/ImageGallery";
import { SelectionNotes } from "@/components/SelectionNotes";
import { StartProjectDialog } from "@/components/StartProjectDialog";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import { CATEGORIES, projectTypeLabel } from "@/lib/constants";
import { syncSelectionsVersion } from "@/lib/selections.functions";
import { generateSelectionsPdf } from "@/lib/exportSelectionsPdf";

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
  images: string[] | null;
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
  const syncVersion = useServerFn(syncSelectionsVersion);
  const [exporting, setExporting] = useState(false);
  const [tab, setTab] = useState<"current" | "completed">("current");
  const [selectedId, setSelectedId] = useState<string | null>(null);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "admin") navigate({ to: "/admin" });
  }, [session, role, loading, navigate]);

  const projectsQ = useQuery({
    queryKey: ["customer-projects", session?.user?.id],
    enabled: !!session && role === "customer",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("projects")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const allProjects = projectsQ.data ?? [];
  const currentProjects = allProjects.filter((p) => p.status !== "Completed");
  const completedProjects = allProjects.filter((p) => p.status === "Completed");
  const list = tab === "current" ? currentProjects : completedProjects;

  // default-select first project in the active tab
  useEffect(() => {
    if (list.length === 0) {
      setSelectedId(null);
    } else if (!selectedId || !list.some((p) => p.id === selectedId)) {
      setSelectedId(list[0].id);
    }
  }, [tab, list, selectedId]);

  const project = allProjects.find((p) => p.id === selectedId) ?? null;
  const isCompleted = project?.status === "Completed";

  const { data, isLoading } = useQuery({
    queryKey: ["customer-project-detail", selectedId],
    enabled: !!selectedId,
    queryFn: async () => {
      const [{ data: options }, { data: updates }] = await Promise.all([
        supabase
          .from("project_selection_options")
          .select("*, master_catalog(*)")
          .eq("project_id", selectedId!)
          .order("sort_order"),
        supabase
          .from("project_updates")
          .select("*")
          .eq("project_id", selectedId!)
          .order("created_at", { ascending: false }),
      ]);
      return {
        options: (options ?? []) as unknown as OptionRow[],
        updates: updates ?? [],
      };
    },
  });

  const options = data?.options ?? [];

  const handleExport = async () => {
    if (!project) return;
    setExporting(true);
    try {
      const { version, lastModified } = await syncVersion({
        data: { projectId: project.id },
      });
      await generateSelectionsPdf({
        projectName: project.name,
        customerName:
          (session?.user?.user_metadata?.full_name as string | undefined) ??
          session?.user?.email ??
          "—",
        address: project.address,
        version,
        lastModified,
        options: options.map((o) => ({
          id: o.id,
          category: o.category,
          customer_notes: o.customer_notes,
          master_catalog: o.master_catalog,
        })),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      setExporting(false);
    }
  };

  const approveMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_selection_options")
        .update({ status: "Approved", customer_notes: null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-project-detail"] });
      toast.success("Selection approved!");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not approve"),
  });

  const changeMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase
        .from("project_selection_options")
        .update({ status: "Change Requested" })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["customer-project-detail"] });
      toast.success("Change requested. Your contractor will be in touch.");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not submit"),
  });

  const categoriesWithOptions = useMemo(
    () => CATEGORIES.filter((cat) => options.some((o) => o.category === cat)),
    [options],
  );

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="My Project" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <div className="mb-6 flex items-center justify-between gap-3">
          <p className="text-2xl font-bold">My Projects</p>
          <StartProjectDialog
            onCreated={(id) => {
              setTab("current");
              setSelectedId(id);
            }}
            trigger={
              <Button variant="hero">
                <Plus className="h-4 w-4" /> Start New Project
              </Button>
            }
          />
        </div>
        {projectsQ.isLoading ? (
          <p className="py-20 text-center text-muted-foreground">Loading your projects…</p>
        ) : allProjects.length === 0 ? (
          <div className="rounded-2xl border border-border bg-card p-10 text-center shadow-[var(--shadow-card)]">
            <h2 className="text-xl font-semibold">No project yet</h2>
            <p className="mt-2 text-muted-foreground">
              Start a new project request above, or check back soon.
            </p>
          </div>
        ) : (
          <Tabs value={tab} onValueChange={(v) => setTab(v as "current" | "completed")}>
            <TabsList>
              <TabsTrigger value="current">Current Projects ({currentProjects.length})</TabsTrigger>
              <TabsTrigger value="completed">Completed Projects ({completedProjects.length})</TabsTrigger>
            </TabsList>

            {(["current", "completed"] as const).map((t) => (
              <TabsContent key={t} value={t} className="mt-6">
                {list.length === 0 ? (
                  <p className="rounded-xl border border-border bg-card p-6 text-center text-muted-foreground">
                    No {t === "current" ? "current" : "completed"} projects.
                  </p>
                ) : (
                  <>
                    {list.length > 1 && (
                      <div className="mb-6 flex flex-wrap gap-2">
                        {list.map((p) => (
                          <Button
                            key={p.id}
                            variant={p.id === selectedId ? "secondary" : "outline"}
                            size="sm"
                            onClick={() => setSelectedId(p.id)}
                          >
                            {p.name}
                            {p.id !== selectedId && <ChevronRight className="h-3.5 w-3.5" />}
                          </Button>
                        ))}
                      </div>
                    )}
                    {project && (
                      <ProjectView
                        project={project}
                        fallbackEmail={session?.user?.email ?? null}
                        isCompleted={isCompleted}
                        isLoading={isLoading}
                        updates={data?.updates ?? []}
                        options={options}
                        categoriesWithOptions={categoriesWithOptions}
                        exporting={exporting}
                        onExport={handleExport}
                        approveMut={approveMut}
                        changeMut={changeMut}
                      />
                    )}
                  </>
                )}
              </TabsContent>
            ))}
          </Tabs>
        )}
      </main>
    </div>
  );
}

function ProjectView({
  project,
  fallbackEmail,
  isCompleted,
  isLoading,
  updates,
  options,
  categoriesWithOptions,
  exporting,
  onExport,
  approveMut,
  changeMut,
}: {
  project: {
    id: string;
    name: string;
    status: string;
    address: string | null;
    start_date: string | null;
    project_type?: string | null;
    project_description?: string | null;
    project_address?: string | null;
    customer_name?: string | null;
    customer_phone?: string | null;
    customer_email?: string | null;
  };
  fallbackEmail: string | null;
  isCompleted: boolean;
  isLoading: boolean;
  updates: { id: string; title: string; body: string | null; created_at: string }[];
  options: OptionRow[];
  categoriesWithOptions: readonly string[];
  exporting: boolean;
  onExport: () => void;
  approveMut: ReturnType<typeof useMutation<void, Error, string>>;
  changeMut: ReturnType<typeof useMutation<void, Error, string>>;
}) {
  return (
    <>
      <section className="overflow-hidden rounded-2xl bg-[image:var(--gradient-navy)] p-6 text-[oklch(0.97_0.01_255)] shadow-[var(--shadow-soft)]">
        <div className="flex items-center justify-between gap-3">
          <h1 className="text-2xl font-bold text-[oklch(0.99_0.005_250)]">{project.name}</h1>
          <span className="rounded-full bg-accent px-3 py-1 text-sm font-semibold text-accent-foreground">
            {project.status}
          </span>
        </div>
        <div className="mt-3 flex flex-wrap gap-x-6 gap-y-1 text-sm text-[oklch(0.88_0.02_255)]">
          {project.project_type && (
            <span className="inline-flex items-center gap-1.5">
              {projectTypeLabel(project.project_type)}
            </span>
          )}
          <span className="inline-flex items-center gap-1.5">
            <User className="h-4 w-4" /> {project.customer_name || "Not provided"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Phone className="h-4 w-4" /> {project.customer_phone || "Not provided"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <Mail className="h-4 w-4" /> {project.customer_email || fallbackEmail || "Not provided"}
          </span>
          <span className="inline-flex items-center gap-1.5">
            <MapPin className="h-4 w-4" /> {project.project_address || project.address || "Not provided"}
          </span>
          {project.start_date && (
            <span className="inline-flex items-center gap-1.5">
              <Calendar className="h-4 w-4" /> Started{" "}
              {new Date(project.start_date).toLocaleDateString()}
            </span>
          )}
        </div>
      </section>

      {project.project_description && (
        <section className="mt-4 rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
          <h2 className="mb-1 text-sm font-semibold">Project Description</h2>
          <p className="whitespace-pre-wrap text-sm text-muted-foreground">{project.project_description}</p>
        </section>
      )}

      {isCompleted && (
        <p className="mt-4 rounded-lg border border-border bg-secondary px-4 py-2 text-sm text-muted-foreground">
          This project is complete. Your selections are shown here for reference (read-only).
        </p>
      )}

      <div className="mt-4">
        <Button variant="outline" asChild>
          <Link to="/designs/$projectId" params={{ projectId: project.id }}>
            <Images className="h-4 w-4" /> View Designs
          </Link>
        </Button>
      </div>

      {updates.length > 0 && (
        <section className="mt-6">
          <h2 className="mb-3 flex items-center gap-2 text-lg font-semibold">
            <Megaphone className="h-5 w-5 text-accent" /> Project Updates
          </h2>
          <div className="space-y-3">
            {updates.map((u) => (
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
        <div className="mb-1 flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-lg font-semibold">Your Selections</h2>
          <Button variant="outline" size="sm" disabled={exporting || options.length === 0} onClick={onExport}>
            <FileDown className="h-4 w-4" />
            {exporting ? "Exporting…" : "Export Selections List"}
          </Button>
        </div>
        <p className="mb-4 text-sm text-muted-foreground">
          {isCompleted
            ? "These are the final approved selections for your completed project."
            : "Review each selection and approve it, or request a change with a note."}
        </p>
        {isLoading ? (
          <p className="py-10 text-center text-muted-foreground">Loading selections…</p>
        ) : options.length === 0 ? (
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
                            approved ? "border-success" : changeRequested ? "border-accent" : "border-border"
                          }`}
                        >
                          <div className="flex gap-3 p-3">
                            <ImageGallery
                              images={c?.images?.length ? c.images : [c?.image_url ?? null]}
                              alt={c?.product_name ?? ""}
                              className="h-24 w-24 shrink-0 rounded-lg"
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
                                  Manufacturer PDF <ExternalLink className="h-3.5 w-3.5" />
                                </a>
                              )}
                            </div>
                          </div>
                          <div className="space-y-3 border-t border-border p-3">
                            <SelectionNotes optionId={o.id} projectId={project.id} readOnly={isCompleted} />
                            {!isCompleted && (
                              <div className="space-y-2 border-t border-border pt-3">
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
                                    onClick={() => changeMut.mutate(o.id)}
                                  >
                                    <MessageSquare className="h-4 w-4" /> Request Change
                                  </Button>
                                </div>
                              </div>
                            )}
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
  );
}
