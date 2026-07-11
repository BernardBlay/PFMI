"use client";
import { useState } from "react";
import { useRouter } from "next/navigation";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";

export default function Login() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleLogin = (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    // Mock authentication
    setTimeout(() => {
      setLoading(false);
      router.push("/dashboard");
    }, 800);
  };

  return (
    <main className="min-h-screen flex flex-col bg-[var(--bg-primary)] text-[var(--text-primary)]">
      <Navbar />
      <div className="container mx-auto px-6 py-24 flex-1 flex items-center justify-center">
        <div className="w-full max-w-md p-8 rounded-lg bg-[var(--bg-card)] border border-[var(--border)] shadow-md">
          <div className="text-center mb-8">
            <h1 className="text-2xl font-bold">Sign in to PFMI</h1>
            <p className="text-[var(--text-secondary)] text-sm mt-2">
              Predictive Maintenance Intelligence Control Center
            </p>
          </div>

          <form onSubmit={handleLogin} className="space-y-6">
            <div>
              <label className="block text-sm font-semibold mb-2" htmlFor="email">
                Email Address
              </label>
              <input
                id="email"
                type="email"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="tech@pfmi.ai"
                className="w-full px-4 py-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors text-[var(--text-primary)]"
              />
            </div>

            <div>
              <div className="flex justify-between items-center mb-2">
                <label className="text-sm font-semibold" htmlFor="password">
                  Password
                </label>
                <a href="#" className="text-xs text-[var(--primary-light)] hover:underline">
                  Forgot Password?
                </a>
              </div>
              <input
                id="password"
                type="password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-4 py-3 rounded-md bg-[var(--bg-primary)] border border-[var(--border)] focus:outline-none focus:border-[var(--primary)] text-sm transition-colors text-[var(--text-primary)]"
              />
            </div>

            <button
              type="submit"
              disabled={loading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-semibold py-3 rounded-md text-sm transition-colors disabled:opacity-50"
            >
              {loading ? "Authenticating..." : "Sign In"}
            </button>
          </form>

          <p className="text-center text-xs text-[var(--text-muted)] mt-6">
            Demo mode: enter any credentials to log in.
          </p>
        </div>
      </div>
      <Footer />
    </main>
  );
}
