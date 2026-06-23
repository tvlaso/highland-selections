import { createServerFn } from "@tanstack/react-start";
import { z } from "zod";
import { requireSupabaseAuth } from "@/integrations/supabase/auth-middleware";

const PROJECT_TYPE_VALUES = [
  "bathroom_remodel",
  "kitchen_remodel",
  "flooring",
  "shower",
  "handyman",
] as const;

/** Creates a short-lived upload token for a customer's intake/inspiration photo. */
export const createIntakePhotoUpload = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({ ext: z.string().regex(/^[a-z0-9]{1,5}$/, "Invalid extension") })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const path = `intake/${context.userId}/${crypto.randomUUID()}.${data.ext}`;
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");
    const { data: upload, error } = await supabaseAdmin.storage
      .from("product-photos")
      .createSignedUploadUrl(path, { upsert: false });
    if (error) throw new Error(error.message);
    return { ...upload, path };
  });

/**
 * Submits a new project request from a customer. Creates the project as a
 * "New Request", saves intake details + photos, and logs timeline events.
 */
export const submitProjectRequest = createServerFn({ method: "POST" })
  .middleware([requireSupabaseAuth])
  .inputValidator((data) =>
    z
      .object({
        projectType: z.enum(PROJECT_TYPE_VALUES),
        description: z.string().trim().min(1).max(5000),
        fullName: z.string().trim().min(1, "Full name is required").max(200),
        phone: z
          .string()
          .trim()
          .min(1, "Phone number is required")
          .max(40)
          .refine(
            (v) => {
              const digits = v.replace(/\D/g, "");
              return digits.length >= 10 && digits.length <= 15;
            },
            { message: "Enter a valid phone number" },
          ),
        email: z.string().trim().email("Enter a valid email address").max(255),
        address: z.string().trim().min(1, "Project address is required").max(500),
        timeline: z.string().trim().max(200).optional().nullable(),
        budget: z.string().trim().max(200).optional().nullable(),
        contactMethod: z.string().trim().max(100).optional().nullable(),
        notes: z.string().trim().max(5000).optional().nullable(),
        photos: z.array(z.string().regex(/^intake\/[a-zA-Z0-9/._-]+$/)).max(20).optional(),
      })
      .parse(data),
  )
  .handler(async ({ data, context }) => {
    const { supabaseAdmin } = await import("@/integrations/supabase/client.server");

    const typeLabel: Record<string, string> = {
      bathroom_remodel: "Bathroom Remodel",
      kitchen_remodel: "Kitchen Remodel",
      flooring: "Flooring",
      shower: "Shower",
      handyman: "Handyman",
    };

    const photos = data.photos ?? [];

    const customerLabel = data.fullName || data.email || "New Customer";

    // Keep the customer's profile in sync with the latest contact details.
    await supabaseAdmin
      .from("profiles")
      .update({
        full_name: data.fullName,
        phone: data.phone,
        address: data.address,
      })
      .eq("id", context.userId);

    const { data: project, error } = await supabaseAdmin
      .from("projects")
      .insert({
        name: `${typeLabel[data.projectType]} — ${customerLabel}`,
        status: "New Request",
        customer_id: context.userId,
        address: data.address,
        project_address: data.address,
        customer_name: data.fullName,
        customer_phone: data.phone,
        customer_email: data.email,
        project_type: data.projectType,
        project_description: data.description,
        intake_timeline: data.timeline || null,
        intake_budget: data.budget || null,
        intake_contact_method: data.contactMethod || null,
        intake_notes: data.notes || null,
        intake_photos: photos,
      })
      .select("id")
      .single();
    if (error) throw new Error(error.message);

    const events = [
      { title: "New project request submitted", description: "Customer submitted a new project request" },
      { title: "Project type selected", description: typeLabel[data.projectType] },
      { title: "Project description submitted", description: data.description.slice(0, 300) },
    ];
    if (photos.length > 0) {
      events.push({
        title: "Intake photos uploaded",
        description: `${photos.length} inspiration photo${photos.length === 1 ? "" : "s"} attached`,
      });
    }

    await supabaseAdmin.from("project_timeline_events").insert(
      events.map((e) => ({
        project_id: project.id,
        category: "project",
        title: e.title,
        description: e.description,
        created_by: context.userId,
      })),
    );

    return { projectId: project.id };
  });
