
"use client";

import { useCrm } from "@/lib/store";
import { useAuth } from "@/components/auth-provider";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useState } from "react";
import {
  Building2, Lock, Mail, Eye, EyeOff, Shield,
  MapPin, TrendingUp, AlertCircle, CheckCircle2,
} from "lucide-react";

export default function LoginPage() {
  const { settings } = useCrm();
  const { signIn } = useAuth();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPwd, setShowPwd] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);
    const result = await signIn(email, password);
    if (!result.ok) {
      setError(result.error ?? "Invalid email or password.");
      setLoading(false);
    }
  };

  const features = [
    { icon: MapPin, title: "Interactive Layouts", desc: "Click-to-manage plot overlays" },
    { icon: TrendingUp, title: "Real-time Analytics", desc: "Sales, revenue & outstanding tracking" },
    { icon: Shield, title: "Role-based Access", desc: "Admin, Manager, Marketing, Viewer" },
  ];

  return (
    <div className="min-h-screen flex bg-background">
      {/* Left brand panel */}
      <div className="hidden lg:flex lg:w-[48%] bg-sidebar text-sidebar-foreground flex-col p-12 relative overflow-hidden">
        {/* ambient glows */}
        <div className="absolute -top-24 -left-24 w-96 h-96 rounded-full bg-sidebar-primary/20 blur-3xl" />
        <div className="absolute bottom-0 right-0 w-[28rem] h-[28rem] rounded-full bg-emerald-600/20 blur-3xl" />
        <div className="absolute top-1/3 right-1/4 w-72 h-72 rounded-full bg-amber-500/10 blur-3xl" />
        {/* subtle grid texture */}
        <div
          className="absolute inset-0 opacity-[0.04] pointer-events-none"
          style={{
            backgroundImage:
              "linear-gradient(rgb(255 255 255 / 0.7) 1px, transparent 1px), linear-gradient(90deg, rgb(255 255 255 / 0.7) 1px, transparent 1px)",
            backgroundSize: "48px 48px",
          }}
        />
        {/* top accent line */}
        <div className="absolute top-0 left-0 right-0 h-px bg-gradient-to-r from-transparent via-sidebar-primary to-transparent" />

        <div className="relative z-10 flex flex-col h-full">
          <div className="flex items-center gap-3">
            <div className="w-11 h-11 rounded-xl bg-sidebar-primary text-sidebar-primary-foreground grid place-items-center shadow-lg">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-lg font-bold tracking-tight">{settings?.companyName ?? "VGG Infra Developers"}</div>
              <div className="text-[10px] text-sidebar-foreground/50 uppercase tracking-widest">CRM Suite</div>
            </div>
          </div>

          <div className="flex-1 flex flex-col justify-center max-w-lg">
            <span className="inline-flex w-fit items-center gap-1.5 px-3 py-1 rounded-full text-[11px] font-semibold tracking-wide bg-sidebar-primary/15 text-sidebar-primary border border-sidebar-primary/20 mb-6">
              <CheckCircle2 className="w-3.5 h-3.5" />
              VGG Infra Real Estate CRM
            </span>
            <h1 className="text-[2.75rem] leading-[1.12] font-bold tracking-tight">
              Manage your projects &amp; plots with confidence.
            </h1>
            <p className="text-sidebar-foreground/70 text-lg leading-relaxed mt-5">
              Complete control over layouts, bookings, sales, and payments — all in one secure place.
            </p>

            <div className="mt-10 grid gap-3">
              {features.map((f) => (
                <div
                  key={f.title}
                  className="flex items-center gap-4 rounded-xl bg-sidebar-accent/40 border border-white/5 px-4 py-3 backdrop-blur-sm"
                >
                  <div className="w-10 h-10 rounded-lg bg-sidebar-primary/20 text-sidebar-primary grid place-items-center shrink-0">
                    <f.icon className="w-[18px] h-[18px]" />
                  </div>
                  <div>
                    <div className="font-semibold text-sm">{f.title}</div>
                    <div className="text-xs text-sidebar-foreground/60">{f.desc}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="flex items-center gap-2 text-xs text-sidebar-foreground/50">
            <Shield className="w-3.5 h-3.5" />
            <span>
              © {new Date().getFullYear()} {settings?.companyName ?? "VGG Infra Developers"}. All rights reserved.
            </span>
          </div>
        </div>
      </div>

      {/* Right form panel */}
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="w-full max-w-md">
          {/* Mobile brand header */}
          <div className="lg:hidden flex items-center gap-3 mb-8 justify-center">
            <div className="w-11 h-11 rounded-xl bg-primary text-primary-foreground grid place-items-center">
              <Building2 className="w-5 h-5" />
            </div>
            <div>
              <div className="text-base font-bold">{settings?.companyName ?? "VGG Infra Developers"}</div>
              <div className="text-[10px] text-muted-foreground uppercase tracking-wider">CRM Suite</div>
            </div>
          </div>

          <div className="rounded-2xl border bg-card p-8 shadow-[0_8px_30px_-12px_oklch(0.2_0.02_250/0.2)]">
            <div className="mb-8">
              <h2 className="text-2xl font-bold tracking-tight">Welcome back</h2>
              <p className="text-sm text-muted-foreground mt-1">Sign in to your CRM account to continue.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <div>
                <Label htmlFor="email" className="text-xs font-medium">Email Address</Label>
                <div className="relative mt-1.5">
                  <Mail className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className="pl-9 h-11 focus-visible:ring-2 focus-visible:ring-primary/30"
                    placeholder="you@vgginfra.com"
                    required
                    autoComplete="email"
                  />
                </div>
              </div>
              <div>
                <Label htmlFor="password" className="text-xs font-medium">Password</Label>
                <div className="relative mt-1.5">
                  <Lock className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
                  <Input
                    id="password"
                    type={showPwd ? "text" : "password"}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    className="pl-9 pr-10 h-11 focus-visible:ring-2 focus-visible:ring-primary/30"
                    placeholder="••••••••"
                    required
                    autoComplete="current-password"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPwd((v) => !v)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                    tabIndex={-1}
                    aria-label={showPwd ? "Hide password" : "Show password"}
                  >
                    {showPwd ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>
              {error && (
                <div className="p-3 rounded-lg bg-destructive/10 border border-destructive/20 text-destructive text-sm flex items-start gap-2">
                  <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
                  <span>{error}</span>
                </div>
              )}
              <Button type="submit" className="w-full h-11 btn-premium font-semibold" disabled={loading}>
                {loading ? (
                  <span className="flex items-center gap-2">
                    <span className="w-4 h-4 rounded-full border-2 border-primary-foreground border-t-transparent animate-spin" />
                    Signing in…
                  </span>
                ) : "Sign In"}
              </Button>
            </form>
          </div>

          <p className="text-center text-xs text-muted-foreground mt-6">
            Need help? Contact your system administrator.
          </p>
        </div>
      </div>
    </div>
  );
}


