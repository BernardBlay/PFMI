"use client";
import { useState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/db";

export default function Login() {
  const [mode, setMode] = useState<"login" | "signup">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState("");
  const [selectedRole, setSelectedRole] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const router = useRouter();

  // Update clock for industrial dashboard feel
  useEffect(() => {
    const updateTime = () => {
      const now = new Date();
      setCurrentTime(now.toISOString().replace("T", " ").substring(0, 19) + " UTC");
    };
    updateTime();
    const interval = setInterval(updateTime, 1000);
    return () => clearInterval(interval);
  }, []);

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
          // Simulate registration success and automatic login
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
          // Real registration
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

          if (signupError) throw signupError;

          if (data.session) {
            setSuccess("SECURE LINK REGISTERED! REDIRECTING...");
            setTimeout(() => {
              router.push("/dashboard");
              router.refresh();
            }, 1500);
          } else {
            setSuccess("OPERATOR LINK INITIATED! CHECK EMAIL FOR VALIDATION.");
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
          // Simulate authentication success
          const mockUser = {
            id: "mock-operator-user",
            email,
            user_metadata: {
              role: selectedRole || "System Admin",
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
          // Real login
          const { data, error: loginError } = await supabase.auth.signInWithPassword({
            email,
            password,
          });

          if (loginError) throw loginError;

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
    <main className="min-h-screen flex flex-col justify-center items-center bg-surface-dim text-on-surface relative overflow-hidden select-none font-body px-4 py-12">
      {/* Premium background styling */}
      <div className="absolute inset-0 bg-[radial-gradient(circle_at_center,rgba(59,130,246,0.03)_0%,transparent_70%)] pointer-events-none" />
      <div className="absolute top-0 left-0 right-0 h-[1px] bg-gradient-to-r from-transparent via-secondary/20 to-transparent" />
      
      {/* Return link */}
      <a 
        href="/" 
        className="absolute top-8 left-8 flex items-center gap-2 text-on-surface-variant hover:text-secondary transition-colors duration-200 z-20 font-label text-xs tracking-wider"
      >
        <span className="material-symbols-outlined text-sm">arrow_back</span>
        PORTAL INDEX
      </a>

      {/* Main Card */}
      <div className="w-full max-w-[440px] bg-surface-container/60 backdrop-blur-md border border-outline-variant rounded-lg shadow-2xl z-20 relative transition-all duration-300 hover:border-secondary/30 flex flex-col overflow-hidden">
        
        {/* Top subtle bar */}
        <div className="h-[2px] bg-gradient-to-r from-secondary via-secondary-container to-secondary" />

        {/* Brand Banner */}
        <div className="px-8 pt-8 pb-4 text-center">
          <div className="inline-flex items-center justify-center p-3 bg-secondary/10 text-secondary rounded-full mb-4 border border-secondary/20 shadow-sm">
            <span className="material-symbols-outlined text-2xl" style={{ fontVariationSettings: "'FILL' 1" }}>precision_manufacturing</span>
          </div>
          <h1 className="font-headline text-xl tracking-wider text-on-surface font-extrabold uppercase">
            PREVENTIVE <span className="text-secondary">INTEL</span>
          </h1>
          <p className="font-label text-[9px] text-on-surface-variant tracking-widest uppercase mt-1">
            Personnel & Fleet Control Hub
          </p>
        </div>

        {/* Tab Toggle */}
        <div className="flex px-8 mt-2 mb-4">
          <div className="grid grid-cols-2 w-full p-1 bg-surface-container-low/60 rounded border border-outline-variant/30">
            <button
              type="button"
              onClick={() => {
                setMode("login");
                setError(null);
                setSuccess(null);
              }}
              className={`py-2 rounded text-[9px] font-label font-bold tracking-wider uppercase transition-all cursor-pointer ${
                mode === "login"
                  ? "bg-secondary text-on-secondary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Establish Link
            </button>
            <button
              type="button"
              onClick={() => {
                setMode("signup");
                setError(null);
                setSuccess(null);
              }}
              className={`py-2 rounded text-[9px] font-label font-bold tracking-wider uppercase transition-all cursor-pointer ${
                mode === "signup"
                  ? "bg-secondary text-on-secondary shadow-sm"
                  : "text-on-surface-variant hover:text-on-surface"
              }`}
            >
              Register Operator
            </button>
          </div>
        </div>

        {/* Form Inputs */}
        <div className="px-8 pb-8 pt-2">
          <form onSubmit={handleAuthSubmit} className="space-y-4">
            
            {/* Feedback Alerts */}
            {error && (
              <div className="p-3 bg-error/10 border border-error/20 rounded text-error text-[10px] font-label tracking-wide flex items-center gap-2 animate-pulse">
                <span className="material-symbols-outlined text-sm">warning_amber</span>
                <span className="uppercase">{error}</span>
              </div>
            )}
            {success && (
              <div className="p-3 bg-green-500/10 border border-green-500/20 rounded text-green-500 text-[10px] font-label tracking-wide flex items-center gap-2">
                <span className="material-symbols-outlined text-sm">verified_user</span>
                <span className="uppercase">{success}</span>
              </div>
            )}

            {/* Email/ID */}
            <div className="space-y-1">
              <label className="block text-[10px] font-label text-on-surface-variant tracking-wider uppercase" htmlFor="email">
                Operator ID / Email
              </label>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
                  person
                </span>
                <input
                  id="email"
                  type="email"
                  required
                  value={email}
                  onChange={(e) => {
                    setEmail(e.target.value);
                    if (selectedRole && mode === "login") setSelectedRole(null);
                  }}
                  placeholder="name@preventive.intel"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded text-sm text-on-surface placeholder:text-on-surface-variant/35 focus:outline-none focus:border-secondary transition-colors"
                />
              </div>
            </div>

            {/* Password */}
            <div className="space-y-1">
              <div className="flex justify-between items-center">
                <label className="block text-[10px] font-label text-on-surface-variant tracking-wider uppercase" htmlFor="password">
                  Passcode Key
                </label>
                {mode === "login" && (
                  <a href="#" className="text-[9px] font-label text-secondary hover:text-secondary/80 transition-colors uppercase">
                    Reset Key?
                  </a>
                )}
              </div>
              <div className="relative">
                <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
                  vpn_key
                </span>
                <input
                  id="password"
                  type="password"
                  required
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••••••"
                  className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded text-sm text-on-surface placeholder:text-on-surface-variant/35 focus:outline-none focus:border-secondary transition-colors"
                />
              </div>
            </div>

            {/* Confirm Password (Signup only) */}
            {mode === "signup" && (
              <div className="space-y-1">
                <label className="block text-[10px] font-label text-on-surface-variant tracking-wider uppercase" htmlFor="confirmPassword">
                  Confirm Passcode Key
                </label>
                <div className="relative">
                  <span className="material-symbols-outlined absolute left-3 top-1/2 -translate-y-1/2 text-on-surface-variant/60 text-sm">
                    vpn_key
                  </span>
                  <input
                    id="confirmPassword"
                    type="password"
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••••••••"
                    className="w-full pl-9 pr-4 py-2.5 bg-surface-container-low border border-outline-variant rounded text-sm text-on-surface placeholder:text-on-surface-variant/35 focus:outline-none focus:border-secondary transition-colors"
                  />
                </div>
              </div>
            )}

            {/* Node Role select (Signup only) */}
            {mode === "signup" && (
              <div className="space-y-1.5">
                <label className="block text-[10px] font-label text-on-surface-variant tracking-wider uppercase">
                  Assigned Node Role
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    type="button"
                    onClick={() => setSelectedRole("Admin")}
                    className={`flex flex-col items-center justify-center p-2 rounded border text-center transition-all cursor-pointer ${
                      selectedRole === "Admin"
                        ? "bg-secondary/15 border-secondary text-on-surface"
                        : "bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:border-outline-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs mb-0.5">admin_panel_settings</span>
                    <span className="font-label text-[8px] font-bold">Admin</span>
                  </button>
                  
                  <button
                    type="button"
                    onClick={() => setSelectedRole("Lead Tech")}
                    className={`flex flex-col items-center justify-center p-2 rounded border text-center transition-all cursor-pointer ${
                      selectedRole === "Lead Tech"
                        ? "bg-secondary/15 border-secondary text-on-surface"
                        : "bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:border-outline-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs mb-0.5">engineering</span>
                    <span className="font-label text-[8px] font-bold">Technician</span>
                  </button>

                  <button
                    type="button"
                    onClick={() => setSelectedRole("Sys Eng")}
                    className={`flex flex-col items-center justify-center p-2 rounded border text-center transition-all cursor-pointer ${
                      selectedRole === "Sys Eng"
                        ? "bg-secondary/15 border-secondary text-on-surface"
                        : "bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:border-outline-variant"
                    }`}
                  >
                    <span className="material-symbols-outlined text-xs mb-0.5">construction</span>
                    <span className="font-label text-[8px] font-bold">Engineer</span>
                  </button>
                </div>
              </div>
            )}

            {/* Checkbox */}
            <div className="flex items-center pt-1">
              <input
                id="consent"
                type="checkbox"
                required
                defaultChecked
                className="w-3.5 h-3.5 text-secondary bg-surface-container-low border-outline-variant rounded focus:ring-0"
              />
              <label htmlFor="consent" className="ml-2 text-[9px] text-on-surface-variant/80 font-body select-none">
                I authorize this session and acknowledge compliance directives.
              </label>
            </div>

            {/* Submit Button */}
            <button
              type="submit"
              disabled={loading}
              className="w-full bg-secondary hover:bg-secondary/90 text-on-secondary py-3 rounded text-[10px] font-label font-bold tracking-widest uppercase transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2 mt-4 cursor-pointer"
            >
              {loading ? (
                <>
                  <span className="w-3 h-3 border-2 border-on-secondary/30 border-t-on-secondary rounded-full animate-spin" />
                  {mode === "login" ? "AUTHENTICATING..." : "REGISTERING..."}
                </>
              ) : (
                <>
                  <span className="material-symbols-outlined text-sm font-bold">
                    {mode === "login" ? "login" : "person_add"}
                  </span>
                  {mode === "login" ? "ESTABLISH SECURE LINK" : "REGISTER OPERATOR LINK"}
                </>
              )}
            </button>
          </form>

          {/* Operator Quick-Access */}
          {mode === "login" && (
            <div className="mt-6 border-t border-outline-variant/30 pt-5">
              <h2 className="text-[9px] font-label text-on-surface-variant tracking-wider uppercase mb-3 text-center">
                Operator Quick-Access
              </h2>
              <div className="grid grid-cols-3 gap-2">
                <button
                  type="button"
                  onClick={() => selectDemoProfile("operator04@preventive.intel", "Admin")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded border text-center transition-all cursor-pointer ${
                    selectedRole === "Admin"
                      ? "bg-secondary/15 border-secondary text-on-surface"
                      : "bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:border-outline-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mb-1">admin_panel_settings</span>
                  <span className="font-label text-[9px] font-bold truncate max-w-full">Op 04</span>
                  <span className="text-[7px] opacity-75 uppercase">Admin</span>
                </button>
                
                <button
                  type="button"
                  onClick={() => selectDemoProfile("miller@preventive.intel", "Lead Tech")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded border text-center transition-all cursor-pointer ${
                    selectedRole === "Lead Tech"
                      ? "bg-secondary/15 border-secondary text-on-surface"
                      : "bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:border-outline-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mb-1">engineering</span>
                  <span className="font-label text-[9px] font-bold truncate max-w-full">J. Miller</span>
                  <span className="text-[7px] opacity-75 uppercase">Tech</span>
                </button>

                <button
                  type="button"
                  onClick={() => selectDemoProfile("chen@preventive.intel", "Sys Eng")}
                  className={`flex flex-col items-center justify-center p-2.5 rounded border text-center transition-all cursor-pointer ${
                    selectedRole === "Sys Eng"
                      ? "bg-secondary/15 border-secondary text-on-surface"
                      : "bg-surface-container-low/40 border-outline-variant/30 text-on-surface-variant hover:bg-surface-container-low hover:border-outline-variant"
                  }`}
                >
                  <span className="material-symbols-outlined text-sm mb-1">construction</span>
                  <span className="font-label text-[9px] font-bold truncate max-w-full">S. Chen</span>
                  <span className="text-[7px] opacity-75 uppercase">Eng</span>
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Live Diagnostics Footer Panel */}
        <div className="bg-surface-container-low/60 px-6 py-4 border-t border-outline-variant/40 grid grid-cols-2 gap-x-4 gap-y-2 text-[8px] font-label text-on-surface-variant/80 tracking-wider">
          <div className="flex items-center justify-between border-r border-outline-variant/30 pr-2">
            <span className="opacity-50 uppercase">Location</span>
            <span className="font-bold text-on-surface">TARKWA, GH</span>
          </div>
          <div className="flex items-center justify-between pl-2">
            <span className="opacity-50 uppercase">Gateway</span>
            <span className="font-bold text-on-surface">UMaT-GW</span>
          </div>
          <div className="flex items-center justify-between border-r border-outline-variant/30 pr-2 col-span-1">
            <span className="opacity-50 uppercase">Security</span>
            <span className="font-bold text-green-500 flex items-center gap-1">
              <span className="w-1 h-1 rounded-full bg-green-500 animate-ping" />
              ADISADEL
            </span>
          </div>
          <div className="flex items-center justify-between pl-2 col-span-1">
            <span className="opacity-50 uppercase">Time</span>
            <span className="font-mono text-on-surface truncate max-w-[70px]">{currentTime ? currentTime.split(" ")[1] : "..."}</span>
          </div>
        </div>
      </div>
    </main>
  );
}
