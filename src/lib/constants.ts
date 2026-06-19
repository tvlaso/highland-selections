export const CATEGORIES = [
  "Shower",
  "Vanity",
  "Flooring",
  "Toilet",
  "Lighting",
  "Mirror",
  "Plumbing Trim",
  "Accessories",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const SELECTION_STATUSES = ["Pending", "Approved", "Change Requested"] as const;
export type SelectionStatus = (typeof SELECTION_STATUSES)[number];

export const PROJECT_STATUSES = [
  "Planning",
  "In Progress",
  "Selections Due",
  "On Hold",
  "Completed",
] as const;

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}