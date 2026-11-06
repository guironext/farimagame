"use client";

import { useAuth } from "@clerk/nextjs";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { CLERK_ENABLED } from "@/lib/clerk";
import { api } from "@/lib/client";
import type { PublicUser } from "@/lib/types";

export interface AppConfig {
  CORIS_PER_LION: number;
  PRO_STAKE_LIONS: number;
  STAKE_CORIS: number;
  SIGNUP_BONUS_CORIS: number;
  WINNER_SHARE: number;
  FCFA_PER_LION: number;
  DEPOSIT_MIN_FCFA: number;
  DEPOSIT_MAX_FCFA: number;
  WITHDRAW_MIN_FCFA: number;
  WITHDRAW_MAX_FCFA: number;
  BET_MIN_FCFA: number;
  BET_MAX_FCFA: number;
  BET_WINNERS_SHARE: number;
  BET_HOUSE_SHARE: number;
}

interface Session {
  me: PublicUser | null;
  config: AppConfig | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setMe: (u: PublicUser | null) => void;
}

const Ctx = createContext<Session>({
  me: null,
  config: null,
  loading: true,
  refresh: async () => {},
  setMe: () => {},
});

export function SessionProvider({ children }: { children: React.ReactNode }) {
  const [me, setMe] = useState<PublicUser | null>(null);
  const [config, setConfig] = useState<AppConfig | null>(null);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    try {
      const r = await api<{ user: PublicUser | null; config: AppConfig }>("/api/me");
      setMe(r.user);
      setConfig(r.config);
    } catch {
      setMe(null);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    refresh();
  }, [refresh]);

  return (
    <Ctx.Provider value={{ me, config, loading, refresh, setMe }}>
      {CLERK_ENABLED && <ClerkSessionSync refresh={refresh} />}
      {children}
    </Ctx.Provider>
  );
}

/** Recharge /api/me quand l'utilisateur se connecte, se déconnecte ou change de compte Clerk. */
function ClerkSessionSync({ refresh }: { refresh: () => Promise<void> }) {
  const { isLoaded, userId } = useAuth();
  const last = useRef<string | null | undefined>(undefined);
  useEffect(() => {
    if (!isLoaded) return;
    const current = userId ?? null;
    if (last.current !== undefined && last.current !== current) refresh();
    last.current = current;
  }, [isLoaded, userId, refresh]);
  return null;
}

export const useSession = () => useContext(Ctx);
