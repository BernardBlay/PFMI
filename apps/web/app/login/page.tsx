"use client";

import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { supabase } from "@/lib/db";
import { Mail, Lock, ArrowLeft, Loader2, Eye, EyeOff, Cpu, Wrench, Shield, CheckCircle } from "lucide-react";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  // If already logged in, redirect
  useEffect(() => {
    supabase.auth.getSession().then((res) => {
      if (res.data?.session) {
        router.push("/dashboard");
      } else {
        const mockUserStr = localStorage.getItem("pfmi-mock-user");
        if (mockUserStr) {
          router.push("/dashboard");
        }
      }
    });
  }, [router]);

  const handleAuthSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setError(null);
    setSuccess(null);

    const isPlaceholder =
      !process.env.NEXT_PUBLIC_SUPABASE_URL ||
      process.env.NEXT_PUBLIC_SUPABASE_URL.includes("placeholder");

    if (mode === "signup") {
      if (password !== confirmPassword) {
        setError("Passcode keys do not match!");
        setLoading(false);
        return;
      }
      if (password.length < 6) {
        setError("Passcode must be at least 6 characters!");
        setLoading(false);
        return;
      }

      try {
        if (isPlaceholder) {
          // Simulate registration success
          const mockUser = {
            id: `mock-usr-${Math.random().toString(36).substring(2, 9)}`,
            email,
            user_metadata: {
              role: selectedRole || "Operator Node 04",
              full_name: email.split("@")[0],
            },
          };
          localStorage.setItem("pfmi-mock-user", JSON.stringify(mockUser));
          setSuccess("SECURE LINK REGISTERED! REDIRECTING...");
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1500);
        } else {
          // Real registration using Supabase
          const { data, error: signupError } = await supabase.auth.signUp({
            email,
            password,
            options: {
              data: {
                role: selectedRole || "Operator Node 04",
                full_name: email.split("@")[0],
              },
            },
          });

          if (signupError) {
            setError(signupError.message);
            setLoading(false);
            return;
          }

          if (data.session) {
            setSuccess("SECURE LINK REGISTERED! REDIRECTING...");
            setTimeout(() => {
              router.push("/dashboard");
              router.refresh();
            }, 1500);
          } else {
            setSuccess("OPERATOR LINK INITIATED! CHECK EMAIL.");
            setLoading(false);
          }
        }
      } catch (err: any) {
        console.error("Sign up failed:", err);
        setError(err.message || "REGISTRATION FAILURE. TRY AGAIN.");
        setLoading(false);
      }
    } else {
      try {
        if (isPlaceholder) {
          // Simulate auth success
          const mockUser = {
            id: "mock-operator-user",
            email,
            user_metadata: {
              role: selectedRole || "Admin",
              full_name: email.split("@")[0],
            },
          };
          localStorage.setItem("pfmi-mock-user", JSON.stringify(mockUser));
          setSuccess("SECURE LINK ESTABLISHED! ACCESSING HUB...");
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1200);
        } else {
          // Real login using Supabase
          const { data, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (loginError) {
            // Auto-signup fallback for demo profiles if they don't exist in Supabase yet
            if (password === "demo-operator-pass") {
              console.log("Demo profile login failed. Attempting auto-signup fallback...");
              const { data: signupData, error: signupError } = await supabase.auth.signUp({
                email,
                password,
                options: {
                  data: {
                    role: selectedRole || "Operator Node 04",
                    full_name: email.split("@")[0],
                  },
                },
              });

              if (signupError) {
                console.error("Auto-signup fallback failed:", signupError);
                setError(`Auto-signup failed: ${signupError.message}`);
                setLoading(false);
                return;
              }

              console.log("Auto-signup fallback succeeded. Attempting login again...");
              // Auto login after sign up
              const { data: loginData2, error: loginError2 } = await supabase.auth.signInWithPassword({
                email,
                password,
              });
              
              if (loginError2) {
                console.error("Login after auto-signup failed:", loginError2);
                setError(loginError2.message);
                setLoading(false);
                return;
              }

              setSuccess("SECURE LINK ESTABLISHED (DEMO NODE INITIATED)!...");
              setTimeout(() => {
                router.push("/dashboard");
                router.refresh();
              }, 1200);
              return;
            }

            setError(loginError.message);
            setLoading(false);
            return;
          }

          setSuccess("SECURE LINK ESTABLISHED! ACCESSING HUB...");
          setTimeout(() => {
            router.push("/dashboard");
            router.refresh();
          }, 1200);
        }
      } catch (err: any) {
        console.error("Login failed:", err);
        setError(err.message || "AUTHENTICATION FAILED. CHECK CREDENTIALS.");
        setLoading(false);
      }
    }
  };

  const selectDemoProfile = (profileEmail: string, roleName: string) => {
    setMode("login");
    setEmail(profileEmail);
    setPassword("demo-operator-pass");
    setConfirmPassword("demo-operator-pass");
    setSelectedRole(roleName);
    setError(null);
    setSuccess(null);
  };

  return (
    <main className="min-h-screen bg-background flex flex-col justify-center py-12 sm:px-6 lg:px-8 relative overflow-hidden">
      {/* Background Decorative Blob */}
      <div className="absolute -top-40 -right-40 w-96 h-96 bg-emerald-500/5 dark:bg-emerald-500/10 rounded-full blur-3xl -z-10" />
      <div className="absolute -bottom-40 -left-40 w-96 h-96 bg-teal-500/5 dark:bg-teal-500/10 rounded-full blur-3xl -z-10" />

      {/* Top Navbar/Back Link */}
      <div className="absolute top-6 left-6 sm:left-12">
        <Link
          href="/"
          className="flex items-center gap-1.5 text-xs font-semibold text-text-muted hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" /> Back to Home
        </Link>
      </div>

      <div className="sm:mx-auto sm:w-full sm:max-w-md px-6">
        {/* Branding Logo */}
        <div className="flex justify-center mb-6">
          <Link href="/" className="flex items-center gap-2.5 group">
            <div className="h-8 w-8 flex items-center justify-center rounded bg-foreground text-background border border-zinc-200 dark:border-zinc-800">
              <Cpu className="h-4.5 w-4.5" />
            </div>
            <span className="font-sans font-bold tracking-tight text-foreground text-lg">
              PFMI<span className="text-zinc-400 font-normal">.ai</span>
            </span>
          </Link>
        </div>
        <h2 className="text-center text-xl font-bold tracking-tight text-foreground font-sans">
          Operator Console Access
        </h2>
        <p className="mt-2 text-center text-xs text-text-muted">
          Welcome back operator! Please establish a secure session link.
        </p>
      </div>

      <div className="mt-8 sm:mx-auto sm:w-full sm:max-w-md px-4 sm:px-0">
        <div className="bg-surface border border-border-mute py-8 px-6 sm:px-10 rounded-2xl shadow-xl backdrop-blur-md">
          {error && (
            <div className="mb-4 p-3 rounded-lg bg-red-500/10 border border-red-500/20 text-red-500 text-xs font-mono">
              {error}
            </div>
          )}
          {success && (
            <div className="mb-4 p-3 rounded-lg bg-emerald-500/10 border border-emerald-500/20 text-emerald-500 text-xs font-mono">
              {success}
            </div>
          )}

          <form className="space-y-5" onSubmit={handleAuthSubmit}>
            {/* Email Input */}
            <div>
              <label htmlFor="email" className="block text-[10px] font-mono font-bold text-text-muted uppercase mb-1.5">
                Operator Email
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Mail className="h-3.5 w-3.5" />
                </div>
                <input
                  id="email"
                  name="email"
                  type="email"
                  autoComplete="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="operator@pfmi.ai"
                  className="block w-full pl-9 pr-3 py-2 text-xs bg-background border border-border-mute rounded-lg outline-none focus:border-emerald-500 transition-colors text-foreground"
                />
              </div>
            </div>

            {/* Password Input */}
            <div>
              <label htmlFor="password" className="block text-[10px] font-mono font-bold text-text-muted uppercase mb-1.5">
                Access Passcode Keys
              </label>
              <div className="relative rounded-lg shadow-sm">
                <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                  <Lock className="h-3.5 w-3.5" />
                </div>
                <input
                  id="password"
                  name="password"
                  type={showPassword ? "text" : "password"}
                  autoComplete="current-password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="block w-full pl-9 pr-10 py-2 text-xs bg-background border border-border-mute rounded-lg outline-none focus:border-emerald-500 transition-colors text-foreground"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute inset-y-0 right-0 pr-3 flex items-center text-text-muted hover:text-foreground cursor-pointer"
                >
                  {showPassword ? <EyeOff className="h-3.5 w-3.5" /> : <Eye className="h-3.5 w-3.5" />}
                </button>
              </div>
            </div>

            {mode === "signup" && (
              <div>
                <label htmlFor="confirmPassword" className="block text-[10px] font-mono font-bold text-text-muted uppercase mb-1.5">
                  Confirm Passcode Keys
                </label>
                <div className="relative rounded-lg shadow-sm">
                  <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-text-muted">
                    <Lock className="h-3.5 w-3.5" />
                  </div>
                  <input
                    id="confirmPassword"
                    name="confirmPassword"
                    type={showPassword ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••"
                    className="block w-full pl-9 pr-3 py-2 text-xs bg-background border border-border-mute rounded-lg outline-none focus:border-emerald-500 transition-colors text-foreground"
                  />
                </div>
              </div>
            )}

            {/* Submit Button */}
            <div>
              <button
                type="submit"
                disabled={loading}
                className="w-full flex justify-center py-2 px-4 border border-transparent rounded-lg shadow-sm text-xs font-bold text-background bg-foreground hover:bg-zinc-800 dark:bg-zinc-50 dark:text-black dark:hover:bg-zinc-200 transition-all focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
              >
                {loading ? (
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                ) : mode === "login" ? (
                  "ESTABLISH SECURE LINK"
                ) : (
                  "REGISTER NEW OPERATOR"
                )}
              </button>
            </div>
          </form>

          {/* Toggle login/signup mode */}
          <div className="mt-5 text-center">
            <button
              onClick={() => setMode(mode === "login" ? "signup" : "login")}
              className="text-xs text-emerald-650 dark:text-emerald-450 hover:underline cursor-pointer"
            >
              {mode === "login" ? "Create a new operator node account" : "Back to console sign in"}
            </button>
          </div>

          {/* Divider */}
          <div className="mt-6">
            <div className="relative">
              <div className="absolute inset-0 flex items-center">
                <div className="w-full border-t border-border-mute" />
              </div>
              <div className="relative flex justify-center text-[10px] font-mono uppercase">
                <span className="bg-surface px-2 text-text-muted">Pre-seeded Demo Nodes</span>
              </div>
            </div>

            <div className="mt-4 space-y-2">
              <button
                type="button"
                onClick={() => selectDemoProfile("operator04@pfmi.ai", "Admin")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border-mute bg-background/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all text-left text-xs cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Shield className="h-3.5 w-3.5 text-indigo-500 shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">operator04@pfmi.ai</span>
                    <p className="text-[9px] text-text-muted leading-none mt-0.5 font-mono">System Admin Node 04</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase bg-indigo-500/10 text-indigo-500 px-2 py-0.5 rounded border border-indigo-500/20 group-hover:scale-105 transition-transform">
                  Admin
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectDemoProfile("miller@pfmi.ai", "Lead Tech")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border-mute bg-background/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all text-left text-xs cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-emerald-500 shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">miller@pfmi.ai</span>
                    <p className="text-[9px] text-text-muted leading-none mt-0.5 font-mono">Lead Maintenance Technician</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase bg-emerald-500/10 text-emerald-500 px-2 py-0.5 rounded border border-emerald-500/20 group-hover:scale-105 transition-transform">
                  Tech
                </span>
              </button>

              <button
                type="button"
                onClick={() => selectDemoProfile("chen@pfmi.ai", "Sys Eng")}
                className="w-full flex items-center justify-between p-2.5 rounded-lg border border-border-mute bg-background/50 hover:border-zinc-400 dark:hover:border-zinc-700 transition-all text-left text-xs cursor-pointer group"
              >
                <div className="flex items-center gap-2">
                  <Wrench className="h-3.5 w-3.5 text-amber-500 shrink-0" />
                  <div>
                    <span className="font-bold text-foreground">chen@pfmi.ai</span>
                    <p className="text-[9px] text-text-muted leading-none mt-0.5 font-mono">System Reliability Engineer</p>
                  </div>
                </div>
                <span className="text-[9px] font-mono uppercase bg-amber-500/10 text-amber-500 px-2 py-0.5 rounded border border-amber-500/20 group-hover:scale-105 transition-transform">
                  Eng
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
