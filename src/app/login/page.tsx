import { Suspense } from "react";
import { LayoutGrid, Target, Mail, BarChart3 } from "lucide-react";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";
import {
  cardClassName,
  cardPaddingClassName,
  headingPageClassName,
  iconTileClassName,
} from "@/lib/ui/styles";

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
    <div className="flex min-h-screen flex-col lg:flex-row">
      <div className="flex flex-1 flex-col justify-center bg-white px-6 py-12 sm:px-12 lg:px-16">
        <div className="mx-auto w-full max-w-lg lg:mx-0">
          <div className="mb-8 flex items-center gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-xl bg-gray-900 shadow-sm">
              <LayoutGrid className="h-5 w-5 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold text-gray-900">LeadForge</h2>
              <p className="text-sm text-gray-500">Enterprise Revenue Operations</p>
            </div>
          </div>

          <h1 className={`${headingPageClassName} lg:text-5xl`}>
            Find leads.
            <br />
            <span className="text-blue-600">Close faster.</span>
          </h1>

          <p className="mt-4 text-base leading-relaxed text-gray-600 sm:text-lg">
            Automate prospecting, contact discovery, and personalized outreach —
            so your sales team focuses on closing deals.
          </p>

          <div className="mt-10 grid gap-3 sm:grid-cols-3">
            <FeaturePill icon={Target} label="Smart targeting" />
            <FeaturePill icon={Mail} label="AI outreach" />
            <FeaturePill icon={BarChart3} label="Live analytics" />
          </div>
        </div>
      </div>

      <div className="flex flex-1 items-center justify-center bg-gray-50 px-6 py-12 sm:px-12">
        <div className="w-full max-w-md">
          <div className={`${cardClassName} ${cardPaddingClassName}`}>
            <div className="mb-8 text-center">
              <h3 className="text-xl font-semibold text-gray-900">
                Sign in to continue
              </h3>
              <p className="mt-2 text-sm text-gray-500">
                Use your Google Workspace account to access the platform.
              </p>
            </div>

            <AuthErrorBanner errorCode={error} />

            <GoogleLoginButton redirectTo={redirectTo} />

            <p className="mt-6 text-center text-xs text-gray-400">
              By signing in, you agree to our terms of service and privacy
              policy.
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-gray-400">
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
    <div className="flex items-center gap-2 rounded-xl border border-gray-200 bg-gray-50 px-3 py-2.5">
      <Icon className="h-4 w-4 shrink-0 text-blue-600" />
      <span className="text-xs font-medium text-gray-700">{label}</span>
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
    <div className="min-h-screen bg-gray-50">
      <Suspense
        fallback={
          <div className="flex min-h-screen items-center justify-center text-gray-500">
            Loading…
          </div>
        }
      >
        <LoginPageInner {...props} />
      </Suspense>
    </div>
  );
}
