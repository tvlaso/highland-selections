import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect } from "react";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";

export const Route = createFileRoute("/")({
  head: () => ({
    meta: [
      { title: "Highland Remodeling | Selections Portal" },
      { name: "description", content: "Review and approve your bath, kitchen, and tile selections for your Highland Remodeling project." },
    ],
  }),
  component: Index,
});

function Index() {
  const navigate = useNavigate();
  const { session, role, loading } = useAuth();

  useEffect(() => {
    if (loading) return;
    if (!session) {
      navigate({ to: "/auth" });
    } else if (role === "admin") {
      navigate({ to: "/admin" });
    } else {
      navigate({ to: "/dashboard" });
    }
  }, [session, role, loading, navigate]);

  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-4 bg-[image:var(--gradient-navy)] px-4">
      <div className="rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)]">
        <Logo className="h-12 w-auto" />
      </div>
      <div className="h-6 w-6 animate-spin rounded-full border-2 border-[oklch(0.85_0.02_255)] border-t-transparent" />
    </div>
  );
}
