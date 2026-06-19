import { CheckCircle2, Clock, AlertCircle } from "lucide-react";
import type { SelectionStatus } from "@/lib/constants";

const config: Record<
  SelectionStatus,
  { label: string; className: string; icon: typeof Clock }
> = {
  Pending: {
    label: "Pending",
    className: "bg-warning/15 text-[oklch(0.5_0.12_75)]",
    icon: Clock,
  },
  Approved: {
    label: "Approved",
    className: "bg-success/15 text-[oklch(0.45_0.13_150)]",
    icon: CheckCircle2,
  },
  "Change Requested": {
    label: "Change Requested",
    className: "bg-accent/15 text-[oklch(0.5_0.16_42)]",
    icon: AlertCircle,
  },
};

export function StatusBadge({ status }: { status: SelectionStatus }) {
  const c = config[status];
  const Icon = c.icon;
  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full px-2.5 py-1 text-xs font-semibold ${c.className}`}
    >
      <Icon className="h-3.5 w-3.5" />
      {c.label}
    </span>
  );
}