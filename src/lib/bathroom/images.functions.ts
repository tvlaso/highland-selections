import { createServerFn } from "@tanstack/react-start";
import { editImage, GatewayError } from "@lovable.dev/ai-gateway";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";
import { selectionsSchema, LAYOUTS, scopeLines, imagesSchema } from "./model";
export const generateBathroomImage = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        id: z.string().uuid(),
        area: z.enum(["Shower", "Vanity"]),
        layout: z.enum(LAYOUTS),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { data: admin, error: roleError } = await context.supabase.rpc("has_role", {
      _user_id: context.userId,
      _role: "admin",
    });
    if (roleError || !admin) throw new Error("Admin access required.");
    const [{ data: project, error }, { data: settings }] = await Promise.all([
      context.supabase.from("bathroom_consultations").select("*").eq("id", data.id).single(),
      context.supabase
        .from("bathroom_settings")
        .select("templates")
        .eq("id", "default")
        .maybeSingle(),
    ]);
    if (error || !project) throw new Error("This bathroom project could not be loaded.");
    const selections = selectionsSchema.parse(project.selections);
    if (!selections.areas.includes(data.area))
      throw new Error("Select this remodeling area first.");
    const templates = z.record(z.string()).parse(settings?.templates ?? {});
    const reference = templates[data.layout];
    if (!reference) throw new Error("Upload a master reference image for this layout first.");
    const { data: blob, error: downloadError } = await context.supabase.storage
      .from("bathroom-designs")
      .download(reference);
    if (downloadError || !blob) throw new Error("The master reference image could not be read.");
    let result;
    try {
      result = await editImage({
        model: "openai/gpt-image-2.5-sunburst",
        image: blob,
        prompt: `Create a photorealistic Highland Remodeling bathroom consultation preview of the ${data.area.toLowerCase()} area using this master ${data.layout} reference. Preserve reference room proportions, walls, openings, camera angle and spatial layout. Change only the selected materials, finishes and requested fixtures. Show the actual specified surfaces clearly in natural even light, no people, text or labels. Focus on ${data.area}, not a collage. Selections: ${scopeLines(selections).join("\n")}. Unspecified details should stay as in reference. This is a design visualization, not a construction drawing.`,
        n: 1,
        size: "1536x1024",
        quality: "medium",
        output_format: "jpeg",
        output_compression: 80,
      });
    } catch (e) {
      if (e instanceof GatewayError) {
        console.error("Bathroom image failed", e.code, e.ids);
        if (e.code === "payment_required")
          throw new Error("Image generation needs more AI credits. Your selections are saved.");
        if (e.code === "rate_limited")
          throw new Error("Image generation is busy. Please wait before trying again.");
      }
      throw new Error(
        "The design image could not be generated. Your selections are saved; try again later.",
      );
    }
    const image = result.data?.[0];
    if (!image?.b64_json)
      throw new Error("No design image was returned. Your selections are saved.");
    const bytes = Uint8Array.from(atob(image.b64_json), (c) => c.charCodeAt(0));
    const path = `projects/${data.id}/${data.area.toLowerCase()}-${crypto.randomUUID()}.jpg`;
    const { error: uploadError } = await context.supabase.storage
      .from("bathroom-designs")
      .upload(path, bytes, { contentType: "image/jpeg" });
    if (uploadError) throw new Error("The generated image could not be saved.");
    // Read latest image approvals after the long request, avoiding overwriting the other area.
    const { data: latest } = await context.supabase
      .from("bathroom_consultations")
      .select("approved_images")
      .eq("id", data.id)
      .single();
    const images = imagesSchema.parse(latest?.approved_images ?? {});
    images[data.area] = { path, approved: false };
    const { error: saveError } = await context.supabase
      .from("bathroom_consultations")
      .update({ approved_images: images, updated_at: new Date().toISOString() })
      .eq("id", data.id);
    if (saveError) throw new Error("The generated image could not be attached to this project.");
    return { path };
  });
