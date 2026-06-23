import { createFileRoute, useNavigate, Link } from "@tanstack/react-router";
import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ArrowLeft, Plus, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { AppHeader } from "@/components/AppHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Checkbox } from "@/components/ui/checkbox";
import { Progress } from "@/components/ui/progress";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { CATEGORIES } from "@/lib/constants";

export const Route = createFileRoute("/admin/checklist/$projectId")({
  head: () => ({ meta: [{ title: "Material Order Checklist | Highland Remodeling" }] }),
  component: ChecklistPage,
});

type ChecklistRow = {
  id: string;
  project_id: string;
  option_id: string | null;
  is_manual: boolean;
  material_name: string;
  category: string;
  ordered: boolean;
  notes: string | null;
};

type Item = {
  key: string;
  optionId: string | null;
  rowId: string | null;
  isManual: boolean;
  name: string;
  category: string;
  ordered: boolean;
  notes: string;
};

function ChecklistPage() {
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
    queryKey: ["checklist", projectId],
    enabled: role === "admin",
    queryFn: async () => {
      const [{ data: project }, { data: options }, { data: rows }] = await Promise.all([
        supabase.from("projects").select("id, name").eq("id", projectId).maybeSingle(),
        supabase
          .from("project_selection_options")
          .select("id, category, master_catalog(product_name, category)")
          .eq("project_id", projectId)
          .order("sort_order"),
        supabase
          .from("material_checklist_items")
          .select("*")
          .eq("project_id", projectId),
      ]);
      return {
        project,
        options: (options ?? []) as unknown as {
          id: string;
          category: string;
          master_catalog: { product_name: string; category: string } | null;
        }[],
        rows: (rows ?? []) as ChecklistRow[],
      };
    },
  });

  const items: Item[] = useMemo(() => {
    if (!data) return [];
    const rows = data.rows;
    const byOption = new Map(rows.filter((r) => r.option_id).map((r) => [r.option_id!, r]));
    const autoItems: Item[] = data.options.map((o) => {
      const row = byOption.get(o.id) ?? null;
      return {
        key: `opt-${o.id}`,
        optionId: o.id,
        rowId: row?.id ?? null,
        isManual: false,
        name: o.master_catalog?.product_name ?? "Unknown product",
        category: o.category || o.master_catalog?.category || "Uncategorized",
        ordered: row?.ordered ?? false,
        notes: row?.notes ?? "",
      };
    });
    const manualItems: Item[] = rows
      .filter((r) => r.is_manual)
      .map((r) => ({
        key: `man-${r.id}`,
        optionId: null,
        rowId: r.id,
        isManual: true,
        name: r.material_name,
        category: r.category || "Uncategorized",
        ordered: r.ordered,
        notes: r.notes ?? "",
      }));
    return [...autoItems, ...manualItems];
  }, [data]);

  const total = items.length;
  const orderedCount = items.filter((i) => i.ordered).length;
  const pct = total === 0 ? 0 : Math.round((orderedCount / total) * 100);

  const toggleMut = useMutation({
    mutationFn: async (item: Item) => {
      const next = !item.ordered;
      if (item.isManual && item.rowId) {
        const { error } = await supabase
          .from("material_checklist_items")
          .update({ ordered: next })
          .eq("id", item.rowId);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("material_checklist_items")
          .upsert(
            {
              project_id: projectId,
              option_id: item.optionId,
              is_manual: false,
              material_name: item.name,
              category: item.category,
              ordered: next,
              notes: item.notes || null,
            },
            { onConflict: "project_id,option_id" },
          );
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["checklist", projectId] }),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update"),
  });

  const saveNotes = async (item: Item, notes: string) => {
    if (item.isManual && item.rowId) {
      await supabase.from("material_checklist_items").update({ notes }).eq("id", item.rowId);
    } else {
      await supabase.from("material_checklist_items").upsert(
        {
          project_id: projectId,
          option_id: item.optionId,
          is_manual: false,
          material_name: item.name,
          category: item.category,
          ordered: item.ordered,
          notes,
        },
        { onConflict: "project_id,option_id" },
      );
    }
    qc.invalidateQueries({ queryKey: ["checklist", projectId] });
  };

  const deleteMut = useMutation({
    mutationFn: async (rowId: string) => {
      const { error } = await supabase.from("material_checklist_items").delete().eq("id", rowId);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", projectId] });
      toast.success("Material removed");
    },
  });

  // Add manual material
  const [newName, setNewName] = useState("");
  const [newCat, setNewCat] = useState<string>(CATEGORIES[0]);
  const addMut = useMutation({
    mutationFn: async () => {
      const { error } = await supabase.from("material_checklist_items").insert({
        project_id: projectId,
        option_id: null,
        is_manual: true,
        material_name: newName.trim(),
        category: newCat,
        ordered: false,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["checklist", projectId] });
      setNewName("");
      toast.success("Material added");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add"),
  });

  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <AppHeader subtitle="Contractor Admin" />
        <p className="p-10 text-center text-muted-foreground">Loading…</p>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-background">
      <AppHeader subtitle="Contractor Admin" />
      <main className="mx-auto max-w-3xl px-4 py-6">
        <Link
          to="/admin/$projectId"
          params={{ projectId }}
          className="mb-4 inline-flex items-center gap-1 text-sm font-medium text-muted-foreground hover:text-foreground"
        >
          <ArrowLeft className="h-4 w-4" /> Back to project
        </Link>

        <section className="rounded-2xl bg-[image:var(--gradient-navy)] p-6 text-[oklch(0.97_0.01_255)] shadow-[var(--shadow-soft)]">
          <h1 className="text-2xl font-bold text-[oklch(0.99_0.005_250)]">Material Order Checklist</h1>
          {data?.project?.name && (
            <p className="mt-1 text-sm text-[oklch(0.88_0.02_255)]">{data.project.name}</p>
          )}
          <div className="mt-4">
            <div className="mb-1.5 flex items-center justify-between text-sm font-medium text-[oklch(0.92_0.02_255)]">
              <span>Ordered {orderedCount} of {total} Materials</span>
              <span>{pct}%</span>
            </div>
            <Progress value={pct} className="bg-[oklch(0.4_0.05_255)]" />
          </div>
        </section>

        <section className="mt-6 rounded-2xl border border-border bg-card p-5 shadow-[var(--shadow-card)]">
          <h2 className="mb-3 text-sm font-bold uppercase tracking-wide">Add Material</h2>
          <div className="flex flex-wrap items-end gap-2">
            <div className="min-w-[180px] flex-1">
              <Input
                placeholder="Material name"
                value={newName}
                onChange={(e) => setNewName(e.target.value)}
              />
            </div>
            <Select value={newCat} onValueChange={setNewCat}>
              <SelectTrigger className="w-[160px]"><SelectValue /></SelectTrigger>
              <SelectContent>
                {CATEGORIES.map((c) => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              variant="hero"
              disabled={!newName.trim() || addMut.isPending}
              onClick={() => addMut.mutate()}
            >
              <Plus className="h-4 w-4" /> Add
            </Button>
          </div>
        </section>

        <div className="mt-6 space-y-3">
          {items.length === 0 ? (
            <p className="rounded-xl border border-dashed border-border p-8 text-center text-muted-foreground">
              No materials assigned to this project yet.
            </p>
          ) : (
            items.map((item) => (
              <ChecklistCard
                key={item.key}
                item={item}
                onToggle={() => toggleMut.mutate(item)}
                onSaveNotes={(notes) => saveNotes(item, notes)}
                onDelete={item.isManual && item.rowId ? () => deleteMut.mutate(item.rowId!) : undefined}
              />
            ))
          )}
        </div>
      </main>
    </div>
  );
}

function ChecklistCard({
  item,
  onToggle,
  onSaveNotes,
  onDelete,
}: {
  item: Item;
  onToggle: () => void;
  onSaveNotes: (notes: string) => void;
  onDelete?: () => void;
}) {
  const [notes, setNotes] = useState(item.notes);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    setNotes(item.notes);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [item.notes]);

  const handleChange = (val: string) => {
    setNotes(val);
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => {
      if (val !== item.notes) onSaveNotes(val);
    }, 700);
  };

  return (
    <div className="rounded-xl border border-border bg-card p-4 shadow-[var(--shadow-card)]">
      <div className="flex items-start gap-3">
        <Checkbox
          checked={item.ordered}
          onCheckedChange={onToggle}
          className="mt-1 h-5 w-5"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <h3 className={`font-semibold ${item.ordered ? "text-muted-foreground line-through" : ""}`}>
                {item.name}
              </h3>
              <span className="mt-1 inline-block rounded-full bg-secondary px-2.5 py-0.5 text-xs font-medium text-secondary-foreground">
                {item.category}
              </span>
              {item.isManual && (
                <span className="ml-2 text-xs text-muted-foreground">Manually added</span>
              )}
            </div>
            {onDelete && (
              <Button variant="ghost" size="icon" onClick={onDelete} aria-label="Delete material">
                <Trash2 className="h-4 w-4" />
              </Button>
            )}
          </div>
          <Textarea
            className="mt-3"
            placeholder="Order notes (PO #, vendor, ETA…)"
            value={notes}
            onChange={(e) => handleChange(e.target.value)}
            onBlur={() => {
              if (timer.current) clearTimeout(timer.current);
              if (notes !== item.notes) onSaveNotes(notes);
            }}
          />
        </div>
      </div>
    </div>
  );
}
