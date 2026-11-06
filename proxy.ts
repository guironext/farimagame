// Proxy Next.js 16 (ex-« middleware ») : session Clerk + redirection des pages réservées vers /connexion.
// Les routes /api/* ne sont jamais redirigées ici : elles renvoient elles-mêmes 401 / 403 (lib/server/auth.ts).
import { clerkMiddleware } from "@clerk/nextjs/server";
import { NextResponse, type NextFetchEvent, type NextRequest } from "next/server";
import { CLERK_ENABLED, SIGN_IN_URL, SIGN_UP_URL, isProtectedPath } from "@/lib/clerk";

function redirectToSignIn(req: NextRequest) {
  const url = new URL(SIGN_IN_URL, req.url);
  url.searchParams.set("redirect_url", req.nextUrl.pathname + req.nextUrl.search);
  return NextResponse.redirect(url);
}

/** Une navigation interne (RSC) ne doit pas recevoir une redirection : Next.js affiche alors « This page couldn't load ». */
function isDocumentNavigation(req: NextRequest) {
  const dest = req.headers.get("sec-fetch-dest");
  return dest === "document" || dest === "iframe" || !req.headers.has("rsc");
}

const withClerk = clerkMiddleware(
  async (auth, req) => {
    if (!isProtectedPath(req.nextUrl.pathname)) return;
    const { userId } = await auth();
    if (!userId && isDocumentNavigation(req)) return redirectToSignIn(req);
  },
  { signInUrl: SIGN_IN_URL, signUpUrl: SIGN_UP_URL },
);

/** Sans Clerk (production sans clés) : personne n'est connecté, les pages réservées renvoient vers /connexion. */
function withoutClerk(req: NextRequest) {
  return isProtectedPath(req.nextUrl.pathname) && isDocumentNavigation(req) ? redirectToSignIn(req) : NextResponse.next();
}

export default async function proxy(req: NextRequest, event: NextFetchEvent) {
  if (!CLERK_ENABLED) return withoutClerk(req);
  let res: Awaited<ReturnType<typeof withClerk>>;
  try {
    res = await withClerk(req, event);
  } catch (e) {
    // Requête interne (pas un document) : Clerk demande une poignée de main sans redirection.
    if (e instanceof Error && e.message.includes("handshake status without redirect")) return NextResponse.next();
    throw e;
  }
  // En mode keyless (développement sans clés), tant que le navigateur n'a pas reçu le cookie des clés temporaires,
  // Clerk laisse passer la requête en « déconnecté » sans appeler notre fonction : on redirige quand même.
  if (
    isDocumentNavigation(req) &&
    isProtectedPath(req.nextUrl.pathname) &&
    res instanceof Response &&
    !(res.status >= 300 && res.status < 400) &&
    res.headers.get("x-middleware-request-x-clerk-auth-status") === "signed-out"
  ) {
    return redirectToSignIn(req);
  }
  return res;
}

export const config = {
  matcher: [
    // Tout sauf les fichiers internes de Next.js et les fichiers statiques (sauf s'ils sont dans la query string)
    "/((?!_next|[^?]*\\.(?:html?|css|js(?!on)|jpe?g|webp|png|gif|svg|ttf|woff2?|ico|csv|docx?|xlsx?|zip|webmanifest|mp4)).*)",
    // Toujours pour les routes API
    "/(api|trpc)(.*)",
    // Routes Clerk (Frontend API)
    "/__clerk/(.*)",
  ],
};
