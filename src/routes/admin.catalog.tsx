import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Pencil, Trash2, ExternalLink } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { SignedImage } from "@/components/SignedImage";
import { CatalogDialog, type EditableCatalogItem } from "@/components/CatalogDialog";
import { Button } from "@/components/ui/button";
import { CATEGORIES, formatCurrency } from "@/lib/constants";

export const Route = createFileRoute("/admin/catalog")({
  head: () => ({ meta: [{ title: "Master Catalog | Highland Remodeling" }] }),
  component: CatalogPage,
});

function CatalogPage() {
  const { session, role, loading } = useAuth();
  const navigate = useNavigate();
  const qc = useQueryClient();

  useEffect(() => {
    if (loading) return;
    if (!session) navigate({ to: "/auth" });
    else if (role === "customer") navigate({ to: "/dashboard" });
  }, [session, role, loading, navigate]);

  const { data: items, isLoading } = useQuery({
    queryKey: ["catalog"],
    enabled: role === "admin",
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_catalog")
        .select("*")
        .order("category")
        .order("product_name");
      if (error) throw error;
      return data;
    },
  });

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing] = useState<EditableCatalogItem | undefined>();

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("master_catalog").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["catalog"] });
      toast.success("Product removed from catalog");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-5xl px-4 py-6">
        <Link to="/admin" className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground">
          <ArrowLeft className="h-4 w-4" /> All projects
        </Link>

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div>
            <h1 className="text-2xl font-bold">Master Catalog</h1>
            <p className="text-sm text-muted-foreground">A reusable product library you can add to any project.</p>
          </div>
          <Button variant="hero" onClick={() => { setEditing(undefined); setDialogOpen(true); }}>
            <Plus className="h-4 w-4" /> Add Product
          </Button>
        </div>

        {isLoading ? (
          <p className="mt-8 text-center text-muted-foreground">Loading…</p>
        ) : (items ?? []).length === 0 ? (
          <div className="mt-8 rounded-2xl border border-dashed border-border bg-card p-10 text-center">
            <p className="font-medium">No products yet</p>
            <p className="text-sm text-muted-foreground">Add your first product to build your catalog.</p>
          </div>
        ) : (
          <div className="mt-6 space-y-6">
            {CATEGORIES.filter((cat) => (items ?? []).some((i) => i.category === cat)).map((cat) => (
              <div key={cat}>
                <h3 className="mb-2 border-l-4 border-accent pl-3 text-sm font-bold uppercase tracking-wide">{cat}</h3>
                <div className="space-y-2">
                  {(items ?? []).filter((i) => i.category === cat).map((i) => (
                    <div key={i.id} className="flex gap-3 rounded-xl border border-border bg-card p-3 shadow-[var(--shadow-card)]">
                      <SignedImage path={i.image_url} alt={i.product_name} className="h-16 w-16 shrink-0 rounded-lg object-cover" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-start justify-between gap-2">
                          <h4 className="truncate font-semibold">{i.product_name}</h4>
                          {!i.active && (
                            <span className="shrink-0 rounded-full bg-secondary px-2 py-0.5 text-xs font-semibold text-muted-foreground">Inactive</span>
                          )}
                        </div>
                        <p className="text-sm text-muted-foreground">
                          {i.vendor ? `${i.vendor} · ` : ""}{formatCurrency(i.price)}
                        </p>
                        {i.description && <p className="mt-0.5 line-clamp-2 text-sm text-muted-foreground">{i.description}</p>}
                        {i.product_url && (
                          <a href={i.product_url} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 text-sm text-accent hover:underline">
                            Product <ExternalLink className="h-3 w-3" />
                          </a>
                        )}
                        <div className="mt-2 flex gap-1">
                          <Button variant="outline" size="sm" onClick={() => { setEditing(i as EditableCatalogItem); setDialogOpen(true); }}>
                            <Pencil className="h-3.5 w-3.5" /> Edit
                          </Button>
                          <Button variant="ghost" size="sm" onClick={() => deleteMut.mutate(i.id)}>
                            <Trash2 className="h-3.5 w-3.5 text-destructive" />
                          </Button>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            ))}
          </div>
        )}

        <CatalogDialog open={dialogOpen} onOpenChange={setDialogOpen} existing={editing} />
      </main>
    </div>
  );
}