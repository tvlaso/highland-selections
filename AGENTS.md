<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

- Keep bathroom consultations separate from existing jobs and customer workflows, with admin-only RLS and protected routes; this avoids collecting customer data or changing selections behavior.
- Define bathroom formulas, conditional field definitions, and validated proposal snapshots in the bathroom model module; use that calculation for both internal prices and grouped PDF prices to avoid drift.
- Keep bathroom reference layouts and generated images in private storage, and generate reference-based edits through authenticated admin server functions; save immutable proposal snapshots with serialized version allocation.
