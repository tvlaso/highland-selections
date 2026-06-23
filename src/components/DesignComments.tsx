import { useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { MessageSquare } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";

export function DesignComments({
  designId,
  projectId,
}: {
  designId: string;
  projectId: string;
}) {
  const { session, role } = useAuth();
  const qc = useQueryClient();
  const [draft, setDraft] = useState("");

  const comments = useQuery({
    queryKey: ["design-comments", designId],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("design_comments")
        .select("*")
        .eq("design_id", designId)
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
      const { error } = await supabase.from("design_comments").insert({
        design_id: designId,
        project_id: projectId,
        author_id: session?.user?.id ?? null,
        author_name: authorName,
        body,
      });
      if (error) throw error;
    },
    onSuccess: () => {
      setDraft("");
      qc.invalidateQueries({ queryKey: ["design-comments", designId] });
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not add comment"),
  });

  return (
    <div className="space-y-3">
      <p className="flex items-center gap-1.5 text-sm font-semibold">
        <MessageSquare className="h-4 w-4 text-accent" /> Comments
      </p>
      <div className="space-y-2">
        {comments.isLoading ? (
          <p className="text-xs text-muted-foreground">Loading comments…</p>
        ) : (comments.data ?? []).length === 0 ? (
          <p className="text-xs text-muted-foreground">No comments yet.</p>
        ) : (
          comments.data!.map((c) => (
            <div key={c.id} className="rounded-md bg-secondary px-3 py-2">
              <p className="whitespace-pre-wrap text-sm text-foreground">{c.body}</p>
              <p className="mt-1 text-[11px] text-muted-foreground">
                {c.author_name} · {new Date(c.created_at).toLocaleString()}
              </p>
            </div>
          ))
        )}
      </div>
      <div className="space-y-2">
        <Textarea
          rows={2}
          placeholder="Leave a comment…"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={addMut.isPending || !draft.trim()}
          onClick={() => addMut.mutate(draft.trim())}
        >
          Add Comment
        </Button>
      </div>
    </div>
  );
}
