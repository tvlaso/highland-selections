import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare, Pencil, Trash2 } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function SelectionNotes({
  optionId,
  projectId,
  readOnly = false,
}: {
  optionId: string;
  projectId: string;
  readOnly?: boolean;
}) {
  const { session, role } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState("");

  const notes = useQuery({
    queryKey: ["selection-notes", optionId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("selection_notes")
        .select("*")
        .eq("option_id", optionId)
        .order("created_at", { ascending: true });
      if (error) throw error;
      return data ?? [];
    },
  });

  const addMut = useMutation({
    mutationFn: async (body: string) => {
      const authorName =
        (session?.user?.user_metadata?.full_name as string | undefined) ||
        session?.user?.email ||
        (role === "admin" ? "Admin" : "Customer");
      const { error } = await supabase.from("selection_notes").insert({
        option_id: optionId,
        project_id: projectId,
        author_id: session?.user?.id ?? null,
        author_name: authorName,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["selection-notes", optionId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add note"),
  });

  const editMut = useMutation({
    mutationFn: async ({ id, body }: { id: string; body: string }) => {
      const { error } = await supabase.from("selection_notes").update({ body }).eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      setEditingId(null);
      setEditDraft("");
      qc.invalidateQueries({ queryKey: ["selection-notes", optionId] });
      toast.success("Note updated");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not update note"),
  });

  const deleteMut = useMutation({
    mutationFn: async (id: string) => {
      const { error } = await supabase.from("selection_notes").delete().eq("id", id);
      if (error) throw error;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["selection-notes", optionId] });
      toast.success("Note deleted");
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not delete note"),
  });

  const startEdit = (id: string, body: string) => {
    setEditingId(id);
    setEditDraft(body);
  };

  return (
    <div className="space-y-2">
      <p className="flex items-center gap-1.5 text-xs font-semibold uppercase tracking-wide text-muted-foreground">
        <MessageSquare className="h-3.5 w-3.5" /> Notes
      </p>
      <div className="space-y-1.5">
        {notes.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading notes…</p>
        ) : (notes.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No notes yet.</p>
        ) : (
          notes.data!.map((n) => {
            const isMine = !!session?.user?.id && n.author_id === session.user.id;
            const isEditing = editingId === n.id;
            return (
              <div key={n.id} className="rounded-md bg-secondary px-3 py-2">
                {isEditing ? (
                  <div className="space-y-2">
                    <Textarea
                      rows={2}
                      value={editDraft}
                      onChange={(e) => setEditDraft(e.target.value)}
                    />
                    <div className="flex gap-2">
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={editMut.isPending || !editDraft.trim()}
                        onClick={() => editMut.mutate({ id: n.id, body: editDraft.trim() })}
                      >
                        Save
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => {
                          setEditingId(null);
                          setEditDraft("");
                        }}
                      >
                        Cancel
                      </Button>
                    </div>
                  </div>
                ) : (
                  <>
                    <p className="text-sm text-foreground whitespace-pre-wrap">{n.body}</p>
                    <div className="mt-1 flex items-center justify-between gap-2">
                      <p className="text-[11px] text-muted-foreground">
                        {n.author_name} · {new Date(n.created_at).toLocaleString()}
                      </p>
                      {isMine && !readOnly && (
                        <div className="flex gap-1">
                          <button
                            type="button"
                            aria-label="Edit note"
                            className="text-muted-foreground hover:text-foreground"
                            onClick={() => startEdit(n.id, n.body)}
                          >
                            <Pencil className="h-3.5 w-3.5" />
                          </button>
                          <button
                            type="button"
                            aria-label="Delete note"
                            className="text-muted-foreground hover:text-destructive"
                            disabled={deleteMut.isPending}
                            onClick={() => deleteMut.mutate(n.id)}
                          >
                            <Trash2 className="h-3.5 w-3.5" />
                          </button>
                        </div>
                      )}
                    </div>
                  </>
                )}
              </div>
            );
          })
        )}
      </div>
      {!readOnly && (
        <div className="space-y-2">
          <Textarea
            rows={2}
            placeholder="Add a note…"
            value={draft}
            onChange={(e) => setDraft(e.target.value)}
          />
          <Button
            variant="outline"
            size="sm"
            disabled={addMut.isPending || !draft.trim()}
            onClick={() => addMut.mutate(draft.trim())}
          >
            Add Note
          </Button>
        </div>
      )}
    </div>
  );
}
