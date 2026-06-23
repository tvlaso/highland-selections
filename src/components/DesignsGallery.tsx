import { useMemo, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Plus,
  Trash2,
  Copy,
  ArrowUp,
  ArrowDown,
  Pencil,
  FileDown,
  History,
  Upload,
  Star,
  X,
  ImageIcon,
  FileText,
  Link2,
  Calendar,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { DesignComments } from "@/components/DesignComments";
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

type Photo = { id: string; path: string; sort_order: number };
type FileRow = { id: string; path: string; name: string };
type DesignProduct = {
  id: string;
  catalog_item_id: string;
  master_catalog: {
    id: string;
    product_name: string;
    vendor: string | null;
    category: string;
    image_url: string | null;
  } | null;
};
type Version = { id: string; label: string | null; snapshot: unknown; created_at: string };

type DesignRow = {
  id: string;
  project_id: string;
  title: string;
  category: string;
  notes: string | null;
  cover_path: string | null;
  sort_order: number;
  created_at: string;
  updated_at: string;
  design_photos: Photo[];
  design_products?: { id: string }[];
  design_files?: { id: string }[];
};

async function uploadAsset(file: File, designId: string, folder: string) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `designs/${designId}/${folder}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("design-assets")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

export function DesignsGallery({
  projectId,
  projectName,
  isAdmin,
}: {
  projectId: string;
  projectName: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const [formOpen, setFormOpen] = useState(false);
  const [editing, setEditing] = useState<DesignRow | null>(null);
  const [openId, setOpenId] = useState<string | null>(null);

  const designsQ = useQuery({
    queryKey: ["designs", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("*, design_photos(id,path,sort_order), design_products(id), design_files(id)")
        .eq("project_id", projectId)
        .order("sort_order");
      if (error) throw error;
      return (data ?? []) as unknown as DesignRow[];
    },
  });

  const designs = designsQ.data ?? [];

  const reorderMut = useMutation({
    mutationFn: async (rows: { id: string; sort_order: number }[]) => {
      for (const r of rows) {
        const { error } = await supabase
          .from("designs")
          .update({ sort_order: r.sort_order })
          .eq("id", r.id);
        if (error) throw error;
      }
    },
    onSuccess: () => qc.invalidateQueries({ queryKey: ["designs", projectId] }),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("designs").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["designs", projectId] });
      toast.success("Design deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete"),
  });

  const duplicateMut = useMutation({
    mutationFn: async (id: string) => {
      const { data: src, error: e1 } = await supabase
        .from("designs")
        .select("*, design_photos(*), design_products(*), design_files(*)")
        .eq("id", id)
        .single();
      if (e1) throw e1;
      const maxOrder = Math.max(0, ...designs.map((d) => d.sort_order));
      const { data: created, error: e2 } = await supabase
        .from("designs")
        .insert({
          project_id: projectId,
          title: `${src.title} (Copy)`,
          category: src.category,
          notes: src.notes,
          cover_path: src.cover_path,
          sort_order: maxOrder + 1,
        })
        .select()
        .single();
      if (e2) throw e2;
      const photos = (src.design_photos ?? []) as Photo[];
      if (photos.length)
        await supabase
          .from("design_photos")
          .insert(photos.map((p) => ({ design_id: created.id, path: p.path, sort_order: p.sort_order })));
      const products = (src.design_products ?? []) as { catalog_item_id: string }[];
      if (products.length)
        await supabase
          .from("design_products")
          .insert(products.map((p) => ({ design_id: created.id, catalog_item_id: p.catalog_item_id })));
      const files = (src.design_files ?? []) as FileRow[];
      if (files.length)
        await supabase
          .from("design_files")
          .insert(files.map((f) => ({ design_id: created.id, path: f.path, name: f.name })));
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["designs", projectId] });
      toast.success("Design duplicated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not duplicate"),
  });

  const move = (index: number, dir: -1 | 1) => {
    const target = index + dir;
    if (target < 0 || target >= designs.length) return;
    const a = designs[index];
    const b = designs[target];
    reorderMut.mutate([
      { id: a.id, sort_order: b.sort_order },
      { id: b.id, sort_order: a.sort_order },
    ]);
  };

  return (
    <section>
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-lg font-semibold">Designs</h2>
        {isAdmin && (
          <Button
            variant="hero"
            size="sm"
            onClick={() => {
              setEditing(null);
              setFormOpen(true);
            }}
          >
            <Plus className="h-4 w-4" /> Add Design
          </Button>
        )}
      </div>

      {designsQ.isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Loading designs…</p>
      ) : designs.length === 0 ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          No designs yet.{isAdmin ? " Add your first design board above." : ""}
        </div>
      ) : (
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
          {designs.map((d, idx) => {
            const cover = d.cover_path ?? d.design_photos?.[0]?.path ?? null;
            const photoCount = d.design_photos?.length ?? 0;
            return (
              <div
                key={d.id}
                className="group flex flex-col overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)] transition-shadow hover:shadow-[var(--shadow-soft)]"
              >
                <button
                  type="button"
                  onClick={() => setOpenId(d.id)}
                  className="relative block aspect-[4/3] w-full overflow-hidden bg-muted"
                >
                  <SignedImage path={cover} alt={d.title} className="h-full w-full object-cover" />
                  <span className="absolute bottom-2 right-2 inline-flex items-center gap-1 rounded-full bg-background/85 px-2 py-0.5 text-xs font-medium text-foreground">
                    <ImageIcon className="h-3 w-3" /> {photoCount}
                  </span>
                </button>
                <div className="flex flex-1 flex-col p-3">
                  <button
                    type="button"
                    onClick={() => setOpenId(d.id)}
                    className="text-left"
                  >
                    <h3 className="truncate font-semibold">{d.title}</h3>
                    <p className="text-xs uppercase tracking-wide text-muted-foreground">{d.category}</p>
                  </button>
                  {d.notes && (
                    <p className="mt-1 line-clamp-2 text-sm text-muted-foreground">{d.notes}</p>
                  )}
                  {isAdmin && (
                    <div className="mt-3 flex flex-wrap items-center gap-1 border-t border-border pt-2">
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(idx, -1)} disabled={idx === 0}>
                        <ArrowUp className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => move(idx, 1)} disabled={idx === designs.length - 1}>
                        <ArrowDown className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8"
                        onClick={() => {
                          setEditing(d);
                          setFormOpen(true);
                        }}
                      >
                        <Pencil className="h-4 w-4" />
                      </Button>
                      <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => duplicateMut.mutate(d.id)}>
                        <Copy className="h-4 w-4" />
                      </Button>
                      <Button
                        variant="ghost"
                        size="icon"
                        className="h-8 w-8 text-destructive"
                        onClick={() => {
                          if (confirm(`Delete "${d.title}"?`)) deleteMut.mutate(d.id);
                        }}
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {isAdmin && (
        <DesignFormDialog
          open={formOpen}
          onOpenChange={setFormOpen}
          projectId={projectId}
          existing={editing}
          nextOrder={Math.max(0, ...designs.map((d) => d.sort_order)) + 1}
          onSaved={() => qc.invalidateQueries({ queryKey: ["designs", projectId] })}
        />
      )}

      {openId && (
        <DesignDetailDialog
          designId={openId}
          projectId={projectId}
          projectName={projectName}
          isAdmin={isAdmin}
          open={!!openId}
          onOpenChange={(v) => !v && setOpenId(null)}
        />
      )}
    </section>
  );
}

function DesignFormDialog({
  open,
  onOpenChange,
  projectId,
  existing,
  nextOrder,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  projectId: string;
  existing: DesignRow | null;
  nextOrder: number;
  onSaved: () => void;
}) {
  const [title, setTitle] = useState("");
  const [category, setCategory] = useState("");
  const [notes, setNotes] = useState("");

  // sync form when dialog opens
  const lastOpen = useRef(false);
  if (open && !lastOpen.current) {
    lastOpen.current = true;
    setTitle(existing?.title ?? "");
    setCategory(existing?.category ?? "General");
    setNotes(existing?.notes ?? "");
  }
  if (!open && lastOpen.current) lastOpen.current = false;

  const saveMut = useMutation({
    mutationFn: async () => {
      const payload = { title: title.trim() || "Untitled Design", category: category.trim() || "General", notes: notes.trim() || null };
      if (existing) {
        const { error } = await supabase.from("designs").update(payload).eq("id", existing.id);
        if (error) throw error;
      } else {
        const { error } = await supabase
          .from("designs")
          .insert({ ...payload, project_id: projectId, sort_order: nextOrder });
        if (error) throw error;
      }
    },
    onSuccess: () => {
      toast.success(existing ? "Design updated" : "Design created");
      onSaved();
      onOpenChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>{existing ? "Edit Design" : "New Design"}</DialogTitle>
        </DialogHeader>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <Label>Title</Label>
            <Input value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Master Bath Concept" />
          </div>
          <div className="space-y-1.5">
            <Label>Category</Label>
            <Input value={category} onChange={(e) => setCategory(e.target.value)} placeholder="e.g. Shower, Vanity, Lighting" />
          </div>
          <div className="space-y-1.5">
            <Label>Notes</Label>
            <Textarea rows={4} value={notes} onChange={(e) => setNotes(e.target.value)} placeholder="Design notes…" />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
          <Button variant="hero" disabled={saveMut.isPending} onClick={() => saveMut.mutate()}>
            {saveMut.isPending ? "Saving…" : "Save"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

type DetailData = DesignRow & {
  design_files: FileRow[];
  design_products: DesignProduct[];
  design_versions: Version[];
};

function DesignDetailDialog({
  designId,
  projectId,
  projectName,
  isAdmin,
  open,
  onOpenChange,
}: {
  designId: string;
  projectId: string;
  projectName: string;
  isAdmin: boolean;
  open: boolean;
  onOpenChange: (v: boolean) => void;
}) {
  const qc = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);
  const [showVersions, setShowVersions] = useState(false);
  const [pickerOpen, setPickerOpen] = useState(false);
  const [exporting, setExporting] = useState(false);

  const detailQ = useQuery({
    queryKey: ["design-detail", designId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select(
          "*, design_photos(*), design_files(*), design_products(*, master_catalog(id,product_name,vendor,category,image_url)), design_versions(id,label,snapshot,created_at)",
        )
        .eq("id", designId)
        .single();
      if (error) throw error;
      const d = data as unknown as DetailData;
      d.design_photos = [...(d.design_photos ?? [])].sort((a, b) => a.sort_order - b.sort_order);
      d.design_versions = [...(d.design_versions ?? [])].sort(
        (a, b) => +new Date(b.created_at) - +new Date(a.created_at),
      );
      return d;
    },
  });

  const invalidate = () => {
    qc.invalidateQueries({ queryKey: ["design-detail", designId] });
    qc.invalidateQueries({ queryKey: ["designs", projectId] });
  };

  const d = detailQ.data;

  const handlePhotoFiles = async (files: FileList | File[]) => {
    if (!d) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setUploading(true);
    try {
      let order = Math.max(0, ...d.design_photos.map((p) => p.sort_order));
      const rows: { design_id: string; path: string; sort_order: number }[] = [];
      for (const f of arr) {
        const path = await uploadAsset(f, designId, "photos");
        rows.push({ design_id: designId, path, sort_order: ++order });
      }
      const { error } = await supabase.from("design_photos").insert(rows);
      if (error) throw error;
      if (!d.cover_path && rows[0]) {
        await supabase.from("designs").update({ cover_path: rows[0].path }).eq("id", designId);
      }
      invalidate();
      toast.success(`${rows.length} photo${rows.length > 1 ? "s" : ""} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const handleFileAttach = async (files: FileList | File[]) => {
    if (!d) return;
    const arr = Array.from(files);
    if (arr.length === 0) return;
    setUploading(true);
    try {
      const rows: { design_id: string; path: string; name: string }[] = [];
      for (const f of arr) {
        const path = await uploadAsset(f, designId, "files");
        rows.push({ design_id: designId, path, name: f.name });
      }
      const { error } = await supabase.from("design_files").insert(rows);
      if (error) throw error;
      invalidate();
      toast.success("Attachment added");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const setCover = useMutation({
    mutationFn: async (path: string) => {
      const { error } = await supabase.from("designs").update({ cover_path: path }).eq("id", designId);
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Cover photo set");
    },
  });

  const deletePhoto = useMutation({
    mutationFn: async (photo: Photo) => {
      const { error } = await supabase.from("design_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("design-assets").remove([photo.path]);
      if (d?.cover_path === photo.path) {
        const remaining = d.design_photos.filter((p) => p.id !== photo.id);
        await supabase
          .from("designs")
          .update({ cover_path: remaining[0]?.path ?? null })
          .eq("id", designId);
      }
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete photo"),
  });

  const deleteFile = useMutation({
    mutationFn: async (f: FileRow) => {
      const { error } = await supabase.from("design_files").delete().eq("id", f.id);
      if (error) throw error;
      await supabase.storage.from("design-assets").remove([f.path]);
    },
    onSuccess: () => invalidate(),
  });

  const removeProduct = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("design_products").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => invalidate(),
  });

  const saveVersion = useMutation({
    mutationFn: async () => {
      if (!d) return;
      const snapshot = {
        title: d.title,
        category: d.category,
        notes: d.notes,
        cover_path: d.cover_path,
        photos: d.design_photos.map((p) => p.path),
        products: d.design_products.map((p) => p.master_catalog?.product_name ?? p.catalog_item_id),
      };
      const { error } = await supabase.from("design_versions").insert({
        design_id: designId,
        label: `${d.design_photos.length} photos · ${d.design_products.length} products`,
        snapshot,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      invalidate();
      toast.success("Version saved to history");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save version"),
  });

  const openFile = async (path: string) => {
    const { data } = await supabase.storage.from("design-assets").createSignedUrl(path, 3600);
    if (data?.signedUrl) window.open(data.signedUrl, "_blank");
  };

  const handleExport = async () => {
    if (!d) return;
    setExporting(true);
    try {
      const { generateDesignPdf } = await import("@/lib/exportDesignPdf");
      await generateDesignPdf({
        projectName,
        title: d.title,
        category: d.category,
        notes: d.notes,
        createdAt: d.created_at,
        updatedAt: d.updated_at,
        coverPath: d.cover_path,
        photoPaths: d.design_photos.map((p) => p.path),
        products: d.design_products.map((p) => ({
          product_name: p.master_catalog?.product_name ?? "Product",
          vendor: p.master_catalog?.vendor ?? null,
          category: p.master_catalog?.category ?? null,
        })),
      });
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Could not export PDF");
    } finally {
      setExporting(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] max-w-4xl overflow-y-auto">
        {!d ? (
          <p className="py-10 text-center text-muted-foreground">Loading…</p>
        ) : (
          <>
            <DialogHeader>
              <DialogTitle className="pr-8">{d.title}</DialogTitle>
            </DialogHeader>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
              <span className="rounded-full bg-secondary px-2.5 py-0.5 font-medium uppercase tracking-wide text-secondary-foreground">
                {d.category}
              </span>
              <span className="inline-flex items-center gap-1">
                <Calendar className="h-3.5 w-3.5" /> Created {new Date(d.created_at).toLocaleDateString()}
              </span>
              <span className="inline-flex items-center gap-1">
                Updated {new Date(d.updated_at).toLocaleDateString()}
              </span>
            </div>

            <div className="mt-2 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" disabled={exporting} onClick={handleExport}>
                <FileDown className="h-4 w-4" /> {exporting ? "Exporting…" : "Export PDF"}
              </Button>
              {isAdmin && (
                <>
                  <Button variant="outline" size="sm" onClick={() => saveVersion.mutate()}>
                    <History className="h-4 w-4" /> Save Version
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => setShowVersions((v) => !v)}>
                    <History className="h-4 w-4" /> History ({d.design_versions.length})
                  </Button>
                </>
              )}
            </div>

            {showVersions && (
              <div className="rounded-lg border border-border bg-secondary/50 p-3">
                <p className="mb-2 text-sm font-semibold">Version History</p>
                {d.design_versions.length === 0 ? (
                  <p className="text-xs text-muted-foreground">No versions saved yet.</p>
                ) : (
                  <ul className="space-y-1.5">
                    {d.design_versions.map((v) => (
                      <li key={v.id} className="flex items-center justify-between gap-2 text-xs">
                        <span className="text-muted-foreground">
                          {new Date(v.created_at).toLocaleString()}
                        </span>
                        <span className="text-foreground">{v.label}</span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            )}

            {/* Photo gallery */}
            <div>
              {isAdmin && (
                <div
                  onDragOver={(e) => {
                    e.preventDefault();
                    setDragOver(true);
                  }}
                  onDragLeave={() => setDragOver(false)}
                  onDrop={(e) => {
                    e.preventDefault();
                    setDragOver(false);
                    handlePhotoFiles(e.dataTransfer.files);
                  }}
                  className={`mb-3 flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-4 text-center text-sm transition-colors ${
                    dragOver ? "border-accent bg-accent/10" : "border-border"
                  }`}
                >
                  <Upload className="mb-1 h-5 w-5 text-muted-foreground" />
                  <p className="text-muted-foreground">
                    Drag &amp; drop images here, or{" "}
                    <button
                      type="button"
                      className="font-medium text-accent underline"
                      onClick={() => photoInputRef.current?.click()}
                    >
                      browse
                    </button>
                  </p>
                  {uploading && <p className="mt-1 text-xs text-muted-foreground">Uploading…</p>}
                  <input
                    ref={photoInputRef}
                    type="file"
                    accept="image/*"
                    multiple
                    className="hidden"
                    onChange={(e) => e.target.files && handlePhotoFiles(e.target.files)}
                  />
                </div>
              )}

              {d.design_photos.length === 0 ? (
                <p className="rounded-lg border border-border bg-card p-6 text-center text-sm text-muted-foreground">
                  No photos yet.
                </p>
              ) : (
                <div className="grid grid-cols-2 gap-2 sm:grid-cols-3">
                  {d.design_photos.map((p) => (
                    <div key={p.id} className="group relative aspect-square overflow-hidden rounded-lg bg-muted">
                      <button type="button" className="block h-full w-full" onClick={() => setLightbox(p.path)}>
                        <SignedImage path={p.path} alt={d.title} className="h-full w-full object-cover" />
                      </button>
                      {d.cover_path === p.path && (
                        <span className="absolute left-1.5 top-1.5 inline-flex items-center gap-1 rounded-full bg-accent px-2 py-0.5 text-[10px] font-semibold text-accent-foreground">
                          <Star className="h-3 w-3" /> Cover
                        </span>
                      )}
                      {isAdmin && (
                        <div className="absolute right-1.5 top-1.5 flex gap-1 opacity-0 transition-opacity group-hover:opacity-100">
                          {d.cover_path !== p.path && (
                            <button
                              type="button"
                              title="Set as cover"
                              className="rounded-full bg-background/90 p-1 text-foreground hover:bg-background"
                              onClick={() => setCover.mutate(p.path)}
                            >
                              <Star className="h-3.5 w-3.5" />
                            </button>
                          )}
                          <button
                            type="button"
                            title="Delete photo"
                            className="rounded-full bg-background/90 p-1 text-destructive hover:bg-background"
                            onClick={() => deletePhoto.mutate(p)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Notes */}
            {d.notes && (
              <div>
                <p className="mb-1 text-sm font-semibold">Notes</p>
                <p className="whitespace-pre-wrap text-sm text-muted-foreground">{d.notes}</p>
              </div>
            )}

            {/* Linked products */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <Link2 className="h-4 w-4 text-accent" /> Linked Products
                </p>
                {isAdmin && (
                  <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
                    <Plus className="h-4 w-4" /> Link Product
                  </Button>
                )}
              </div>
              {d.design_products.length === 0 ? (
                <p className="text-xs text-muted-foreground">No products linked.</p>
              ) : (
                <div className="grid gap-2 sm:grid-cols-2">
                  {d.design_products.map((p) => (
                    <div key={p.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2">
                      <SignedImage
                        path={p.master_catalog?.image_url ?? null}
                        alt={p.master_catalog?.product_name ?? ""}
                        className="h-10 w-10 shrink-0 rounded-md object-cover"
                      />
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-sm font-medium">{p.master_catalog?.product_name}</p>
                        <p className="truncate text-xs text-muted-foreground">
                          {p.master_catalog?.vendor ?? p.master_catalog?.category}
                        </p>
                      </div>
                      {isAdmin && (
                        <button
                          type="button"
                          className="text-muted-foreground hover:text-destructive"
                          onClick={() => removeProduct.mutate(p.id)}
                        >
                          <X className="h-4 w-4" />
                        </button>
                      )}
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Attachments */}
            <div>
              <div className="mb-2 flex items-center justify-between">
                <p className="flex items-center gap-1.5 text-sm font-semibold">
                  <FileText className="h-4 w-4 text-accent" /> Attachments
                </p>
                {isAdmin && (
                  <>
                    <Button variant="outline" size="sm" onClick={() => fileInputRef.current?.click()}>
                      <Upload className="h-4 w-4" /> Add File
                    </Button>
                    <input
                      ref={fileInputRef}
                      type="file"
                      accept=".pdf,application/pdf,image/*"
                      multiple
                      className="hidden"
                      onChange={(e) => e.target.files && handleFileAttach(e.target.files)}
                    />
                  </>
                )}
              </div>
              {d.design_files.length === 0 ? (
                <p className="text-xs text-muted-foreground">No attachments.</p>
              ) : (
                <ul className="space-y-1.5">
                  {d.design_files.map((f) => (
                    <li key={f.id} className="flex items-center gap-2 rounded-lg border border-border bg-card p-2 text-sm">
                      <FileText className="h-4 w-4 shrink-0 text-muted-foreground" />
                      <button type="button" className="min-w-0 flex-1 truncate text-left hover:underline" onClick={() => openFile(f.path)}>
                        {f.name}
                      </button>
                      {isAdmin && (
                        <button type="button" className="text-muted-foreground hover:text-destructive" onClick={() => deleteFile.mutate(f)}>
                          <Trash2 className="h-4 w-4" />
                        </button>
                      )}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <div className="border-t border-border pt-4">
              <DesignComments designId={designId} projectId={projectId} />
            </div>
          </>
        )}
      </DialogContent>

      {lightbox && (
        <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
          <DialogContent className="max-w-3xl p-2">
            <SignedImage path={lightbox} alt="design photo" className="max-h-[80vh] w-full rounded-lg object-contain" />
          </DialogContent>
        </Dialog>
      )}

      {pickerOpen && (
        <ProductPickerDialog
          open={pickerOpen}
          onOpenChange={setPickerOpen}
          designId={designId}
          existingIds={(d?.design_products ?? []).map((p) => p.catalog_item_id)}
          onLinked={invalidate}
        />
      )}
    </Dialog>
  );
}

function ProductPickerDialog({
  open,
  onOpenChange,
  designId,
  existingIds,
  onLinked,
}: {
  open: boolean;
  onOpenChange: (v: boolean) => void;
  designId: string;
  existingIds: string[];
  onLinked: () => void;
}) {
  const [search, setSearch] = useState("");

  const catalogQ = useQuery({
    queryKey: ["catalog-picker"],
    enabled: open,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("master_catalog")
        .select("id, product_name, vendor, category, image_url")
        .eq("active", true)
        .order("product_name");
      if (error) throw error;
      return data ?? [];
    },
  });

  const linkMut = useMutation({
    mutationFn: async (catalogId: string) => {
      const { error } = await supabase
        .from("design_products")
        .insert({ design_id: designId, catalog_item_id: catalogId });
      if (error) throw error;
    },
    onSuccess: () => {
      onLinked();
      toast.success("Product linked");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not link"),
  });

  const items = useMemo(() => {
    const all = catalogQ.data ?? [];
    const q = search.trim().toLowerCase();
    return all
      .filter((i) => !existingIds.includes(i.id))
      .filter(
        (i) =>
          !q ||
          i.product_name.toLowerCase().includes(q) ||
          (i.vendor ?? "").toLowerCase().includes(q) ||
          i.category.toLowerCase().includes(q),
      );
  }, [catalogQ.data, search, existingIds]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[85vh] overflow-hidden">
        <DialogHeader>
          <DialogTitle>Link a Product</DialogTitle>
        </DialogHeader>
        <Input placeholder="Search catalog…" value={search} onChange={(e) => setSearch(e.target.value)} />
        <div className="mt-2 max-h-[55vh] space-y-1.5 overflow-y-auto">
          {catalogQ.isLoading ? (
            <p className="py-6 text-center text-sm text-muted-foreground">Loading catalog…</p>
          ) : items.length === 0 ? (
            <p className="py-6 text-center text-sm text-muted-foreground">No products found.</p>
          ) : (
            items.map((i) => (
              <button
                key={i.id}
                type="button"
                disabled={linkMut.isPending}
                onClick={() => linkMut.mutate(i.id)}
                className="flex w-full items-center gap-2 rounded-lg border border-border bg-card p-2 text-left hover:bg-secondary"
              >
                <SignedImage path={i.image_url} alt={i.product_name} className="h-10 w-10 shrink-0 rounded-md object-cover" />
                <div className="min-w-0 flex-1">
                  <p className="truncate text-sm font-medium">{i.product_name}</p>
                  <p className="truncate text-xs text-muted-foreground">{i.vendor ?? i.category}</p>
                </div>
                <Plus className="h-4 w-4 shrink-0 text-accent" />
              </button>
            ))
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
