// Configuration Clerk partagée (serveur + navigateur : uniquement des valeurs publiques).
//
// Clerk est actif :
//  - en production, dès que NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY est défini (avec CLERK_SECRET_KEY côté serveur) ;
//  - en développement (`npm run dev`), même sans clé : Clerk passe en « keyless mode » et crée tout seul
//    une application de test temporaire (clés rangées dans le dossier .clerk/, ignoré par git).
// Sans clé en production, la connexion est désactivée (tout le monde est déconnecté) : les pages publiques
// (accueil, paris, cotes) restent consultables, mais personne ne peut jouer ni parier.
export const CLERK_ENABLED =
  Boolean(process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY) ||
  (process.env.NODE_ENV !== "production" && !["1", "true"].includes(process.env.NEXT_PUBLIC_CLERK_KEYLESS_DISABLED ?? ""));

export const SIGN_IN_URL = "/connexion";
export const SIGN_UP_URL = "/inscription";
export const AFTER_SIGN_IN_URL = "/salon";
export const AFTER_SIGN_UP_URL = "/tableau-de-bord?bienvenue=1";

/** Pages réservées aux joueurs connectés (les API vérifient aussi la connexion de leur côté). */
const PROTECTED_PREFIXES = ["/tableau-de-bord", "/portefeuille", "/pro", "/salon", "/jeu", "/paris/mes-paris", "/maison", "/admin"];

export function isProtectedPath(pathname: string) {
  return PROTECTED_PREFIXES.some((p) => pathname === p || pathname.startsWith(p + "/"));
}
