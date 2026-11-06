// Apparence et textes des écrans Clerk (connexion, inscription, menu du compte) aux couleurs de FarimaGame.
import { frFR } from "@clerk/localizations/fr-FR";
import { dark } from "@clerk/themes";
import { SIGNUP_BONUS_CORIS } from "./config";

const gold = "#fbbf24";
const orange = "#f97316";

export const clerkAppearance = {
  theme: dark,
  variables: {
    colorPrimary: gold,
    colorPrimaryForeground: "#020617",
    colorBackground: "#0b1428", // --surface
    colorForeground: "#f1f5f9", // --foreground
    colorMuted: "#101c36", // --surface-2
    colorMutedForeground: "#94a3b8",
    colorInput: "#0f172a",
    colorInputForeground: "#f8fafc",
    colorBorder: "rgba(255, 255, 255, 0.12)",
    colorRing: "rgba(251, 191, 36, 0.45)",
    colorDanger: "#fb7185",
    colorSuccess: "#34d399",
    colorWarning: gold,
    colorModalBackdrop: "rgba(2, 6, 23, 0.75)",
    fontFamily: "var(--font-geist-sans), ui-sans-serif, system-ui, sans-serif",
    borderRadius: "0.75rem",
  },
  elements: {
    rootBox: { width: "100%" },
    cardBox: {
      width: "100%",
      maxWidth: "26rem",
      margin: "0 auto",
      border: "1px solid rgba(255, 255, 255, 0.08)",
      boxShadow: "0 1px 0 0 rgba(255,255,255,0.04) inset, 0 24px 60px -20px rgba(0,0,0,0.75), 0 10px 30px -12px rgba(249,115,22,0.25)",
    },
    formButtonPrimary: {
      backgroundImage: `linear-gradient(90deg, ${gold}, ${orange})`,
      color: "#020617",
      fontWeight: 700,
      border: "none",
      boxShadow: "0 6px 18px -6px rgba(251, 191, 36, 0.45)",
      "&:hover": { filter: "brightness(1.1)" },
    },
    footerActionLink: { color: gold, fontWeight: 600 },
    userButtonAvatarBox: { width: "2rem", height: "2rem", boxShadow: "0 0 0 1px rgba(255,255,255,0.12)" },
  },
};

export const clerkLocalization = {
  ...frFR,
  signIn: {
    ...frFR.signIn,
    start: { ...frFR.signIn?.start, title: "Connexion à FarimaGame", subtitle: "Content de vous revoir ! Connectez-vous pour jouer et parier." },
  },
  signUp: {
    ...frFR.signUp,
    start: {
      ...frFR.signUp?.start,
      title: "Créer un compte joueur",
      subtitle: `${SIGNUP_BONUS_CORIS} Coris de bienvenue offerts pour commencer à jouer.`,
    },
  },
};
