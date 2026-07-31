
function ApplyTemplateDialog({
  projectId,
  open,
  onOpenChange,
  existingCatalogIds,
  nextSortOrder,
}: {
  projectId: string;
  open: boolean;
  onOpenChange: (v: boolean) => void;
  existingCatalogIds: string[];
  nextSortOrder: number;
}) {
  const qc = useQueryClient();

  const templates = useQuery({
    queryKey: ["selection-templates"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("selection_templates")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data ?? [];
    },
  });

  const applyMut = useMutation({
    mutationFn: async (templateId: string) => {
      const { data: items, error } = await supabase
        .from("selection_template_items")
        .select("catalog_item_id, category, notes, sort_order")
        .eq("template_id", templateId)
        .order("sort_order");
      if (error) throw error;
      const rows = (items ?? [])
        .filter((i) => !existingCatalogIds.includes(i.catalog_item_id))
        .map((i, idx) => ({
          project_id: projectId,
          catalog_item_id: i.catalog_item_id,
          category: i.category,
          sort_order: nextSortOrder + idx,
        }));
      if (rows.length === 0) return 0;
      const { error: insErr } = await supabase.from("project_selection_options").insert(rows);
      if (insErr) throw insErr;
      return rows.length;
    },
    onSuccess: (count) => {
      qc.invalidateQueries({ queryKey: ["admin-project", projectId] });
      toast.success(count ? `Added ${count} selection${count === 1 ? "" : "s"}` : "Nothing new to add");
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Failed"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Apply Selection Template</DialogTitle>
        </DialogHeader>
        <div className="space-y-2">
          {templates.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading templates…</p>
          ) : (templates.data ?? []).length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">
              No templates yet. Create one in Templates.
            </p>
          ) : (
            (templates.data ?? []).map((t) => (
              <div key={t.id} className="flex items-center gap-3 rounded-xl border border-border bg-card p-3">
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-semibold">{t.name}</p>
                  {t.description && (
                    <p className="truncate text-xs text-muted-foreground">{t.description}</p>
                  )}
                </div>
                <Button
                  variant="orange"
                  size="sm"
                  disabled={applyMut.isPending}
                  onClick={() => applyMut.mutate(t.id)}
                >
                  <Plus className="h-4 w-4" /> Apply
                </Button>
              </div>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
