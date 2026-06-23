import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Logo } from "@/components/Logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import loginBg from "@/assets/login-bg.png.asset.json";
import { Mail, Lock, Eye, EyeOff } from "lucide-react";

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
  const [mode, setMode] = useState<"signin" | "signup" | "forgot">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [fullName, setFullName] = useState("");
  const [phone, setPhone] = useState("");
  const [address, setAddress] = useState("");
  const [busy, setBusy] = useState(false);
  const [rememberMe, setRememberMe] = useState(true);
  const [showPassword, setShowPassword] = useState(false);

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
            data: { full_name: fullName, phone, address },
          },
        });
        if (error) throw error;
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
    <div className="flex min-h-screen flex-col bg-navy-deep p-4 sm:p-6 lg:p-8">
      <div className="mx-auto flex w-full max-w-6xl flex-1 items-center justify-center">
        <div className="grid min-h-[720px] w-full overflow-hidden rounded-3xl bg-card shadow-2xl lg:grid-cols-2">
          {/* Left panel */}
          <div className="relative hidden flex-col justify-between overflow-hidden bg-navy lg:flex">
            <img
              src={loginBg.url}
              alt=""
              className="absolute inset-0 h-full w-full object-cover"
              loading="eager"
            />
            <div className="absolute inset-0 bg-gradient-to-br from-navy-deep/80 via-navy/60 to-navy/45" />
            <div className="relative z-10 flex flex-col justify-between p-10 text-white">
              <div className="flex items-start justify-between">
                <div className="inline-flex rounded-2xl bg-white/95 px-5 py-4 shadow-lg">
                  <Logo className="h-20 w-auto" />
                </div>
              </div>
              <div className="max-w-md">
                <h2 className="text-4xl font-semibold leading-tight tracking-tight">
                  Welcome to Your{" "}
                  <span className="text-accent">Project Portal</span>
                </h2>
                <div className="mt-5 h-1 w-16 rounded-full bg-accent" />
                <p className="mt-6 text-lg leading-relaxed text-white/90">
                  Track progress, view selections, and stay connected with your remodeling project.
                </p>
              </div>
              <div />
            </div>
          </div>

          {/* Right panel */}
          <div className="flex flex-col overflow-y-auto bg-card p-6 sm:p-10 lg:p-12">
            <div className="mx-auto flex w-full max-w-md flex-1 flex-col justify-center">
              <div className="mb-8 lg:mb-10">
                <div className="mb-6 flex justify-center lg:hidden">
                  <Logo className="h-16 w-auto" />
                </div>
                {mode === "signin" && (
                  <>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Sign In</h1>
                    <p className="mt-2 text-muted-foreground">Welcome back! Please sign in to continue.</p>
                  </>
                )}
                {mode === "signup" && (
                  <>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Create Account</h1>
                    <p className="mt-2 text-muted-foreground">Sign up to get started with your project.</p>
                  </>
                )}
                {mode === "forgot" && (
                  <>
                    <h1 className="text-3xl font-semibold tracking-tight text-foreground">Forgot Password</h1>
                    <p className="mt-2 text-muted-foreground">Enter your email and we'll send you a reset link.</p>
                  </>
                )}
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
                  className="space-y-5"
                >
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-12 rounded-lg pl-10"
                        required
                      />
                    </div>
                  </div>
                  <Button type="submit" variant="orange" size="xl" className="w-full" disabled={busy}>
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
                <form onSubmit={handleSubmit} className="space-y-5">
                  {mode === "signup" && (
                    <>
                      <div className="space-y-2">
                        <Label htmlFor="fullName">Full name</Label>
                        <Input
                          id="fullName"
                          value={fullName}
                          onChange={(e) => setFullName(e.target.value)}
                          placeholder="Jane Homeowner"
                          className="h-12 rounded-lg"
                          required
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="phone">Phone number</Label>
                        <Input
                          id="phone"
                          type="tel"
                          value={phone}
                          onChange={(e) => setPhone(e.target.value)}
                          placeholder="(555) 123-4567"
                          className="h-12 rounded-lg"
                        />
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="address">Address</Label>
                        <Input
                          id="address"
                          value={address}
                          onChange={(e) => setAddress(e.target.value)}
                          placeholder="123 Main St, City, State"
                          className="h-12 rounded-lg"
                        />
                      </div>
                    </>
                  )}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="email"
                        type="email"
                        value={email}
                        onChange={(e) => setEmail(e.target.value)}
                        placeholder="you@example.com"
                        className="h-12 rounded-lg pl-10"
                        required
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 h-5 w-5 -translate-y-1/2 text-muted-foreground" />
                      <Input
                        id="password"
                        type={showPassword ? "text" : "password"}
                        value={password}
                        onChange={(e) => setPassword(e.target.value)}
                        placeholder="Enter your password"
                        minLength={mode === "signup" ? 8 : undefined}
                        className="h-12 rounded-lg pl-10 pr-10"
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword((v) => !v)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                        aria-label={showPassword ? "Hide password" : "Show password"}
                      >
                        {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
                      </button>
                    </div>
                  </div>

                  {mode === "signin" && (
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <Checkbox
                          id="remember"
                          checked={rememberMe}
                          onCheckedChange={(checked) => setRememberMe(checked === true)}
                        />
                        <Label htmlFor="remember" className="cursor-pointer text-sm font-normal text-muted-foreground">
                          Remember me
                        </Label>
                      </div>
                      <button
                        type="button"
                        onClick={() => setMode("forgot")}
                        className="text-sm font-medium text-primary hover:underline"
                      >
                        Forgot password?
                      </button>
                    </div>
                  )}

                  <Button type="submit" variant="orange" size="xl" className="w-full" disabled={busy}>
                    {busy ? "Please wait…" : mode === "signin" ? "Sign In" : "Create Account"}
                  </Button>

                  {mode === "signin" && (
                    <>
                      <p className="text-center text-sm text-muted-foreground">
                        Don't have an account?{" "}
                        <button
                          type="button"
                          onClick={() => setMode("signup")}
                          className="font-semibold text-accent hover:underline"
                        >
                          Create account
                        </button>
                      </p>
                    </>
                  )}

                  {mode === "signup" && (
                    <p className="text-center text-sm text-muted-foreground">
                      Already have an account?{" "}
                      <button
                        type="button"
                        onClick={() => setMode("signin")}
                        className="font-semibold text-accent hover:underline"
                      >
                        Sign in
                      </button>
                    </p>
                  )}
                </form>
              )}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
