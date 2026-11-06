import { SignUp } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell, AuthSkeleton, AuthUnavailable } from "@/components/AuthShell";
import { AFTER_SIGN_UP_URL, CLERK_ENABLED, SIGN_IN_URL } from "@/lib/clerk";

export const metadata = { title: "Inscription – FarimaGame" };

export default function Page() {
  return (
    <AuthShell mode="register">
      {CLERK_ENABLED ? (
        <Suspense fallback={<AuthSkeleton />}>
          <SignUp path="/inscription" routing="path" signInUrl={SIGN_IN_URL} fallbackRedirectUrl={AFTER_SIGN_UP_URL} />
        </Suspense>
      ) : (
        <AuthUnavailable />
      )}
    </AuthShell>
  );
}
