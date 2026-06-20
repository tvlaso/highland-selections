import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

export const Route = createFileRoute("/reset-password")({
  head: () => ({
    meta: [
      { title: "Reset Password | Highland Remodeling Portal" },
      { name: "description", content: "Set a new password for your Highland Remodeling portal account." },
    ],
  }),
  component: ResetPasswordPage,
});

function ResetPasswordPage() {
  const navigate = useNavigate();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [busy, setBusy] = useState(false);
  const [isRecovery, setIsRecovery] = useState(false);

  useEffect(() => {
    // Supabase puts recovery info in the URL hash after redirect
    const hash = window.location.hash;
    if (hash.includes("type=recovery")) {
      setIsRecovery(true);
    }
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (password !== confirmPassword) {
      toast.error("Passwords do not match.");
      return;
    }
    if (password.length < 8) {
      toast.error("Password must be at least 8 characters.");
      return;
    }
    setBusy(true);
    try {
      const { error } = await supabase.auth.updateUser({ password });
      if (error) throw error;
      toast.success("Password updated! Please sign in.");
      navigate({ to: "/auth" });
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Something went wrong");
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="flex min-h-screen flex-col bg-[image:var(--gradient-navy)] px-4 py-10">
      <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
        <div className="mb-6 flex justify-center rounded-2xl bg-card p-5 shadow-[var(--shadow-soft)]">
          <Logo className="h-14 w-auto" />
        </div>
        <div className="rounded-2xl bg-card p-6 shadow-[var(--shadow-soft)]">
          <h1 className="mb-2 text-center text-xl font-semibold tracking-tight">
            Reset your password
          </h1>
          {!isRecovery && (
            <p className="mb-4 text-center text-sm text-muted-foreground">
              This link appears to be invalid or expired. Please request a new one.
            </p>
          )}
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="password">New password</Label>
              <Input
                id="password"
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="confirmPassword">Confirm new password</Label>
              <Input
                id="confirmPassword"
                type="password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                placeholder="••••••••"
                minLength={8}
                required
              />
            </div>
            <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
              {busy ? "Please wait…" : "Update Password"}
            </Button>
          </form>
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={() => navigate({ to: "/auth" })}
              className="text-sm text-muted-foreground hover:text-foreground"
            >
              Back to sign in
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
