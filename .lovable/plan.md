## Problem

On the admin Projects list (`/admin`), each project's customer name is resolved by looking the project's `customer_id` up in a *separately-loaded* customers list. When the projects query resolves before the customers query, the lookup fails and every project briefly (or, on slow/mobile connections, persistently) shows **"Unassigned"** — even though a customer is assigned in the database.

## Fix

In `src/routes/admin.index.tsx`:

1. **Don't show "Unassigned" while customers are still loading.** Update the name helper / render so that:
   - If a project has no `customer_id` → show "Unassigned" (correct).
   - If a `customer_id` exists but the customers list hasn't loaded yet (`customers.isLoading` or no data) → show a neutral placeholder ("Loading…" / a small skeleton) instead of "Unassigned".
   - Only show "Unassigned" when customers have loaded AND no match is found.

2. **Surface a real failure** if `listCustomers` errors (e.g. show a small inline error / toast) so an actual fetch failure isn't silently rendered as "Unassigned".

### Technical detail

```ts
const customerName = (id: string | null) => {
  if (!id) return "Unassigned";
  if (customers.isLoading || !customers.data) return "…";
  return customers.data.find((c) => c.id === id)?.full_name ?? "Unassigned";
};
```

No database or schema changes are required — the data is correct. This is purely a frontend display fix.

## Verification

- Load `/admin` and confirm project rows show the correct customer names (Alla Vlasovets, Thomas Vlasovets) with no "Unassigned" flash.
- Throttle the network and confirm a neutral placeholder shows during load instead of "Unassigned".
