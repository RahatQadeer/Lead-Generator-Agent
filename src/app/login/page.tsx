import { Suspense } from "react";
import { Sparkles, Target, Mail, BarChart3 } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

function LoginContent({
  error,
  redirectTo,
}: {
  error: string | null;
  redirectTo: string;
}) {
  return (
    <div className="relative flex min-h-screen flex-col lg:flex-row">
      {/* Decorative background */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden">
        <div className="animate-pulse-glow absolute -left-32 top-0 h-96 w-96 rounded-full bg-cyan-500/10 blur-3xl" />
        <div className="animate-pulse-glow absolute -right-32 bottom-0 h-96 w-96 rounded-full bg-blue-600/10 blur-3xl" />
      </div>

      {/* Left panel — branding */}
      <div className="relative flex flex-1 flex-col justify-center px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-lg lg:mx-0">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gradient-to-br from-cyan-400 to-blue-600 shadow-lg shadow-cyan-500/25">
              <Sparkles className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-white">LeadForge</h2>
              <p className="text-sm text-slate-500">AI Sales Development Platform</p>
            </div>
          </div>

          <h1 className="text-3xl font-bold leading-tight tracking-tight text-white sm:text-4xl lg:text-5xl">
            Find leads.
            <br />
            <span className="bg-gradient-to-r from-cyan-400 to-blue-500 bg-clip-text text-transparent">
              Close faster.
            </span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-slate-400 sm:text-lg">
            Automate prospecting, contact discovery, and personalized outreach —
            so your sales team focuses on closing deals.
          </p>

          <div className="mt-10 grid gap-4 sm:grid-cols-3">
            <FeaturePill icon={Target} label="Smart targeting" />
            <FeaturePill icon={Mail} label="AI outreach" />
            <FeaturePill icon={BarChart3} label="Live analytics" />
          </div>
        </div>
      </div>

      {/* Right panel — login card */}
      <div className="relative flex flex-1 items-center justify-center px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className="rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl shadow-black/40 backdrop-blur-xl sm:p-10">
            <div className="mb-8 text-center">
              <h3 className="text-xl font-semibold text-white">Sign in to continue</h3>
              <p className="mt-2 text-sm text-slate-400">
                Use your Google Workspace account to access the platform.
              </p>
            </div>

            <AuthErrorBanner errorCode={error} />

            <GoogleLoginButton redirectTo={redirectTo} />

            <p className="mt-6 text-center text-xs text-slate-600">
              By signing in, you agree to our terms of service and privacy policy.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">
            Secure authentication powered by Google OAuth
          </p>
        </div>
      </div>
    </div>
  );
}

function FeaturePill({
  icon: Icon,
  label,
}: {
  icon: React.ComponentType<{ className?: string }>;
  label: string;
}) {
  return (
    <div className="flex items-center gap-2 rounded-lg border border-white/5 bg-white/5 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-cyan-400" />
      <span className="text-xs font-medium text-slate-300">{label}</span>
    </div>
  );
}

async function LoginPageInner({ searchParams }: LoginPageProps) {
  const params = await searchParams;
  const error = params.error ?? null;
  const redirectTo = params.redirect ?? "/dashboard";

  return <LoginContent error={error} redirectTo={redirectTo} />;
}

export default function LoginPage(props: LoginPageProps) {
  return (
    <div className="min-h-screen bg-slate-950">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-slate-400">
            Loading…
          </div>
        }
      >
        <LoginPageInner {...props} />
      </Suspense>
    </div>
  );
}
