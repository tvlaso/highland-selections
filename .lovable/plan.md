Consolidate the customer-side selection card notes into a single section.

### Problem
In the customer dashboard each selection card currently shows two separate notes inputs/areas:
1. `SelectionNotes` component — threaded notes with an “Add Note” field.
2. A standalone `Textarea` labeled “Add a note for your contractor (optional)” directly above the Approve / Request Change buttons.

This is confusing for customers.

### Plan
1. Keep `SelectionNotes` as the only notes section on each customer selection card.
2. Remove the standalone customer-notes `Textarea` and its associated `noteDrafts` state from `src/routes/dashboard.tsx`.
3. Keep the Approve / Request Change action buttons.
4. Update the “Request Change” mutation so it no longer depends on the removed textarea; it will mark the option as `Change Requested` without requiring a separate customer_notes value.
5. Clean up related imports and state no longer needed.

### Files
- `src/routes/dashboard.tsx` — remove duplicate notes entry UI and simplify Request Change flow.

### Outcome
Customers see one clear notes/communication area per selection card while retaining the ability to approve or request changes.