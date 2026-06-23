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

function GoogleIcon({ className }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 24 24" aria-hidden="true">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  );
}

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

  const handleGoogleSignIn = async () => {
    setBusy(true);
    try {
      const { error } = await supabase.auth.signInWithOAuth({
        provider: "google",
        options: { redirectTo: window.location.origin },
      });
      if (error) throw error;
    } catch (err) {
      toast.error(err instanceof Error ? err.message : "Google sign-in failed");
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
                <Logo className="h-24 w-auto" />
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
              <p className="text-sm text-white/60">© 2025 Highland Remodeling. All rights reserved.</p>
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
                      <div className="relative flex items-center justify-center py-2">
                        <div className="absolute inset-0 flex items-center">
                          <div className="w-full border-t border-border" />
                        </div>
                        <span className="relative bg-card px-3 text-sm text-muted-foreground">OR</span>
                      </div>

                      <Button
                        type="button"
                        variant="outline"
                        size="xl"
                        className="w-full"
                        onClick={handleGoogleSignIn}
                        disabled={busy}
                      >
                        <GoogleIcon className="h-5 w-5" />
                        Continue with Google
                      </Button>

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

      <footer className="mt-4 text-center text-xs text-white/60 sm:mt-6">
        © 2025 Highland Remodeling. All rights reserved.{" "}
        <span className="mx-2 hidden sm:inline">|</span>
        <a href="#" className="hover:text-white/90">
          Privacy Policy
        </a>{" "}
        <span className="mx-2">|</span>
        <a href="#" className="hover:text-white/90">
          Terms of Service
        </a>
      </footer>
    </div>
  );
}
