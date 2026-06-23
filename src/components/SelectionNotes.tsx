import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
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
          notes.data!.map((n) => (
            <div key={n.id} className="rounded-md bg-secondary px-3 py-2">
              <p className="text-sm text-foreground whitespace-pre-wrap">{n.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {n.author_name} · {new Date(n.created_at).toLocaleString()}
              </p>
            </div>
          ))
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
