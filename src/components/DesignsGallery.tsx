import { useEffect, useRef, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import {
  Trash2,
  Upload,
  Bold,
  List,
  Link2,
  Loader2,
} from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent } from "@/components/ui/dialog";

type Photo = { id: string; path: string; sort_order: number };

type Board = {
  id: string;
  project_id: string;
  notes: string | null;
  design_photos: Photo[];
};

async function uploadAsset(file: File, designId: string) {
  const ext = file.name.split(".").pop()?.toLowerCase().replace(/[^a-z0-9]/g, "") || "bin";
  const path = `designs/${designId}/photos/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage
    .from("design-assets")
    .upload(path, file, { contentType: file.type || undefined, upsert: false });
  if (error) throw error;
  return path;
}

export function DesignsGallery({
  projectId,
  isAdmin,
}: {
  projectId: string;
  projectName?: string;
  isAdmin: boolean;
}) {
  const qc = useQueryClient();
  const photoInputRef = useRef<HTMLInputElement>(null);
  const [uploading, setUploading] = useState(false);
  const [dragOver, setDragOver] = useState(false);
  const [lightbox, setLightbox] = useState<string | null>(null);

  const boardQ = useQuery({
    queryKey: ["design-board", projectId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("designs")
        .select("id, project_id, notes, design_photos(id,path,sort_order)")
        .eq("project_id", projectId)
        .order("created_at")
        .limit(1);
      if (error) throw error;
      let board = (data?.[0] as unknown as Board) ?? null;
      if (!board && isAdmin) {
        const { data: created, error: cErr } = await supabase
          .from("designs")
          .insert({ project_id: projectId, title: "Inspiration Board", category: "General", sort_order: 0 })
          .select("id, project_id, notes")
          .single();
        if (cErr) throw cErr;
        board = { ...(created as Board), design_photos: [] };
      }
      if (board) {
        board.design_photos = [...(board.design_photos ?? [])].sort(
          (a, b) => a.sort_order - b.sort_order,
        );
      }
      return board;
    },
  });

  const board = boardQ.data;
  const invalidate = () => qc.invalidateQueries({ queryKey: ["design-board", projectId] });

  const handlePhotoFiles = async (files: FileList | File[]) => {
    if (!board) return;
    const arr = Array.from(files).filter((f) => f.type.startsWith("image/"));
    if (arr.length === 0) return;
    setUploading(true);
    try {
      let order = Math.max(0, ...board.design_photos.map((p) => p.sort_order));
      const rows: { design_id: string; path: string; sort_order: number }[] = [];
      for (const f of arr) {
        const path = await uploadAsset(f, board.id);
        rows.push({ design_id: board.id, path, sort_order: ++order });
      }
      const { error } = await supabase.from("design_photos").insert(rows);
      if (error) throw error;
      invalidate();
      toast.success(`${rows.length} photo${rows.length > 1 ? "s" : ""} uploaded`);
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(false);
    }
  };

  const deletePhoto = useMutation({
    mutationFn: async (photo: Photo) => {
      const { error } = await supabase.from("design_photos").delete().eq("id", photo.id);
      if (error) throw error;
      await supabase.storage.from("design-assets").remove([photo.path]);
    },
    onSuccess: () => invalidate(),
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete photo"),
  });

  return (
    <section className="space-y-6">
      {boardQ.isLoading ? (
        <p className="py-10 text-center text-muted-foreground">Loading…</p>
      ) : !board ? (
        <div className="rounded-xl border border-border bg-card p-10 text-center text-muted-foreground">
          No inspiration board yet.
        </div>
      ) : (
        <>
          {/* Upload */}
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
              className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-6 text-center text-sm transition-colors ${
                dragOver ? "border-accent bg-accent/10" : "border-border"
              }`}
            >
              <Upload className="mb-1 h-6 w-6 text-muted-foreground" />
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

          {/* Gallery */}
          {board.design_photos.length === 0 ? (
            <p className="rounded-lg border border-border bg-card p-8 text-center text-sm text-muted-foreground">
              No photos yet.{isAdmin ? " Upload images to start your board." : ""}
            </p>
          ) : (
            <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
              {board.design_photos.map((p) => (
                <div
                  key={p.id}
                  className="group relative aspect-square overflow-hidden rounded-lg bg-muted shadow-[var(--shadow-card)]"
                >
                  <button
                    type="button"
                    className="block h-full w-full"
                    onClick={() => setLightbox(p.path)}
                  >
                    <SignedImage path={p.path} alt="design" className="h-full w-full object-cover" />
                  </button>
                  {isAdmin && (
                    <button
                      type="button"
                      title="Delete photo"
                      className="absolute right-1.5 top-1.5 rounded-full bg-background/90 p-1.5 text-destructive opacity-0 transition-opacity hover:bg-background group-hover:opacity-100"
                      onClick={() => deletePhoto.mutate(p)}
                    >
                      <Trash2 className="h-4 w-4" />
                    </button>
                  )}
                </div>
              ))}
            </div>
          )}

          {/* Notes */}
          <NotesEditor designId={board.id} initialNotes={board.notes} isAdmin={isAdmin} />
        </>
      )}

      {lightbox && (
        <Dialog open={!!lightbox} onOpenChange={(v) => !v && setLightbox(null)}>
          <DialogContent className="max-w-4xl p-2">
            <SignedImage
              path={lightbox}
              alt="design photo"
              className="max-h-[85vh] w-full rounded-lg object-contain"
            />
          </DialogContent>
        </Dialog>
      )}
    </section>
  );
}

function NotesEditor({
  designId,
  initialNotes,
  isAdmin,
}: {
  designId: string;
  initialNotes: string | null;
  isAdmin: boolean;
}) {
  const editorRef = useRef<HTMLDivElement>(null);
  const [status, setStatus] = useState<"idle" | "saving" | "saved">("idle");
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Initialize content once
  useEffect(() => {
    if (editorRef.current && editorRef.current.innerHTML === "") {
      editorRef.current.innerHTML = initialNotes ?? "";
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [designId]);

  const persist = async (html: string) => {
    setStatus("saving");
    const { error } = await supabase.from("designs").update({ notes: html }).eq("id", designId);
    if (error) {
      toast.error("Could not save notes");
      setStatus("idle");
      return;
    }
    setStatus("saved");
    setTimeout(() => setStatus("idle"), 1500);
  };

  const scheduleSave = () => {
    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      if (editorRef.current) persist(editorRef.current.innerHTML);
    }, 800);
  };

  const exec = (cmd: string, value?: string) => {
    editorRef.current?.focus();
    document.execCommand(cmd, false, value);
    scheduleSave();
  };

  const addLink = () => {
    const url = window.prompt("Enter URL");
    if (url) exec("createLink", url);
  };

  if (!isAdmin) {
    return (
      <div>
        <h3 className="mb-2 text-lg font-semibold">Notes</h3>
        {initialNotes ? (
          <div
            className="prose-sm max-w-none rounded-lg border border-border bg-card p-4 text-sm text-foreground [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5"
            dangerouslySetInnerHTML={{ __html: initialNotes }}
          />
        ) : (
          <p className="rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
            No notes yet.
          </p>
        )}
      </div>
    );
  }

  return (
    <div>
      <div className="mb-2 flex items-center justify-between">
        <h3 className="text-lg font-semibold">Notes</h3>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          {status === "saving" && (
            <>
              <Loader2 className="h-3 w-3 animate-spin" /> Saving…
            </>
          )}
          {status === "saved" && "Saved"}
        </span>
      </div>
      <div className="rounded-lg border border-border bg-card">
        <div className="flex items-center gap-1 border-b border-border p-1.5">
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={() => exec("bold")} title="Bold">
            <Bold className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            variant="ghost"
            size="icon"
            className="h-8 w-8"
            onClick={() => exec("insertUnorderedList")}
            title="Bullet list"
          >
            <List className="h-4 w-4" />
          </Button>
          <Button type="button" variant="ghost" size="icon" className="h-8 w-8" onClick={addLink} title="Add link">
            <Link2 className="h-4 w-4" />
          </Button>
        </div>
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={scheduleSave}
          onBlur={() => editorRef.current && persist(editorRef.current.innerHTML)}
          data-placeholder="Add notes, ideas, links…"
          className="min-h-[160px] w-full px-4 py-3 text-sm leading-relaxed text-foreground outline-none [&_a]:text-accent [&_a]:underline [&_ul]:list-disc [&_ul]:pl-5 empty:before:text-muted-foreground empty:before:content-[attr(data-placeholder)]"
        />
      </div>
    </div>
  );
}
