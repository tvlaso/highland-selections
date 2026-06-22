import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

/**
 * Synchronizes the customer-visible selections "export version" for a project.
 *
 * The version increments by 1 ONLY when customer-visible exported content
 * changes (category, product name, vendor, photo, manufacturer PDF link,
 * customer notes). Internal-only fields (cost, status, internal notes) are
 * deliberately excluded from the fingerprint, so they never bump the version.
 *
 * Always logs a "Selections Export Generated" timeline event, and a
 * "Selections Version Updated" event when the version actually changes.
 */
export const syncSelectionsVersion = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z.object({ projectId: z.string().uuid() }).parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabase, userId } = context;
    const { projectId } = data;

    const { data: project, error: pErr } = await supabase
      .from("projects")
      .select("id, selections_version, selections_content_hash, selections_version_updated_at")
      .eq("id", projectId)
      .maybeSingle();
    if (pErr) throw new Error(pErr.message);
    if (!project) throw new Error("Project not found");

    const { data: options, error: oErr } = await supabase
      .from("project_selection_options")
      .select("category, sort_order, customer_notes, master_catalog(product_name, vendor, image_url, product_url)")
      .eq("project_id", projectId)
      .order("category")
      .order("sort_order");
    if (oErr) throw new Error(oErr.message);

    // Canonical string of ONLY customer-visible exported fields.
    const canonical = (options ?? [])
      .map((o) => {
        const c = (o as { master_catalog: { product_name?: string; vendor?: string | null; image_url?: string | null; product_url?: string | null } | null }).master_catalog;
        return [
          o.category ?? "",
          c?.product_name ?? "",
          c?.vendor ?? "",
          c?.image_url ?? "",
          c?.product_url ?? "",
          o.customer_notes ?? "",
        ].join("|");
      })
      .join("\n");

    // Stable FNV-1a hash (synchronous, no Web Crypto needed).
    let h = 0x811c9dc5;
    for (let i = 0; i < canonical.length; i++) {
      h ^= canonical.charCodeAt(i);
      h = Math.imul(h, 0x01000193);
    }
    const hash = (h >>> 0).toString(16);

    let version = project.selections_version ?? 0;
    let lastModified = project.selections_version_updated_at;
    const changed = project.selections_content_hash !== hash;

    if (changed) {
      version = version + 1;
      const now = new Date().toISOString();
      lastModified = now;
      const { error: uErr } = await supabase
        .from("projects")
        .update({
          selections_version: version,
          selections_content_hash: hash,
          selections_version_updated_at: now,
        })
        .eq("id", projectId);
      if (uErr) throw new Error(uErr.message);

      await supabase.from("project_timeline_events").insert({
        project_id: projectId,
        category: "selections",
        title: "Selections Version Updated",
        description: `Selections export updated to V${version}`,
        created_by: userId,
      });
    }

    await supabase.from("project_timeline_events").insert({
      project_id: projectId,
      category: "selections",
      title: "Selections Export Generated",
      description: `Selections list exported (V${version})`,
      created_by: userId,
    });

    return { version, lastModified };
  });