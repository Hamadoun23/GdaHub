"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
} from "react";
import {
  type AuthUser,
  clearToken,
  login as apiLogin,
  me as apiMe,
} from "@/jus/lib/api";

/**
 * TEMPORAIRE — voir le meme bloc dans `@/lib/session`. Jus d'orange a sa
 * propre session (API `/auth/me/`, hors service en local pendant la
 * refonte) : ce contournement lui est propre. `is_superuser: true` pour que
 * `canAccess`/`roleHome` (jus/lib/access.ts) laissent voir toutes les
 * sections. A retirer en meme temps que celui de `@/lib/session`.
 */
const APERCU_SANS_AUTH = process.env.NODE_ENV !== "production";

const USER_APERCU: AuthUser = {
  id: 0,
  username: "apercu",
  email: "apercu@gda.local",
  is_staff: true,
  is_superuser: true,
  roles: ["Direction"],
};

type AuthState = {
  user: AuthUser | null;
  loading: boolean;
  login: (u: string, p: string) => Promise<AuthUser>;
  logout: () => void;
  hasRole: (role: string) => boolean;
};

const AuthContext = createContext<AuthState | null>(null);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<AuthUser | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // La session est tentee meme sans jeton local.
    //
    // Servie par la passerelle de GDA Hub, l'application est jointe par
    // quelqu'un deja connecte au hub : la passerelle presente son jeton a
    // l'API, et « me » repond. Sans cet appel, le front afficherait son ecran
    // de connexion alors que la session est ouverte.
    //
    // Ouverte seule, l'application n'y perd qu'une requete au premier
    // chargement : « me » repond 401 et l'ecran de connexion s'affiche comme
    // avant.
    apiMe()
      .then(setUser)
      .catch(() => {
        clearToken();
        if (APERCU_SANS_AUTH) setUser(USER_APERCU);
      })
      .finally(() => setLoading(false));
  }, []);

  const login = useCallback(async (username: string, password: string) => {
    const { user } = await apiLogin(username, password);
    setUser(user);
    return user;
  }, []);

  const logout = useCallback(() => {
    clearToken();
    setUser(null);
  }, []);

  const hasRole = useCallback(
    (role: string) => Boolean(user?.roles?.includes(role)),
    [user]
  );

  return (
    <AuthContext.Provider value={{ user, loading, login, logout, hasRole }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error("useAuth doit être utilisé dans <AuthProvider>");
  return ctx;
}
