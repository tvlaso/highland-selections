import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { useServerFn } from "@tanstack/react-start";
import { claimAdmin } from "@/lib/admin.functions";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";

export const Route = createFileRoute("/auth")({
  head: () => ({
    meta: [
      { title: "Sign In | Highland Remodeling Portal" },
      { name: "description", content: "Sign in to view and approve your Highland Remodeling project selections." },
    ],
  }),
  component: AuthPage,
});

function AuthPage() {
  const navigate = useNavigate();
  const { session, role, loading, refreshRole } = useAuth();
  const claim = useServerFn(claimAdmin);
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [isContractor, setIsContractor] = useState(false);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!loading && session && role) {
      navigate({ to: role === "admin" ? "/admin" : "/dashboard" });
    }
  }, [loading, session, role, navigate]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setBusy(true);
    try {
      if (mode === "signup") {
        const { error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: window.location.origin,
            data: { full_name: fullName },
          },
        });
        if (error) throw error;
        if (isContractor) {
          try {
            await claim();
          } catch (err) {
            console.warn("Admin claim skipped:", err);
          }
          await refreshRole();
          toast.success("Contractor account ready!");
          navigate({ to: "/admin" });
          return;
        }
        await refreshRole();
        toast.success("Account created!");
      } else {
        const { error } = await supabase.auth.signInWithPassword({ email, password });
        if (error) throw error;
        await refreshRole();
        toast.success("Welcome back!");
      }
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
          <div className="mb-5 grid grid-cols-2 gap-1 rounded-lg bg-muted p-1">
            {(["signin", "signup"] as const).map((m) => (
              <button
                key={m}
                onClick={() => setMode(m)}
                className={`rounded-md py-2 text-sm font-semibold transition-colors ${
                  mode === m ? "bg-card text-foreground shadow-sm" : "text-muted-foreground"
                }`}
              >
                {m === "signin" ? "Sign In" : "Create Account"}
              </button>
            ))}
          </div>

          {mode === "forgot" ? (
            <form
              onSubmit={async (e) => {
                e.preventDefault();
                setBusy(true);
                try {
                  const { error } = await supabase.auth.resetPasswordForEmail(email, {
                    redirectTo: `${window.location.origin}/reset-password`,
                  });
                  if (error) throw error;
                  toast.success("Check your email for a reset link.");
                  setMode("signin");
                } catch (err) {
                  toast.error(err instanceof Error ? err.message : "Something went wrong");
                } finally {
                  setBusy(false);
                }
              }}
              className="space-y-4"
            >
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : "Send Reset Link"}
              </Button>
              <button
                type="button"
                onClick={() => setMode("signin")}
                className="w-full text-center text-sm text-muted-foreground hover:text-foreground"
              >
                Back to sign in
              </button>
            </form>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              {mode === "signup" && (
                <div className="space-y-2">
                  <Label htmlFor="fullName">Full name</Label>
                  <Input
                    id="fullName"
                    value={fullName}
                    onChange={(e) => setFullName(e.target.value)}
                    placeholder="Jane Homeowner"
                    required
                  />
                </div>
              )}
              <div className="space-y-2">
                <Label htmlFor="email">Email</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  required
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="password">Password</Label>
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

              {mode === "signup" && (
                <label className="flex items-start gap-2.5 rounded-lg bg-secondary p-3 text-sm">
                  <Checkbox
                    checked={isContractor}
                    onCheckedChange={(v) => setIsContractor(Boolean(v))}
                    className="mt-0.5"
                  />
                  <span className="text-muted-foreground">
                    I'm the contractor setting up the company admin account.
                  </span>
                </label>
              )}

              {mode === "signin" && (
                <button
                  type="button"
                  onClick={() => setMode("forgot")}
                  className="block text-sm text-muted-foreground hover:text-foreground"
                >
                  Forgot password?
                </button>
              )}

              <Button type="submit" variant="hero" size="lg" className="w-full" disabled={busy}>
                {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
              </Button>
            </form>
          )}
        </div>
        <p className="mt-6 text-center text-xs text-[oklch(0.85_0.02_255)]">
          Bath · Kitchen · Tile — your selections, all in one place.
        </p>
      </div>
    </div>
  );
}