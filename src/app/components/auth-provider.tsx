import { createContext, useContext, useEffect, useState, useCallback, useRef, type ReactNode } from "react";
import { supabase, syncSession } from "./supabase-client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextType {
  user: User | null;
  session: Session | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  user: null,
  session: null,
  loading: true,
  signOut: async () => {},
});

export function useAuth() {
  return useContext(AuthContext);
}

/**
 * Check if a session's access token is still valid (at least 10s remaining).
 */
function isSessionValid(session: Session | null): boolean {
  if (!session?.access_token) return false;
  const expiresAt = session.expires_at ?? 0;
  const nowSec = Math.floor(Date.now() / 1000);
  return expiresAt - nowSec > 10;
}

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const initialDone = useRef(false);

  useEffect(() => {
    let mounted = true;

    /**
     * KEY FIX FOR 401 "Invalid JWT" BUG
     * ===================================
     *
     * We listen to onAuthStateChange for ALL session events.
     * We NEVER call refreshSession() manually — the SDK does it internally.
     *
     * Critical behavior:
     * - On INITIAL_SESSION: if the token is EXPIRED, we keep loading=true
     *   because the SDK is about to fire TOKEN_REFRESHED with a valid token.
     *   This prevents the app from making API calls with a stale token.
     * - On TOKEN_REFRESHED or SIGNED_IN: we set loading=false because
     *   we now have a definitely-valid token.
     * - Safety timeout (5s): if no refresh event arrives, stop loading
     *   anyway (the user may need to re-login).
     */

    // Safety timeout to prevent infinite loading
    const safetyTimer = setTimeout(() => {
      if (!initialDone.current && mounted) {
        console.warn("AuthProvider: safety timeout — releasing loading state");
        initialDone.current = true;
        setLoading(false);
      }
    }, 5000);

    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, s) => {
        if (!mounted) return;

        console.log(
          `AuthProvider: ${event}`,
          s ? `(user: ${s.user?.email}, expires_at: ${s.expires_at})` : "(no session)"
        );

        // Always sync session to the module-level variable
        syncSession(s);
        setSession(s);
        setUser(s?.user ?? null);

        if (!initialDone.current) {
          if (event === "INITIAL_SESSION") {
            if (!s) {
              // No session at all → show login screen
              console.log("AuthProvider: no session → loading done");
              initialDone.current = true;
              setLoading(false);
            } else if (isSessionValid(s)) {
              // Valid token → safe to render the app
              console.log("AuthProvider: valid initial session → loading done");
              initialDone.current = true;
              setLoading(false);
            } else {
              // Expired token → SDK will auto-refresh, wait for TOKEN_REFRESHED
              console.log("AuthProvider: initial session has expired token, waiting for SDK refresh…");
              // Don't set loading=false — wait for TOKEN_REFRESHED event
            }
          } else {
            // TOKEN_REFRESHED, SIGNED_IN, etc. → we have a fresh token
            console.log(`AuthProvider: ${event} → loading done`);
            initialDone.current = true;
            setLoading(false);
          }
        }
      }
    );

    return () => {
      mounted = false;
      clearTimeout(safetyTimer);
      subscription.unsubscribe();
    };
  }, []);

  const signOut = useCallback(async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  }, []);

  return (
    <AuthContext.Provider value={{ user, session, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
