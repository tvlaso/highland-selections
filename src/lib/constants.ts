export const CATEGORIES = [
  "Shower",
  "Shower Glass",
  "Vanity",
  "Flooring",
  "Toilet",
  "Lighting",
  "Mirror",
  "Plumbing Trim",
  "Tubs",
  "Accessories",
] as const;

export type Category = (typeof CATEGORIES)[number];

export const PROJECT_STATUSES = [
  "New Request",
  "Active",
  "Planning",
  "In Progress",
  "Selections Due",
  "On Hold",
  "Completed",
  "Archived",
] as const;

export const PROJECT_TYPES = [
  { value: "bathroom_remodel", label: "Bathroom Remodel" },
  { value: "kitchen_remodel", label: "Kitchen Remodel" },
  { value: "flooring", label: "Flooring" },
  { value: "shower", label: "Shower" },
  { value: "handyman", label: "Handyman" },
] as const;

export type ProjectTypeValue = (typeof PROJECT_TYPES)[number]["value"];

export function projectTypeLabel(value: string | null | undefined) {
  if (!value) return null;
  return PROJECT_TYPES.find((t) => t.value === value)?.label ?? value;
}

export const CONTACT_METHODS = ["Phone", "Email", "Text"] as const;

export const TIMELINE_OPTIONS = [
  "As soon as possible",
  "1–3 months",
  "3–6 months",
  "6+ months",
  "Just planning",
] as const;

export const BUDGET_RANGES = [
  "Under $5,000",
  "$5,000 – $15,000",
  "$15,000 – $30,000",
  "$30,000 – $50,000",
  "$50,000+",
  "Not sure yet",
] as const;

export function formatCurrency(value: number | null | undefined) {
  if (value === null || value === undefined) return "—";
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0,
  }).format(value);
}

export function isValidEmail(value: string) {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

/** Accepts common phone formats with at least 10 digits. */
export function isValidPhone(value: string) {
  const digits = value.replace(/\D/g, "");
  return digits.length >= 10 && digits.length <= 15 && /^[0-9+()\-.\s]+$/.test(value.trim());
}