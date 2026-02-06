import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";
import * as kv from "./kv_store.tsx";

const app = new Hono();

// Seed: ensure at least one demo invited email exists
(async () => {
  try {
    const demoEmail = "demo@nutriplan.it";
    const existing = await kv.get(`invited_email:${demoEmail}`);
    if (!existing) {
      await kv.set(`invited_email:${demoEmail}`, {
        email: demoEmail,
        name: "Utente Demo",
        invited_by: "system",
        invited_at: new Date().toISOString(),
      });
      console.log(`Seed: invited email ${demoEmail} created.`);
    }
  } catch (err) {
    console.log("Seed error (non-blocking):", err);
  }
})();

// Enable logger
app.use("*", logger(console.log));

// Enable CORS for all routes and methods
app.use(
  "/*",
  cors({
    origin: "*",
    allowHeaders: ["Content-Type", "Authorization", "apikey"],
    allowMethods: ["GET", "POST", "PUT", "DELETE", "OPTIONS"],
    exposeHeaders: ["Content-Length"],
    maxAge: 600,
  })
);

// Singleton Supabase clients (created once at module level)
const supabaseUrl = Deno.env.get("SUPABASE_URL") ?? "";
const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY") ?? "";
const anonKey = Deno.env.get("SUPABASE_ANON_KEY") ?? "";

// Server-side clients: disable auto-refresh and session persistence
// to prevent internal state conflicts in a stateless server environment.
const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, serverAuthOptions);
const anonSupabase = createClient(supabaseUrl, anonKey, serverAuthOptions);

// Helper: verify authenticated user from Hono context
// The frontend sends the user JWT as query parameter `_t` because:
// 1. Kong requires Authorization to contain the project's anon key
// 2. Custom headers (x-user-token) trigger CORS preflight failures at Kong level
// Query parameters bypass CORS entirely.
const authenticateUser = async (c: any) => {
  // Read user JWT from the `_t` query parameter
  const url = new URL(c.req.url);
  const userToken = url.searchParams.get("_t");
  if (!userToken) {
    console.log("Auth: No _t query parameter");
    return { user: null, reason: "missing_token" };
  }
  // Reject if the token is the anon key itself (not a user JWT)
  if (userToken === anonKey) {
    console.log("Auth: Received anon key instead of user JWT in _t param");
    return { user: null, reason: "anon_key_not_jwt" };
  }
  try {
    const {
      data: { user },
      error,
    } = await anonSupabase.auth.getUser(userToken);
    if (error) {
      console.log("Auth: getUser error:", error.message, "| token length:", userToken.length);
      return { user: null, reason: `getUser_error: ${error.message}` };
    }
    if (!user?.id) {
      console.log("Auth: No user id returned");
      return { user: null, reason: "no_user_id" };
    }
    return { user, reason: null };
  } catch (err) {
    console.log("Auth: Exception during getUser:", err);
    return { user: null, reason: `exception: ${err}` };
  }
};

// Helper: safely parse JSON body from Hono context
const parseBody = async (c: any) => {
  try {
    return await c.req.json();
  } catch (err) {
    console.log("Body parse error:", err);
    return null;
  }
};

// Health check endpoint
app.get("/make-server-48e8ada4/health", (c) => {
  return c.json({ status: "ok" });
});

// ─── AUTH ROUTES ───

// POST /check-email — Check if email is invited and if user already exists
app.post("/make-server-48e8ada4/check-email", async (c) => {
  try {
    const body = await parseBody(c);
    if (!body?.email || typeof body.email !== "string") {
      return c.json({ error: "Email richiesta." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    // Check if email is in the invited list
    const invited = await kv.get(`invited_email:${normalizedEmail}`);
    if (!invited) {
      return c.json({
        status: "not_invited",
        message: "Questa email non è autorizzata. Contatta l'amministratore.",
      });
    }

    // Check if user already exists in Supabase Auth
    const { data: usersData } = await adminSupabase.auth.admin.listUsers({
      page: 1,
      perPage: 1000,
    });

    const existingUser = usersData?.users?.find(
      (u: any) => u.email?.toLowerCase() === normalizedEmail
    );

    if (existingUser) {
      return c.json({
        status: "existing_user",
        message: "Bentornato! Inserisci la tua password per accedere.",
      });
    }

    return c.json({
      status: "new_user",
      message: "Benvenuto! Imposta la tua password per completare la registrazione.",
    });
  } catch (err) {
    console.log("Error in check-email:", err);
    return c.json({ error: `Errore durante la verifica email: ${err}` }, 500);
  }
});

// POST /signup — Create a new user (first-time onboarding)
app.post("/make-server-48e8ada4/signup", async (c) => {
  try {
    const body = await parseBody(c);
    if (!body?.email || !body?.password) {
      return c.json({ error: "Email e password richieste." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    // Verify email is invited
    const invited = await kv.get(`invited_email:${normalizedEmail}`);
    if (!invited) {
      return c.json({ error: "Email non autorizzata." }, 403);
    }

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password: body.password,
      user_metadata: { name: body.name || invited.name || "" },
      // Automatically confirm the user's email since an email server hasn't been configured.
      email_confirm: true,
    });

    if (error) {
      console.log("Error creating user:", error);
      return c.json({ error: `Errore nella registrazione: ${error.message}` }, 400);
    }

    // Initialize empty profile in KV
    const profileData = {
      user_id: data.user.id,
      email: normalizedEmail,
      name: body.name || invited.name || "",
      gender: null,
      birth_date: null,
      height_cm: null,
      current_weight_kg: null,
      goal: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await kv.set(`profile:${data.user.id}`, profileData);
    console.log("Signup: profile created for user", data.user.id);

    return c.json({
      status: "created",
      message: "Account creato con successo!",
      user: { id: data.user.id, email: data.user.email },
    });
  } catch (err) {
    console.log("Error in signup:", err);
    return c.json({ error: `Errore durante la registrazione: ${err}` }, 500);
  }
});

// ─── INVITE MANAGEMENT (admin) ───

// POST /invite — Add an email to the invited list
app.post("/make-server-48e8ada4/invite", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body?.email) {
      return c.json({ error: "Email richiesta." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();
    await kv.set(`invited_email:${normalizedEmail}`, {
      email: normalizedEmail,
      name: body.name || "",
      invited_by: user.user.id,
      invited_at: new Date().toISOString(),
    });

    return c.json({ status: "ok", message: `${normalizedEmail} invitato con successo.` });
  } catch (err) {
    console.log("Error in invite:", err);
    return c.json({ error: `Errore durante l'invito: ${err}` }, 500);
  }
});

// GET /invited — List invited emails by the current user
app.get("/make-server-48e8ada4/invited", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const allInvited = await kv.getByPrefix("invited_email:");
    // Filter: only show invites created by the current user
    const myInvites = allInvited.filter(
      (entry: any) => entry.invited_by === user.user!.id
    );
    return c.json({ invited: myInvites });
  } catch (err) {
    console.log("Error in invited list:", err);
    return c.json({ error: `Errore nel recupero inviti: ${err}` }, 500);
  }
});

// DELETE /invite — Remove an invited email (only if invited by the current user)
app.delete("/make-server-48e8ada4/invite", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body?.email) {
      return c.json({ error: "Email richiesta." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();
    const existing = await kv.get(`invited_email:${normalizedEmail}`);

    // Only allow deletion if the current user is the one who invited this email
    if (!existing) {
      return c.json({ error: "Invito non trovato." }, 404);
    }
    if (existing.invited_by !== user.user.id) {
      return c.json({ error: "Puoi rimuovere solo gli inviti che hai creato tu." }, 403);
    }

    await kv.del(`invited_email:${normalizedEmail}`);
    return c.json({ status: "ok", message: `${normalizedEmail} rimosso dalla lista inviti.` });
  } catch (err) {
    console.log("Error in delete invite:", err);
    return c.json({ error: `Errore nella rimozione invito: ${err}` }, 500);
  }
});

// ─── PROFILE ROUTES ───

// Helper: ensure profile exists, create empty one if missing
const ensureProfile = async (userId: string, email: string) => {
  let profile = await kv.get(`profile:${userId}`);
  if (!profile) {
    console.log(`Profile not found for ${userId}, creating empty profile`);
    profile = {
      user_id: userId,
      email: email || "",
      name: "",
      gender: null,
      birth_date: null,
      height_cm: null,
      current_weight_kg: null,
      goal: null,
      created_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    };
    await kv.set(`profile:${userId}`, profile);
  }
  return profile;
};

// GET /profile — Get current user profile
app.get("/make-server-48e8ada4/profile", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const profile = await ensureProfile(user.user.id, user.user.email || "");
    console.log("GET profile for", user.user.id, "→", JSON.stringify(profile).slice(0, 200));
    return c.json({ profile });
  } catch (err) {
    console.log("Error in get profile:", err);
    return c.json({ error: `Errore nel recupero profilo: ${err}` }, 500);
  }
});

// PUT /profile — Update current user profile
app.put("/make-server-48e8ada4/profile", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const updates = await parseBody(c);
    if (!updates) {
      return c.json({ error: "Dati profilo non validi." }, 400);
    }

    console.log("PUT profile for", user.user.id, "updates:", JSON.stringify(updates).slice(0, 300));

    const existing = await ensureProfile(user.user.id, user.user.email || "");
    const merged = {
      ...existing,
      ...updates,
      user_id: user.user.id,
      updated_at: new Date().toISOString(),
    };
    await kv.set(`profile:${user.user.id}`, merged);
    console.log("PUT profile saved for", user.user.id);
    return c.json({ profile: merged });
  } catch (err) {
    console.log("Error in update profile:", err);
    return c.json({ error: `Errore nell'aggiornamento profilo: ${err}` }, 500);
  }
});

// POST /weight-log — Add a weight log entry
app.post("/make-server-48e8ada4/weight-log", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body) {
      return c.json({ error: "Corpo della richiesta non valido." }, 400);
    }

    const weight_kg =
      typeof body.weight_kg === "string"
        ? parseFloat(body.weight_kg)
        : body.weight_kg;

    console.log(
      "weight-log: user:", user.user.id,
      "raw weight_kg:", body.weight_kg,
      "parsed:", weight_kg
    );

    if (
      weight_kg === undefined ||
      weight_kg === null ||
      isNaN(weight_kg) ||
      weight_kg <= 0
    ) {
      return c.json(
        { error: `Peso non valido: ricevuto ${JSON.stringify(body.weight_kg)}` },
        400
      );
    }

    // Get profile for height to calculate BMI
    const profile = await ensureProfile(user.user.id, user.user.email || "");
    const height_cm = profile?.height_cm;
    let bmi: number | null = null;
    if (height_cm && height_cm > 0) {
      const h = height_cm / 100;
      bmi = Math.round((weight_kg / (h * h)) * 10) / 10;
    }

    const timestamp = new Date().toISOString();
    const logKey = `weight_log:${user.user.id}:${timestamp}`;
    const logEntry = {
      user_id: user.user.id,
      weight_kg,
      bmi,
      logged_at: timestamp,
    };

    await kv.set(logKey, logEntry);
    console.log("weight-log: Saved entry:", logKey);

    // Also update current_weight_kg in profile
    await kv.set(`profile:${user.user.id}`, {
      ...profile,
      current_weight_kg: weight_kg,
      updated_at: timestamp,
    });
    console.log("weight-log: Updated profile weight for", user.user.id);

    return c.json({ status: "ok", log: logEntry });
  } catch (err) {
    console.log("Error in weight-log:", err);
    return c.json({ error: `Errore nel salvataggio peso: ${err}` }, 500);
  }
});

// GET /weight-logs — Get all weight logs for the current user
app.get("/make-server-48e8ada4/weight-logs", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const logs = await kv.getByPrefix(`weight_log:${user.user.id}:`);
    // Sort by logged_at ascending
    logs.sort(
      (a: any, b: any) =>
        new Date(a.logged_at).getTime() - new Date(b.logged_at).getTime()
    );
    console.log("weight-logs: Found", logs.length, "entries for", user.user.id);
    return c.json({ logs });
  } catch (err) {
    console.log("Error in weight-logs:", err);
    return c.json({ error: `Errore nel recupero log peso: ${err}` }, 500);
  }
});

// ─── FOOD OVERRIDES ───

// GET /food-overrides — Get user's food weight overrides
app.get("/make-server-48e8ada4/food-overrides", async (c) => {
  try {
    const { user, reason } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato.", reason }, 401);
    }

    const overrides = await kv.get(`food_overrides:${user.id}`);
    return c.json({ overrides: overrides || {} });
  } catch (err) {
    console.log("Error in food-overrides:", err);
    return c.json({ error: `Errore nel recupero override: ${err}` }, 500);
  }
});

// PUT /food-overrides — Save/update user's food weight overrides
app.put("/make-server-48e8ada4/food-overrides", async (c) => {
  try {
    const user = await authenticateUser(c);
    if (!user.user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body?.overrides || typeof body.overrides !== "object") {
      return c.json({ error: "Formato override non valido." }, 400);
    }

    await kv.set(`food_overrides:${user.user.id}`, body.overrides);
    console.log("food-overrides: Saved for", user.user.id);
    return c.json({ status: "ok", message: "Override salvati." });
  } catch (err) {
    console.log("Error in save food-overrides:", err);
    return c.json({ error: `Errore nel salvataggio override: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);