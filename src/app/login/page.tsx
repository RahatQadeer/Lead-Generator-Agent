import Image from "next/image";
import { Suspense } from "react";
import {
  LoginPipelineGraph,
  LoginPipelineSteps,
} from "@/components/auth/LoginPipelineGraph";
import { GoogleLoginButton } from "@/components/auth/GoogleLoginButton";
import { AuthErrorBanner } from "@/components/auth/AuthErrorBanner";

const LOGO_SRC = "/lead-generation-logo.png";

interface LoginPageProps {
  searchParams: Promise<{ error?: string; redirect?: string }>;
}

function LoginBackdrop() {
  return (
    <>
      <div
        className="pointer-events-none absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_50%_0%,rgba(139,92,246,0.11),transparent)]"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -right-20 bottom-0 h-96 w-96 rounded-full bg-indigo-600/10 blur-3xl"
        aria-hidden
      />
      <div
        className="pointer-events-none absolute -left-16 top-1/4 h-64 w-64 rounded-full bg-violet-500/6 blur-3xl"
        aria-hidden
      />
    </>
  );
}

function LoginContent({
  error,
  redirectTo,
}: {
  error: string | null;
  redirectTo: string;
}) {
  return (
    <div className="relative min-h-screen overflow-hidden bg-[#0a0f18]">
      <LoginBackdrop />
      <div className="relative z-10 grid min-h-screen lg:grid-cols-2">
        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-lg lg:mx-0">
            <div className="flex w-full justify-center">
              <div className="inline-flex flex-col items-center text-center">
                <div className="flex items-center gap-4">
                  <Image
                    src={LOGO_SRC}
                    alt=""
                    width={56}
                    height={56}
                    className="h-14 w-14 shrink-0 rounded-xl object-contain"
                    priority
                  />
                  <h1 className="text-xl font-bold tracking-[-0.02em] !text-white sm:text-2xl">
                    RightTail
                  </h1>
                </div>
                <h2 className="mt-2 text-xl font-semibold tracking-[-0.01em] !text-white sm:text-2xl">
                  Lead Generation Agent
                </h2>
              </div>
            </div>
            <p className="mt-4 text-center text-sm leading-relaxed text-gray-400">
              AI-powered prospecting, lead scoring, and outreach — all in one
              place.
            </p>

            <LoginPipelineSteps className="mt-6" />

            <div className="mt-8">
              <div className="rounded-3xl border border-white/10 bg-white/[0.06] p-6 shadow-[inset_0_1px_0_rgba(255,255,255,0.06)] backdrop-blur-sm sm:p-8">
                <AuthErrorBanner errorCode={error} />
                <GoogleLoginButton redirectTo={redirectTo} />
              </div>

              <p className="mt-6 text-[11px] leading-relaxed text-gray-500">
                By signing in, you agree to our terms of service and privacy
                policy.
              </p>
            </div>
          </div>
        </div>

        <div className="flex flex-col justify-center px-6 py-10 sm:px-10 lg:px-12 xl:px-16">
          <div className="mx-auto w-full max-w-3xl">
            <LoginPipelineGraph />
          </div>
        </div>
      </div>
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
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-[#0a0f18]">
          <div className="flex items-center gap-3 rounded-2xl border border-white/10 bg-white/5 px-5 py-4">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-white/20 border-t-white" />
            <span className="text-sm font-medium text-gray-300">Loading…</span>
          </div>
        </div>
      }
    >
      <LoginPageInner {...props} />
    </Suspense>
  );
}
