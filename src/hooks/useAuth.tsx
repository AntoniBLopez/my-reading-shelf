import { useState, useEffect, createContext, useContext, ReactNode, useRef } from 'react';
import { User, Session } from '@supabase/supabase-js';
import { supabase, isSupabaseConfigured } from '@/integrations/supabase/client';
import { LOCAL_USER_ID } from '@/lib/localStorage';

const LOCAL_USER: User = {
  id: LOCAL_USER_ID,
  app_metadata: {},
  user_metadata: {},
  aud: 'local',
  created_at: new Date().toISOString(),
  email: 'local@reading-shelf.local',
  email_confirmed_at: null,
  identities: [],
  is_anonymous: false,
  last_sign_in_at: new Date().toISOString(),
  phone: '',
  role: 'authenticated',
  updated_at: new Date().toISOString(),
};

/** URL a la que Supabase redirige en los enlaces de email (confirmación, recuperar contraseña). Usar VITE_APP_URL en producción. */
export function getAuthRedirectUrl(): string {
  const url = import.meta.env.VITE_APP_URL;
  if (typeof url === 'string' && url.length > 0) return url.replace(/\/$/, '');
  return window.location.origin;
}

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  isLocalOnly: boolean;
  signUp: (email: string, password: string) => Promise<{ error: Error | null }>;
  signIn: (email: string, password: string) => Promise<{ error: Error | null }>;
  signOut: () => Promise<void>;
  resetPassword: (email: string) => Promise<{ error: Error | null }>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const isLocalOnly = !isSupabaseConfigured();
  const lastTokenRef = useRef<string | null>(null);

  useEffect(() => {
    if (!isSupabaseConfigured() || !supabase) {
      setUser(LOCAL_USER);
      setSession(null);
      setLoading(false);
      return;
    }

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (_event, newSession) => {
        const newToken = newSession?.access_token ?? null;
        if (lastTokenRef.current === newToken) return;
        lastTokenRef.current = newToken;
        setSession(newSession);
        setUser(newSession?.user ?? null);
        setLoading(false);
      }
    );

    supabase.auth.getSession().then(({ data: { session: s } }) => {
      lastTokenRef.current = s?.access_token ?? null;
      setSession(s);
      setUser(s?.user ?? null);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, []);

  const signUp = async (email: string, password: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: new Error('Configure Supabase in .env for cloud sync') };
    }
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: getAuthRedirectUrl() },
    });
    if (error) return { error: error as Error };
    // Supabase no devuelve error si el email ya existe (evita enumeración). Detectamos: sin sesión y sin identities = ya registrado.
    if (!data.session && (!data.user?.identities || data.user.identities.length === 0)) {
      return { error: new Error('Este correo ya tiene una cuenta. Inicia sesión o usa otra dirección.') };
    }
    return { error: null };
  };

  const signIn = async (email: string, password: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: new Error('Configure Supabase in .env for cloud sync') };
    }
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    return { error: error as Error | null };
  };

  const signOut = async () => {
    if (supabase) await supabase.auth.signOut();
  };

  const resetPassword = async (email: string) => {
    if (!isSupabaseConfigured() || !supabase) {
      return { error: new Error('Configure Supabase in .env for cloud sync') };
    }
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${getAuthRedirectUrl()}/`,
    });
    return { error: error as Error | null };
  };

  return (
    <AuthContext.Provider value={{ user, session, loading, isLocalOnly, signUp, signIn, signOut, resetPassword }}>
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth() {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
}
