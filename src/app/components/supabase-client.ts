import { createClient, type Session } from "@supabase/supabase-js";
import { projectId, publicAnonKey } from "/utils/supabase/info";

const supabaseUrl = `https://${projectId}.supabase.co`;

export const supabase = createClient(supabaseUrl, publicAnonKey);

export const API_BASE = `${supabaseUrl}/functions/v1/make-server-48e8ada4`;

// ─── Session sync ───
// AuthProvider pushes the session here on every onAuthStateChange event.
// This is the SINGLE SOURCE OF TRUTH for the current session.
let _syncedSession: Session | null = null;

export function syncSession(session: Session | null) {
  _syncedSession = session;
}

// ─── Token management ───

/**
 * Get the current user's access token.
 * Never calls refreshSession() manually — the SDK handles that internally.
 */
async function getUserToken(): Promise<string | null> {
  // 1. Primary: use synced session from AuthProvider
  if (_syncedSession?.access_token) {
    return _syncedSession.access_token;
  }

  // 2. Fallback: SDK's in-memory session
  try {
    const { data } = await supabase.auth.getSession();
    if (data?.session?.access_token) {
      return data.session.access_token;
    }
  } catch (err) {
    console.warn("getUserToken: exception:", err);
  }

  return null;
}

/**
 * Authenticated fetch wrapper.
 *
 * KEY ARCHITECTURE:
 * In this environment, Kong (Supabase API gateway) only accepts the
 * project's anon key in the Authorization header. User JWTs placed in
 * Authorization are rejected with "Invalid JWT", and custom headers like
 * x-user-token trigger CORS preflight failures because Kong doesn't
 * include them in Access-Control-Allow-Headers.
 *
 * Solution:
 * - Authorization: Bearer ${publicAnonKey}  → satisfies Kong
 * - Query parameter _t=${userJWT}           → our server reads this for user auth
 *   (query params don't trigger CORS preflight)
 */
export async function apiFetch(
  path: string,
  options: RequestInit = {}
): Promise<Response> {
  const userToken = await getUserToken();

  // Build URL with user token as query parameter
  const separator = path.includes("?") ? "&" : "?";
  const url = userToken
    ? `${API_BASE}${path}${separator}_t=${encodeURIComponent(userToken)}`
    : `${API_BASE}${path}`;

  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${publicAnonKey}`,
    apikey: publicAnonKey,
  };

  const init: RequestInit = {
    ...options,
    headers: {
      ...headers,
      ...(options.headers as Record<string, string> || {}),
    },
  };

  const res = await fetch(url, init);

  // If our server returns 401 (user auth failure), try once more after a brief wait
  // (the SDK may have just refreshed the token via onAuthStateChange)
  if (res.status === 401 && userToken) {
    let body = "";
    try {
      body = await res.clone().text();
    } catch { /* ignore */ }
    console.warn(`⚠️ apiFetch ${path}: 401 response, retrying after delay…`, body);

    // Wait a moment for potential SDK auto-refresh
    await new Promise((r) => setTimeout(r, 1000));

    // Get potentially-updated token
    const freshToken = await getUserToken();
    if (freshToken) {
      const retryUrl = freshToken
        ? `${API_BASE}${path}${separator}_t=${encodeURIComponent(freshToken)}`
        : `${API_BASE}${path}`;
      console.log(`apiFetch ${path}: retrying with ${freshToken !== userToken ? "new" : "same"} token`);
      const retry = await fetch(retryUrl, init);
      return retry;
    }
  }

  return res;
}
