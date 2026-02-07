import { Hono } from "npm:hono";
import { cors } from "npm:hono/cors";
import { logger } from "npm:hono/logger";
import { createClient } from "jsr:@supabase/supabase-js@2.49.8";

const app = new Hono();

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
const serverAuthOptions = {
  auth: {
    autoRefreshToken: false,
    persistSession: false,
    detectSessionInUrl: false,
  },
};

const adminSupabase = createClient(supabaseUrl, serviceRoleKey, serverAuthOptions);
const anonSupabase = createClient(supabaseUrl, anonKey, serverAuthOptions);

// ─── Helpers ────────────────────────────────────────────────

const authenticateUser = async (c: any) => {
  const url = new URL(c.req.url);
  const userToken = url.searchParams.get("_t");
  if (!userToken) {
    return { user: null, reason: "missing_token" };
  }
  if (userToken === anonKey) {
    return { user: null, reason: "anon_key_not_jwt" };
  }
  try {
    const { data: { user }, error } = await anonSupabase.auth.getUser(userToken);
    if (error) {
      return { user: null, reason: `getUser_error: ${error.message}` };
    }
    if (!user?.id) {
      return { user: null, reason: "no_user_id" };
    }
    return { user, reason: null };
  } catch (err) {
    return { user: null, reason: `exception: ${err}` };
  }
};

const parseBody = async (c: any) => {
  try {
    return await c.req.json();
  } catch (err) {
    console.log("Body parse error:", err);
    return null;
  }
};

// Middleware: require admin role
const requireAdmin = async (c: any, next: any) => {
  const { user, reason } = await authenticateUser(c);
  if (!user) {
    return c.json({ error: "Non autorizzato.", reason }, 401);
  }
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("role")
    .eq("id", user.id)
    .single();
  if (!profile || profile.role !== "admin") {
    return c.json({ error: "Accesso riservato agli amministratori." }, 403);
  }
  c.set("user", user);
  return next();
};

// Helper: ensure profile exists
const ensureProfile = async (userId: string, email: string) => {
  const { data: profile } = await adminSupabase
    .from("profiles")
    .select("*")
    .eq("id", userId)
    .single();

  if (profile) return profile;

  const newProfile = {
    id: userId,
    email: email || "",
    name: "",
    gender: null,
    birth_date: null,
    height_cm: null,
    current_weight_kg: null,
    goal: null,
  };
  const { data: created, error } = await adminSupabase
    .from("profiles")
    .insert(newProfile)
    .select()
    .single();

  if (error) {
    console.log("ensureProfile insert error:", error.message);
    return newProfile;
  }
  return created;
};

// ─── Health ─────────────────────────────────────────────────

app.get("/make-server-48e8ada4/health", (c) => {
  return c.json({ status: "ok" });
});

// ─── AUTH ROUTES ────────────────────────────────────────────

// POST /check-email
app.post("/make-server-48e8ada4/check-email", async (c) => {
  try {
    const body = await parseBody(c);
    if (!body?.email || typeof body.email !== "string") {
      return c.json({ error: "Email richiesta." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    const { data: invitation } = await adminSupabase
      .from("invitations")
      .select("id")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!invitation) {
      return c.json({
        status: "not_invited",
        message: "Questa email non è autorizzata. Contatta l'amministratore.",
      });
    }

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

// POST /signup
app.post("/make-server-48e8ada4/signup", async (c) => {
  try {
    const body = await parseBody(c);
    if (!body?.email || !body?.password) {
      return c.json({ error: "Email e password richieste." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    const { data: invitation } = await adminSupabase
      .from("invitations")
      .select("id, name")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!invitation) {
      return c.json({ error: "Email non autorizzata." }, 403);
    }

    const { data, error } = await adminSupabase.auth.admin.createUser({
      email: normalizedEmail,
      password: body.password,
      user_metadata: { name: body.name || invitation.name || "" },
      email_confirm: true,
    });

    if (error) {
      console.log("Error creating user:", error);
      return c.json({ error: `Errore nella registrazione: ${error.message}` }, 400);
    }

    // Create profile in relational table
    await adminSupabase.from("profiles").insert({
      id: data.user.id,
      email: normalizedEmail,
      name: body.name || invitation.name || "",
    });

    // Mark invitation as accepted
    await adminSupabase
      .from("invitations")
      .update({ accepted_at: new Date().toISOString() })
      .eq("email", normalizedEmail);

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

// ─── INVITE MANAGEMENT ──────────────────────────────────────

// POST /invite
app.post("/make-server-48e8ada4/invite", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body?.email) {
      return c.json({ error: "Email richiesta." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    const { error } = await adminSupabase.from("invitations").upsert(
      {
        email: normalizedEmail,
        name: body.name || "",
        invited_by: user.id,
        invited_at: new Date().toISOString(),
      },
      { onConflict: "email" }
    );

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ status: "ok", message: `${normalizedEmail} invitato con successo.` });
  } catch (err) {
    console.log("Error in invite:", err);
    return c.json({ error: `Errore durante l'invito: ${err}` }, 500);
  }
});

// GET /invited
app.get("/make-server-48e8ada4/invited", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const { data, error } = await adminSupabase
      .from("invitations")
      .select("email, name, invited_by, invited_at, accepted_at")
      .eq("invited_by", user.id)
      .order("invited_at", { ascending: false });

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ invited: data || [] });
  } catch (err) {
    console.log("Error in invited list:", err);
    return c.json({ error: `Errore nel recupero inviti: ${err}` }, 500);
  }
});

// DELETE /invite
app.delete("/make-server-48e8ada4/invite", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body?.email) {
      return c.json({ error: "Email richiesta." }, 400);
    }

    const normalizedEmail = body.email.toLowerCase().trim();

    const { data: existing } = await adminSupabase
      .from("invitations")
      .select("id, invited_by")
      .eq("email", normalizedEmail)
      .maybeSingle();

    if (!existing) {
      return c.json({ error: "Invito non trovato." }, 404);
    }
    if (existing.invited_by !== user.id) {
      return c.json({ error: "Puoi rimuovere solo gli inviti che hai creato tu." }, 403);
    }

    await adminSupabase.from("invitations").delete().eq("id", existing.id);
    return c.json({ status: "ok", message: `${normalizedEmail} rimosso dalla lista inviti.` });
  } catch (err) {
    console.log("Error in delete invite:", err);
    return c.json({ error: `Errore nella rimozione invito: ${err}` }, 500);
  }
});

// ─── PROFILE ROUTES ─────────────────────────────────────────

// GET /profile
app.get("/make-server-48e8ada4/profile", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const profile = await ensureProfile(user.id, user.email || "");
    return c.json({ profile });
  } catch (err) {
    console.log("Error in get profile:", err);
    return c.json({ error: `Errore nel recupero profilo: ${err}` }, 500);
  }
});

// PUT /profile
app.put("/make-server-48e8ada4/profile", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const updates = await parseBody(c);
    if (!updates) {
      return c.json({ error: "Dati profilo non validi." }, 400);
    }

    // Ensure profile exists first
    await ensureProfile(user.id, user.email || "");

    // Only allow updating safe fields
    const safeFields: Record<string, any> = {};
    const allowedKeys = ["name", "gender", "birth_date", "height_cm", "current_weight_kg", "goal"];
    for (const key of allowedKeys) {
      if (key in updates) {
        safeFields[key] = updates[key];
      }
    }

    const { data: updated, error } = await adminSupabase
      .from("profiles")
      .update(safeFields)
      .eq("id", user.id)
      .select()
      .single();

    if (error) {
      console.log("Update profile error:", error.message);
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ profile: updated });
  } catch (err) {
    console.log("Error in update profile:", err);
    return c.json({ error: `Errore nell'aggiornamento profilo: ${err}` }, 500);
  }
});

// ─── WEIGHT LOG ─────────────────────────────────────────────

// POST /weight-log
app.post("/make-server-48e8ada4/weight-log", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
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
    const profile = await ensureProfile(user.id, user.email || "");
    const height_cm = profile?.height_cm;
    let bmi: number | null = null;
    if (height_cm && height_cm > 0) {
      const h = height_cm / 100;
      bmi = Math.round((weight_kg / (h * h)) * 10) / 10;
    }

    const timestamp = new Date().toISOString();
    const logEntry = {
      user_id: user.id,
      weight_kg,
      bmi,
      logged_at: timestamp,
    };

    const { error: logError } = await adminSupabase
      .from("weight_logs")
      .insert(logEntry);

    if (logError) {
      return c.json({ error: `Errore: ${logError.message}` }, 500);
    }

    // Also update current_weight_kg in profile
    await adminSupabase
      .from("profiles")
      .update({ current_weight_kg: weight_kg })
      .eq("id", user.id);

    return c.json({ status: "ok", log: logEntry });
  } catch (err) {
    console.log("Error in weight-log:", err);
    return c.json({ error: `Errore nel salvataggio peso: ${err}` }, 500);
  }
});

// GET /weight-logs
app.get("/make-server-48e8ada4/weight-logs", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const { data, error } = await adminSupabase
      .from("weight_logs")
      .select("weight_kg, bmi, logged_at")
      .eq("user_id", user.id)
      .order("logged_at", { ascending: true });

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ logs: data || [] });
  } catch (err) {
    console.log("Error in weight-logs:", err);
    return c.json({ error: `Errore nel recupero log peso: ${err}` }, 500);
  }
});

// ─── FOOD OVERRIDES ─────────────────────────────────────────

// GET /food-overrides
app.get("/make-server-48e8ada4/food-overrides", async (c) => {
  try {
    const { user, reason } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato.", reason }, 401);
    }

    const { data, error } = await adminSupabase
      .from("user_food_overrides")
      .select("meal_category_food_id, custom_weight")
      .eq("user_id", user.id);

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    // Convert to { mcf_id: weight } map for frontend
    const overrides: Record<string, number> = {};
    for (const row of data || []) {
      overrides[row.meal_category_food_id] = row.custom_weight;
    }

    return c.json({ overrides });
  } catch (err) {
    console.log("Error in food-overrides:", err);
    return c.json({ error: `Errore nel recupero override: ${err}` }, 500);
  }
});

// PUT /food-overrides
app.put("/make-server-48e8ada4/food-overrides", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    const body = await parseBody(c);
    if (!body?.overrides || typeof body.overrides !== "object") {
      return c.json({ error: "Formato override non valido." }, 400);
    }

    // Delete all existing overrides for this user
    await adminSupabase
      .from("user_food_overrides")
      .delete()
      .eq("user_id", user.id);

    // Insert new overrides
    const rows = Object.entries(body.overrides)
      .filter(([_, v]) => v !== null && v !== undefined)
      .map(([mcfId, weight]) => ({
        user_id: user.id,
        meal_category_food_id: mcfId,
        custom_weight: weight as number,
      }));

    if (rows.length > 0) {
      const { error } = await adminSupabase
        .from("user_food_overrides")
        .insert(rows);

      if (error) {
        console.log("food-overrides insert error:", error.message);
        return c.json({ error: `Errore: ${error.message}` }, 500);
      }
    }

    return c.json({ status: "ok", message: "Override salvati." });
  } catch (err) {
    console.log("Error in save food-overrides:", err);
    return c.json({ error: `Errore nel salvataggio override: ${err}` }, 500);
  }
});

// ─── MEALS STRUCTURE ────────────────────────────────────────

// GET /meals-structure — Full hierarchy for frontend
app.get("/make-server-48e8ada4/meals-structure", async (c) => {
  try {
    const { user } = await authenticateUser(c);
    if (!user) {
      return c.json({ error: "Non autorizzato." }, 401);
    }

    // Fetch all data in parallel
    const [mealsRes, mcRes, mcfRes, foodsRes, catsRes] = await Promise.all([
      adminSupabase.from("meals").select("*").order("sort_order"),
      adminSupabase.from("meal_categories").select("*").order("sort_order"),
      adminSupabase.from("meal_category_foods").select("*").order("sort_order"),
      adminSupabase.from("foods").select("*"),
      adminSupabase.from("categories").select("*"),
    ]);

    if (mealsRes.error || mcRes.error || mcfRes.error || foodsRes.error || catsRes.error) {
      const err = mealsRes.error || mcRes.error || mcfRes.error || foodsRes.error || catsRes.error;
      return c.json({ error: `Errore: ${err!.message}` }, 500);
    }

    const foodsMap = new Map((foodsRes.data || []).map((f: any) => [f.id, f]));
    const catsMap = new Map((catsRes.data || []).map((c: any) => [c.id, c]));

    // Group meal_category_foods by meal_category_id
    const mcfByMc = new Map<string, any[]>();
    for (const mcf of mcfRes.data || []) {
      const list = mcfByMc.get(mcf.meal_category_id) || [];
      list.push(mcf);
      mcfByMc.set(mcf.meal_category_id, list);
    }

    // Group meal_categories by meal_id
    const mcByMeal = new Map<string, any[]>();
    for (const mc of mcRes.data || []) {
      const list = mcByMeal.get(mc.meal_id) || [];
      list.push(mc);
      mcByMeal.set(mc.meal_id, list);
    }

    // Build the hierarchy
    const meals = (mealsRes.data || []).map((meal: any) => {
      const mealCategories = mcByMeal.get(meal.id) || [];
      return {
        id: meal.slug,
        name: meal.name,
        icon: meal.icon,
        is_free: meal.is_free,
        categories: mealCategories.map((mc: any) => {
          const cat = catsMap.get(mc.category_id);
          const mcfList = mcfByMc.get(mc.id) || [];
          return {
            id: mc.id,  // Use meal_category UUID as category id (unique per meal-category pair)
            name: cat?.name || "",
            icon: mc.icon_override || cat?.icon || "",
            is_optional: mc.is_optional,
            items: mcfList.map((mcf: any) => {
              const food = foodsMap.get(mcf.food_id);
              return {
                id: mcf.id,  // meal_category_food UUID — used as key for overrides
                food_id: mcf.food_id,
                name: food?.name || "",
                baseWeight: mcf.base_weight,
                note: food?.note || undefined,
                subGroup: food?.sub_group || undefined,
                subGroupIcon: food?.sub_group_icon || undefined,
              };
            }),
          };
        }),
      };
    });

    return c.json({ meals });
  } catch (err) {
    console.log("Error in meals-structure:", err);
    return c.json({ error: `Errore nel caricamento struttura pasti: ${err}` }, 500);
  }
});

// ─── ADMIN: Invitations ─────────────────────────────────────

// GET /admin/invitations — All invitations with inviter info
app.get("/make-server-48e8ada4/admin/invitations", requireAdmin, async (c) => {
  try {
    const { data, error } = await adminSupabase
      .from("invitations")
      .select(`
        id, email, name, invited_at, accepted_at,
        inviter:profiles!invitations_invited_by_fkey(id, email, name)
      `)
      .order("invited_at", { ascending: false });

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ invitations: data || [] });
  } catch (err) {
    console.log("Error in admin/invitations:", err);
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

// ─── ADMIN: Foods CRUD ──────────────────────────────────────

// POST /admin/foods
app.post("/make-server-48e8ada4/admin/foods", requireAdmin, async (c) => {
  try {
    const body = await parseBody(c);
    if (!body?.name) {
      return c.json({ error: "Nome alimento richiesto." }, 400);
    }

    const { data, error } = await adminSupabase
      .from("foods")
      .insert({
        name: body.name,
        note: body.note || null,
        sub_group: body.sub_group || null,
        sub_group_icon: body.sub_group_icon || null,
      })
      .select()
      .single();

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ food: data }, 201);
  } catch (err) {
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

// PUT /admin/foods/:id
app.put("/make-server-48e8ada4/admin/foods/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await parseBody(c);
    if (!body) {
      return c.json({ error: "Dati non validi." }, 400);
    }

    const updates: Record<string, any> = {};
    if ("name" in body) updates.name = body.name;
    if ("note" in body) updates.note = body.note;
    if ("sub_group" in body) updates.sub_group = body.sub_group;
    if ("sub_group_icon" in body) updates.sub_group_icon = body.sub_group_icon;

    const { data, error } = await adminSupabase
      .from("foods")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ food: data });
  } catch (err) {
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

// DELETE /admin/foods/:id
app.delete("/make-server-48e8ada4/admin/foods/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await adminSupabase.from("foods").delete().eq("id", id);
    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }
    return c.json({ status: "ok" });
  } catch (err) {
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

// ─── ADMIN: Meal-Category-Foods CRUD ────────────────────────

// POST /admin/meal-category-foods
app.post("/make-server-48e8ada4/admin/meal-category-foods", requireAdmin, async (c) => {
  try {
    const body = await parseBody(c);
    if (!body?.meal_category_id || !body?.food_id || !body?.base_weight) {
      return c.json({ error: "meal_category_id, food_id e base_weight richiesti." }, 400);
    }

    const { data, error } = await adminSupabase
      .from("meal_category_foods")
      .insert({
        meal_category_id: body.meal_category_id,
        food_id: body.food_id,
        base_weight: body.base_weight,
        sort_order: body.sort_order || 0,
      })
      .select()
      .single();

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ meal_category_food: data }, 201);
  } catch (err) {
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

// PUT /admin/meal-category-foods/:id
app.put("/make-server-48e8ada4/admin/meal-category-foods/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const body = await parseBody(c);
    if (!body) {
      return c.json({ error: "Dati non validi." }, 400);
    }

    const updates: Record<string, any> = {};
    if ("base_weight" in body) updates.base_weight = body.base_weight;
    if ("sort_order" in body) updates.sort_order = body.sort_order;

    const { data, error } = await adminSupabase
      .from("meal_category_foods")
      .update(updates)
      .eq("id", id)
      .select()
      .single();

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ meal_category_food: data });
  } catch (err) {
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

// DELETE /admin/meal-category-foods/:id
app.delete("/make-server-48e8ada4/admin/meal-category-foods/:id", requireAdmin, async (c) => {
  try {
    const id = c.req.param("id");
    const { error } = await adminSupabase
      .from("meal_category_foods")
      .delete()
      .eq("id", id);

    if (error) {
      return c.json({ error: `Errore: ${error.message}` }, 500);
    }

    return c.json({ status: "ok" });
  } catch (err) {
    return c.json({ error: `Errore: ${err}` }, 500);
  }
});

Deno.serve(app.fetch);
