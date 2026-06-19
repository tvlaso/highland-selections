import { useState } from "react";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "sonner";
import { ExternalLink, Check, MessageSquareWarning } from "lucide-react";
import { supabase } from "@/integrations/supabase/client";
import { SignedImage } from "@/components/SignedImage";
import { StatusBadge } from "@/components/StatusBadge";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency, type SelectionStatus } from "@/lib/constants";

export interface SelectionRow {
  id: string;
  item_name: string;
  category: string;
  image_url: string | null;
  product_link: string | null;
  allowance_price: number | null;
  actual_price: number | null;
  status: SelectionStatus;
  customer_notes: string | null;
  contractor_notes: string | null;
}

export function CustomerSelectionCard({ item }: { item: SelectionRow }) {
  const qc = useQueryClient();
  const [notes, setNotes] = useState(item.customer_notes ?? "");
  const [showChange, setShowChange] = useState(false);

  const mutation = useMutation({
    mutationFn: async (payload: { status: SelectionStatus; customer_notes: string }) => {
      const { error } = await supabase
        .from("selections")
        .update(payload)
        .eq("id", item.id);
      if (error) throw error;
    },
    onSuccess: (_d, vars) => {
      qc.invalidateQueries({ queryKey: ["customer-data"] });
      toast.success(
        vars.status === "Approved" ? "Selection approved!" : "Change request sent to your contractor.",
      );
      setShowChange(false);
    },
    onError: (e) => toast.error(e instanceof Error ? e.message : "Could not save"),
  });

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-card shadow-[var(--shadow-card)]">
      <div className="flex gap-3 p-3 sm:p-4">
        <SignedImage
          path={item.image_url}
          alt={item.item_name}
          className="h-24 w-24 shrink-0 rounded-lg object-cover sm:h-28 sm:w-28"
        />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-2">
            <h4 className="truncate font-semibold text-foreground">{item.item_name}</h4>
            <StatusBadge status={item.status} />
          </div>
          <div className="mt-1.5 flex flex-wrap gap-x-4 gap-y-0.5 text-sm">
            <span className="text-muted-foreground">
              Allowance: <span className="font-medium text-foreground">{formatCurrency(item.allowance_price)}</span>
            </span>
            <span className="text-muted-foreground">
              Actual: <span className="font-medium text-foreground">{formatCurrency(item.actual_price)}</span>
            </span>
          </div>
          {item.product_link && (
            <a
              href={item.product_link}
              target="_blank"
              rel="noreferrer"
              className="mt-1.5 inline-flex items-center gap-1 text-sm font-medium text-accent hover:underline"
            >
              View product <ExternalLink className="h-3.5 w-3.5" />
            </a>
          )}
        </div>
      </div>

      {item.contractor_notes && (
        <div className="mx-3 mb-3 rounded-lg bg-secondary p-2.5 text-sm sm:mx-4">
          <span className="font-semibold text-foreground">Note from Highland: </span>
          <span className="text-muted-foreground">{item.contractor_notes}</span>
        </div>
      )}

      <div className="border-t border-border p-3 sm:p-4">
        {showChange ? (
          <div className="space-y-2">
            <Textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Tell us what you'd like to change…"
              rows={3}
            />
            <div className="flex gap-2">
              <Button
                variant="orange"
                size="sm"
                disabled={mutation.isPending}
                onClick={() => mutation.mutate({ status: "Change Requested", customer_notes: notes })}
              >
                Send Request
              </Button>
              <Button variant="ghost" size="sm" onClick={() => setShowChange(false)}>
                Cancel
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex flex-wrap gap-2">
            <Button
              variant="success"
              size="sm"
              disabled={mutation.isPending || item.status === "Approved"}
              onClick={() => mutation.mutate({ status: "Approved", customer_notes: notes })}
            >
              <Check className="h-4 w-4" /> Approve
            </Button>
            <Button variant="outline" size="sm" onClick={() => setShowChange(true)}>
              <MessageSquareWarning className="h-4 w-4" /> Request Change
            </Button>
          </div>
        )}
        {item.customer_notes && !showChange && (
          <p className="mt-2 text-sm text-muted-foreground">
            <span className="font-medium text-foreground">Your note: </span>
            {item.customer_notes}
          </p>
        )}
      </div>
    </div>
  );
}