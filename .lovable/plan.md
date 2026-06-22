## Goal

Add three things without changing any existing behavior:
1. An **Export Selections List** button + unified PDF in both the customer (`/dashboard`) and admin (`/admin/$projectId`) views.
2. **Intelligent versioning** — version only changes when customer-visible exported content changes.
3. A permanent **Admin Timeline** audit panel on each Admin Job Dashboard.

Decisions confirmed: Manufacturer PDF reuses the existing product link (`product_url`); PDF is generated client-side; the Timeline only surfaces categories that exist today (All + Selections).

---

## 1. Database changes (migration)

**Add versioning columns to `projects`:**
- `selections_version` int NOT NULL default 0
- `selections_content_hash` text (nullable)
- `selections_version_updated_at` timestamptz (nullable) — this is the PDF's "Last modified timestamp"

**New table `public.project_timeline_events`** (immutable audit log):
- `id` uuid PK, `project_id` uuid FK → projects (cascade)
- `category` text NOT NULL (e.g. `selections`, `project`)
- `title` text NOT NULL
- `description` text
- `related_spec_card_id` uuid (nullable, references a selection option)
- `created_by` uuid (nullable)
- `created_at` timestamptz default now()

Grants + RLS:
- `GRANT SELECT, INSERT ON ... TO authenticated`, `GRANT ALL ... TO service_role` (no UPDATE/DELETE grant → immutable).
- RLS: admins (via `has_role`) can SELECT all events; a customer can SELECT events for their own project. INSERT allowed to authenticated. **No UPDATE/DELETE policies** so entries are permanent.

**Auto-event triggers** (so events are created automatically with `auth.uid()` as `created_by`):
- `projects` AFTER INSERT → "Project Created" (category `project`).
- `projects` AFTER UPDATE when `customer_id` becomes set → "Customer Invited".
- `project_selection_options` AFTER INSERT → "Spec Card Created" (category `selections`, `related_spec_card_id` = row id).
- `project_selection_options` AFTER UPDATE → "Customer Note Added" when `customer_notes` changes; otherwise "Spec Card Updated" on category/sort changes.

"Selections Version Updated" and "Selections Export Generated" events are inserted by the version-sync server function (below).

---

## 2. Intelligent versioning (server function)

New `src/lib/selections.functions.ts` → `syncSelectionsVersion` (`createServerFn`, `requireSupabaseAuth`). Called by both views right before generating the PDF.

Logic:
1. Load the project's selection options joined with catalog, ordered by category/sort.
2. Build a canonical string from **only customer-visible exported fields**: category, product_name, vendor, image_url (photo), product_url (manufacturer PDF), customer_notes. Hash it (stable hash).
3. Compare to `selections_content_hash`:
   - If different (or first export) → increment `selections_version` by 1, store new hash, set `selections_version_updated_at = now()`, and insert a "Selections Version Updated" timeline event.
   - If identical → keep version unchanged.
4. Always insert a "Selections Export Generated" timeline event.
5. Return `{ version, lastModified }` to the caller.

This guarantees: repeated downloads with no change keep the same version; cost/internal-note changes never affect it (they're not in the hash). Register the function's middleware needs (`attachSupabaseAuth` is already wired in `src/start.ts`).

---

## 3. Unified PDF export (client-side)

Add `jspdf` (`bun add jspdf`). New helper `src/lib/exportSelectionsPdf.ts` exporting `generateSelectionsPdf({ project, customerName, options, version, lastModified })` — identical output regardless of who triggers it.

PDF contents:
- **Header**: Highland Remodeling logo (from `highland-logo.png.asset.json`) + branding.
- **Meta block**: Project name, Customer name, Project address, Export version (`V{n}`), Last modified timestamp, Generated timestamp.
- **Body**: selections grouped by category (same `CATEGORIES` order). Each item: product photo (fetched via signed URL → dataURL, with graceful fallback if missing), product name, vendor, "Manufacturer PDF" link (`product_url`), customer notes.
- **Footer** on each page:
  ```
  Highland Remodeling
  Project: [Project Name]
  Selections Version: V[number]
  Generated: [date/time]
  This document reflects the approved selections at the time it was generated.
  ```
- **Excluded** (never rendered): status, cost/price, internal notes, purchase orders, vendor contacts, any admin-only fields.

Flow on button click (both views): call `syncSelectionsVersion` → get `{version, lastModified}` → build PDF → trigger download. Customer name resolved from the existing customer/profile data (admin already loads it; dashboard uses the project's customer profile).

---

## 4. UI wiring

**`src/routes/dashboard.tsx`** (customer): add an **Export Selections List** button in the "Your Selections" section header. No other behavior changes.

**`src/routes/admin.$projectId.tsx`** (admin/PM): add the same **Export Selections List** button in the "Selection Options" header row, alongside Catalog / Add from Catalog.

**Admin Timeline panel** (admin only) on `admin.$projectId.tsx`: a new section that queries `project_timeline_events` for the project, ordered newest first. Includes a filter control with **All** and **Selections** (only the categories that exist today). Each entry shows title, description, relative/absolute `created_at`, and who (created_by → resolved name where available). Entries are read-only.

---

## Out of scope / not changed
- No emailing of the PDF, no locking of selections.
- No removal/replacement of any existing selections, updates, or catalog functionality.
- Timeline filter categories for not-yet-built features (Documents, Expenses, Photos, Orders, Messages) are intentionally omitted for now.

## Technical notes
- New files: `src/lib/selections.functions.ts`, `src/lib/exportSelectionsPdf.ts`. New dependency: `jspdf`.
- Migration adds the 3 `projects` columns, the `project_timeline_events` table (+grants, RLS, triggers). The Supabase types file regenerates after the migration is approved; PDF/version code that relies on new columns is written after that.
- Versioning lives in a `requireSupabaseAuth` server function so both customers and admins can bump/read it under RLS without exposing service-role logic to the client.
