import { router } from 'expo-router';
import React, { createContext, useCallback, useContext, useEffect, useState } from 'react';
import type { Session } from '@supabase/supabase-js';
import { supabase } from '@/constants/supabase';
import { api } from '@/constants/api';
import type { UserProfile } from '@/constants/user-store';

type UserContextValue = {
  user:    UserProfile | null;
  session: Session | null;
  loading: boolean;
  refresh: () => Promise<void>;
  setUser: (u: UserProfile) => void;
  clearUser: () => Promise<void>;
};

const UserContext = createContext<UserContextValue>({
  user:    null,
  session: null,
  loading: true,
  refresh:   async () => {},
  setUser:   () => {},
  clearUser: async () => {},
});

export function UserProvider({ children }: { children: React.ReactNode }) {
  const [user,    setUserState]    = useState<UserProfile | null>(null);
  const [session, setSessionState] = useState<Session | null>(null);
  const [loading, setLoading]      = useState(true);

  const loadProfile = useCallback(async (sess: Session) => {
    try {
      const profile = await api.getUser(sess.user.id);
      setUserState(profile);
    } catch {
      // 404 = no profile yet → onboarding will create one
      setUserState(null);
    }
  }, []);

  useEffect(() => {
    // 1. Check existing session on mount
    supabase.auth.getSession().then(({ data: { session: sess } }) => {
      setSessionState(sess);
      if (sess) {
        loadProfile(sess).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // 2. Listen for future auth changes (login, logout, token refresh)
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, sess) => {
        setSessionState(sess);
        if (sess) {
          loadProfile(sess);
        } else {
          setUserState(null);
        }
      },
    );

    return () => subscription.unsubscribe();
  }, [loadProfile]);

  // Redirect based on auth + profile state
  useEffect(() => {
    if (loading) return;
    if (!session) {
      router.replace('/landing');
    } else if (!user) {
      router.replace('/onboarding');
    }
  }, [loading, session, user]);

  function setUser(u: UserProfile) {
    setUserState(u);
  }

  async function clearUser() {
    await supabase.auth.signOut();
    // onAuthStateChange will set session → null → redirect to /landing
  }

  const refresh = useCallback(async () => {
    if (session) await loadProfile(session);
  }, [session, loadProfile]);

  return (
    <UserContext.Provider value={{ user, session, loading, refresh, setUser, clearUser }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUser() {
  return useContext(UserContext);
}
