import { SignIn } from "@clerk/nextjs";
import { Suspense } from "react";
import { AuthShell, AuthSkeleton, AuthUnavailable } from "@/components/AuthShell";
import { AFTER_SIGN_IN_URL, CLERK_ENABLED, SIGN_UP_URL } from "@/lib/clerk";

export const metadata = { title: "Connexion – FarimaGame" };

export default function Page() {
  return (
    <AuthShell mode="login">
      {CLERK_ENABLED ? (
        <Suspense fallback={<AuthSkeleton />}>
          <SignIn path="/connexion" routing="path" signUpUrl={SIGN_UP_URL} fallbackRedirectUrl={AFTER_SIGN_IN_URL} />
        </Suspense>
      ) : (
        <AuthUnavailable />
      )}
    </AuthShell>
  );
}
