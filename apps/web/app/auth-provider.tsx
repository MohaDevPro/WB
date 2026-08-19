'use client';

import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
} from 'react';

import { api, type CurrentUser, type Profile, type Session } from './api-client';

type AuthContextValue = Readonly<{
  error: string | null;
  isLoading: boolean;
  login: (email: string, password: string) => Promise<void>;
  logout: () => Promise<void>;
  profile: Profile | null;
  refreshProfile: () => Promise<void>;
  register: (email: string, password: string) => Promise<void>;
  session: Session | null;
  updateProfile: (profile: Profile) => Promise<void>;
  user: CurrentUser | null;
}>;

const sessionStorageKey = 'wb.session.v1';
const AuthContext = createContext<AuthContextValue | null>(null);

function readStoredSession(): Session | null {
  const serialized = window.sessionStorage.getItem(sessionStorageKey);

  if (serialized === null) {
    return null;
  }

  try {
    const session = JSON.parse(serialized) as Session;
    return new Date(session.expiresAt).getTime() > Date.now() ? session : null;
  } catch {
    return null;
  }
}

export function AuthProvider({ children }: Readonly<{ children: ReactNode }>) {
  const [session, setSession] = useState<Session | null>(null);
  const [user, setUser] = useState<CurrentUser | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const clearSession = useCallback(() => {
    window.sessionStorage.removeItem(sessionStorageKey);
    setSession(null);
    setUser(null);
    setProfile(null);
  }, []);

  const hydrate = useCallback(async (nextSession: Session) => {
    const [nextUser, nextProfile] = await Promise.all([
      api.getCurrentUser(nextSession.accessToken),
      api.getProfile(nextSession.accessToken),
    ]);
    window.sessionStorage.setItem(sessionStorageKey, JSON.stringify(nextSession));
    setSession(nextSession);
    setUser(nextUser);
    setProfile(nextProfile);
  }, []);

  useEffect(() => {
    const existing = readStoredSession();

    if (existing === null) {
      setIsLoading(false);
      return;
    }

    void hydrate(existing)
      .catch(() => clearSession())
      .finally(() => setIsLoading(false));
  }, [clearSession, hydrate]);

  const authenticate = useCallback(
    async (
      operation: (email: string, password: string) => Promise<Session>,
      email: string,
      password: string,
    ) => {
      setError(null);
      setIsLoading(true);

      try {
        await hydrate(await operation(email, password));
      } catch (reason) {
        setError(
          reason instanceof Error ? reason.message : 'Authentication could not be completed.',
        );
        throw reason;
      } finally {
        setIsLoading(false);
      }
    },
    [hydrate],
  );

  const value = useMemo<AuthContextValue>(
    () =>
      Object.freeze({
        error,
        isLoading,
        login: (email, password) => authenticate(api.login, email, password),
        logout: async () => {
          if (session !== null) {
            try {
              await api.logout(session.accessToken);
            } finally {
              clearSession();
            }
          }
        },
        profile,
        refreshProfile: async () => {
          if (session === null) {
            return;
          }
          setProfile(await api.getProfile(session.accessToken));
        },
        register: (email, password) => authenticate(api.register, email, password),
        session,
        updateProfile: async (nextProfile) => {
          if (session === null) {
            throw new Error('Please sign in before changing your profile.');
          }
          setProfile(await api.updateProfile(session.accessToken, nextProfile));
        },
        user,
      }),
    [authenticate, clearSession, error, isLoading, profile, session, user],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth(): AuthContextValue {
  const value = useContext(AuthContext);

  if (value === null) {
    throw new Error('useAuth must be rendered inside AuthProvider.');
  }

  return value;
}
