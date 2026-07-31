import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2, FileDown, LayoutTemplate, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { ImageGallery } from "@/components/ImageGallery";
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
  DialogTrigger,
} from "@/components/ui/dialog";
import { CATEGORIES } from "@/lib/constants";
import { generateSelectionsPdf } from "@/lib/exportSelectionsPdf";

export const Route = createFileRoute("/admin/templates")({
  head: () => ({
    meta: [
      { title: "Selection Templates | Highland Remodeling" },
      {
        name: "description",
        content:
          "Build reusable selection templates from the master catalog and export them without customer information.",
      },
      { property: "og:title", content: "Selection Templates | Highland Remodeling" },
      {
        property: "og:description",
        content: "Reusable selection templates for Highland Remodeling projects.",
      },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary" },
    ],
  }),
  component: TemplatesPage,
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

type TemplateItem = {
  id: string;
  template_id: string;
  catalog_item_id: string;
  category: string;
  notes: string | null;
  sort_order: number;
  master_catalog: CatalogItem | null;
};

function TemplatesPage() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [newOpen, setNewOpen] = useState(false);
  const [tName, setTName] = useState("");
  const [tDesc, setTDesc] = useState("");
  const [addOpen, setAddOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "customer") navigate({ to: "/dashboard" });
  }, [session, role, loading, navigate]);

  const templates = useQuery({
    queryKey: ["selection-templates"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("selection_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const activeId = selectedId ?? templates.data?.[0]?.id ?? null;
  const active = (templates.data ?? []).find((t) => t.id === activeId) ?? null;

  const items = useQuery({
    queryKey: ["selection-template-items", activeId],
    enabled: !!activeId,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("selection_template_items")
        .select("*, master_catalog(*)")
        .eq("template_id", activeId!)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as TemplateItem[];
    },
  });

  const createMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase
        .from("selection_templates")
        .insert({ name: tName.trim(), description: tDesc.trim() || null });
      if (error) throw error;
    },
    onSuccess: () => {
      toast.success("Template created");
      setNewOpen(false);
      setTName("");
      setTDesc("");
      qc.invalidateQueries({ queryKey: ["selection-templates"] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const deleteTemplateMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("selection_templates").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: (_d, id) => {
      if (activeId === id) setSelectedId(null);
      qc.invalidateQueries({ queryKey: ["selection-templates"] });
      toast.success("Template deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const removeItemMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("selection_template_items").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["selection-template-items", activeId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const notesMut = useMutation({
    mutationFn: async ({ id, notes }: { id: string; notes: string }) => {
      const { error } = await supabase
        .from("selection_template_items")
        .update({ notes: notes || null })
        .eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["selection-template-items", activeId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const handleExport = async () => {
    if (!active) return;
    setExporting(true);
    try {
      await generateSelectionsPdf({
        projectName: active.name,
        hideCustomerInfo: true,
        title: "Selections Template",
        options: (items.data ?? []).map((i) => ({
          id: i.id,
          category: i.category,
          customer_notes: i.notes,
          master_catalog: i.master_catalog,
        })),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      setExporting(false);
    }
  };

  const list = items.data ?? [];

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link
          to="/admin"
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <h1 className="text-2xl font-bold">Selection Templates</h1>
          <Dialog open={newOpen} onOpenChange={setNewOpen}>
            <DialogTrigger asChild>
              <Button variant="hero">
                <Plus className="h-4 w-4" /> New Template
              </Button>
            </DialogTrigger>
            <DialogContent>
              <DialogHeader>
                <DialogTitle>New Selection Template</DialogTitle>
              </DialogHeader>
              <div className="space-y-3">
                <div className="space-y-1.5">
                  <Label>Template name</Label>
                  <Input
                    value={tName}
                    onChange={(e) => setTName(e.target.value)}
                    placeholder="Standard Master Bath"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label>Description</Label>
                  <Textarea value={tDesc} onChange={(e) => setTDesc(e.target.value)} rows={3} />
                </div>
              </div>
              <DialogFooter>
                <Button
                  variant="hero"
                  disabled={createMut.isPending || !tName.trim()}
                  onClick={() => createMut.mutate()}
                >
                  Create Template
                </Button>
              </DialogFooter>
            </DialogContent>
          </Dialog>
        </div>

        <p className="mt-1 text-sm text-muted-foreground">
          Templates are reusable selection lists. Their export never includes customer information.
        </p>

        <div className="mt-6 grid gap-6 md:grid-cols-[240px_1fr]">
          <aside className="space-y-2">
            {templates.isLoading ? (
              <p className="text-sm text-muted-foreground">Loading…</p>
            ) : (templates.data ?? []).length === 0 ? (
              <div className="rounded-xl border border-dashed border-border p-6 text-center">
                <LayoutTemplate className="mx-auto h-8 w-8 text-muted-foreground/50" />
                <p className="mt-2 text-sm text-muted-foreground">No templates yet.</p>
              </div>
            ) : (
              (templates.data ?? []).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setSelectedId(t.id)}
                  className={`w-full rounded-xl border p-3 text-left transition-colors ${
                    t.id === activeId
                      ? "border-accent bg-card"
                      : "border-border bg-card hover:border-accent"
                  }`}
                >
                  <p className="truncate font-semibold">{t.name}</p>
                  {t.description && (
                    <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                  )}
                </button>
              ))
            )}
          </aside>

          <section>
            {!active ? (
              <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                Create a template to get started.
              </p>
            ) : (
              <>
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="min-w-0">
                    <h2 className="truncate text-lg font-semibold">{active.name}</h2>
                    {active.description && (
                      <p className="text-sm text-muted-foreground">{active.description}</p>
                    )}
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={exporting || list.length === 0}
                      onClick={handleExport}
                    >
                      <FileDown className="h-4 w-4" /> {exporting ? "Exporting…" : "Export Selections List"}
                    </Button>
                    <Button variant="hero" size="sm" onClick={() => setAddOpen(true)}>
                      <Plus className="h-4 w-4" /> Add from Catalog
                    </Button>
                    <Button
                      variant="ghost"
                      size="sm"
                      disabled={deleteTemplateMut.isPending}
                      onClick={() => deleteTemplateMut.mutate(active.id)}
                    >
                      <Trash2 className="h-4 w-4 text-destructive" />
                    </Button>
                  </div>
                </div>

                <div className="mt-4 space-y-6">
                  {CATEGORIES.filter((cat) => list.some((i) => i.category === cat)).map((cat) => (
                    <div key={cat}>
                      <h3 className="mb-2 border-l-4 border-accent pl-3 text-sm font-bold uppercase tracking-wide">
                        {cat}
                      </h3>
                      <div className="space-y-2">
                        {list
                          .filter((i) => i.category === cat)
                          .map((i) => {
                            const c = i.master_catalog;
                            return (
                              <div
                                key={i.id}
                                className="rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]"
                              >
                                <div className="flex gap-3">
                                  <ImageGallery
                                    images={c?.images?.length ? c.images : [c?.image_url ?? null]}
                                    alt={c?.product_name ?? ""}
                                    className="h-16 w-16 shrink-0 rounded-lg"
                                  />
                                  <div className="min-w-0 flex-1">
                                    <div className="flex items-start justify-between gap-2">
                                      <h4 className="truncate font-semibold">
                                        {c?.product_name ?? "Unknown product"}
                                      </h4>
                                      <Button
                                        variant="ghost"
                                        size="sm"
                                        onClick={() => removeItemMut.mutate(i.id)}
                                      >
                                        <Trash2 className="h-4 w-4 text-destructive" />
                                      </Button>
                                    </div>
                                    {c?.vendor && (
                                      <p className="text-sm text-muted-foreground">{c.vendor}</p>
                                    )}
                                    {c?.product_url && (
                                      <a
                                        href={c.product_url}
                                        target="_blank"
                                        rel="noreferrer"
                                        className="inline-flex items-center gap-1 text-sm text-accent hover:underline"
                                      >
                                        Manufacturer PDF <ExternalLink className="h-3 w-3" />
                                      </a>
                                    )}
                                    <Textarea
                                      className="mt-2"
                                      rows={2}
                                      placeholder="Template notes (appear on the export)"
                                      defaultValue={i.notes ?? ""}
                                      onBlur={(e) => {
                                        if ((i.notes ?? "") !== e.target.value)
                                          notesMut.mutate({ id: i.id, notes: e.target.value });
                                      }}
                                    />
                                  </div>
                                </div>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  ))}
                  {list.length === 0 && (
                    <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
                      No products in this template yet.
                    </p>
                  )}
                </div>
              </>
            )}
          </section>
        </div>

        {active && (
          <AddToTemplateDialog
            templateId={active.id}
            open={addOpen}
            onOpenChange={setAddOpen}
            existingCatalogIds={list.map((i) => i.catalog_item_id)}
            nextSortOrder={list.length + 1}
          />
        )}
      </main>
    </div>
  );
}

function AddToTemplateDialog({
  templateId,
  open,
  onOpenChange,
  existingCatalogIds,
  nextSortOrder,
}: {
  templateId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingCatalogIds: string[];
  nextSortOrder: number;
}) {
  const qc = useQueryClient();
  const [search, setSearch] = useState("");

  const { data: catalog, isLoading } = useQuery({
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
      return data as unknown as CatalogItem[];
    },
  });

  const addMut = useMutation({
    mutationFn: async (item: CatalogItem) => {
      const { error } = await supabase.from("selection_template_items").insert({
        template_id: templateId,
        catalog_item_id: item.id,
        category: item.category,
        sort_order: nextSortOrder,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["selection-template-items", templateId] });
      toast.success("Added to template");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return (catalog ?? []).filter((i) => {
      if (existingCatalogIds.includes(i.id)) return false;
      if (!q) return true;
      return (
        i.product_name.toLowerCase().includes(q) ||
        i.category.toLowerCase().includes(q) ||
        (i.vendor ?? "").toLowerCase().includes(q)
      );
    });
  }, [catalog, search, existingCatalogIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Add from Master Catalog</DialogTitle>
        </DialogHeader>
        <Input
          placeholder="Search products…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />
        <div className="mt-2 space-y-2">
          {isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading catalog…</p>
          ) : filtered.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No products available.</p>
          ) : (
            filtered.map((i) => (
              <div
                key={i.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-card p-2.5"
              >
                <SignedImage
                  path={i.image_url}
                  alt={i.product_name}
                  className="h-12 w-12 shrink-0 rounded-lg object-cover"
                />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{i.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">
                    {i.category}
                    {i.vendor ? ` · ${i.vendor}` : ""}
                  </p>
                </div>
                <Button
                  variant="orange"
                  size="sm"
                  disabled={addMut.isPending}
                  onClick={() => addMut.mutate(i)}
                >
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
