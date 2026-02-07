-- ============================================================
-- NutriPlan: Schema Migration — KV Store → Relational Tables
-- ============================================================
-- Run this FIRST. Creates all tables, RLS policies, and triggers.
-- The KV store table is left untouched for coexistence during migration.

-- ─── Helper: is_admin() ─────────────────────────────────────
CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles
    WHERE id = auth.uid() AND role = 'admin'
  );
$$;

-- ─── Trigger function: auto-update updated_at ───────────────
CREATE OR REPLACE FUNCTION public.set_updated_at()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

-- ============================================================
-- 1. profiles
-- ============================================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id          uuid PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email       text NOT NULL,
  name        text DEFAULT '',
  gender      text,
  birth_date  date,
  height_cm   numeric,
  current_weight_kg numeric,
  goal        text,
  role        text NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER profiles_updated_at
  BEFORE UPDATE ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;

CREATE POLICY profiles_select_own ON public.profiles
  FOR SELECT USING (id = auth.uid() OR public.is_admin());

CREATE POLICY profiles_insert_own ON public.profiles
  FOR INSERT WITH CHECK (id = auth.uid());

CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE USING (id = auth.uid())
  WITH CHECK (id = auth.uid());

-- ============================================================
-- 2. weight_logs
-- ============================================================
CREATE TABLE IF NOT EXISTS public.weight_logs (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id    uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  weight_kg  numeric NOT NULL,
  bmi        numeric,
  logged_at  timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX weight_logs_user_id_idx ON public.weight_logs(user_id, logged_at);

ALTER TABLE public.weight_logs ENABLE ROW LEVEL SECURITY;

CREATE POLICY weight_logs_select_own ON public.weight_logs
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY weight_logs_insert_own ON public.weight_logs
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY weight_logs_delete_own ON public.weight_logs
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- 3. invitations
-- ============================================================
CREATE TABLE IF NOT EXISTS public.invitations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  email       text NOT NULL,
  name        text DEFAULT '',
  invited_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  invited_at  timestamptz NOT NULL DEFAULT now(),
  accepted_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE(email)
);

CREATE TRIGGER invitations_updated_at
  BEFORE UPDATE ON public.invitations
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.invitations ENABLE ROW LEVEL SECURITY;

CREATE POLICY invitations_insert_auth ON public.invitations
  FOR INSERT WITH CHECK (auth.uid() IS NOT NULL);

CREATE POLICY invitations_select_own ON public.invitations
  FOR SELECT USING (invited_by = auth.uid() OR public.is_admin());

CREATE POLICY invitations_delete_own ON public.invitations
  FOR DELETE USING (invited_by = auth.uid());

-- ============================================================
-- 4. meals
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meals (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '',
  sort_order integer NOT NULL DEFAULT 0,
  is_free    boolean NOT NULL DEFAULT false,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER meals_updated_at
  BEFORE UPDATE ON public.meals
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meals ENABLE ROW LEVEL SECURITY;

CREATE POLICY meals_select_auth ON public.meals
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY meals_insert_admin ON public.meals
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY meals_update_admin ON public.meals
  FOR UPDATE USING (public.is_admin());

CREATE POLICY meals_delete_admin ON public.meals
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 5. categories
-- ============================================================
CREATE TABLE IF NOT EXISTS public.categories (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE,
  name       text NOT NULL,
  icon       text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER categories_updated_at
  BEFORE UPDATE ON public.categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY categories_select_auth ON public.categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY categories_insert_admin ON public.categories
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY categories_update_admin ON public.categories
  FOR UPDATE USING (public.is_admin());

CREATE POLICY categories_delete_admin ON public.categories
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 6. meal_categories (junction: which categories in which meals)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_categories (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_id       uuid NOT NULL REFERENCES public.meals(id) ON DELETE CASCADE,
  category_id   uuid NOT NULL REFERENCES public.categories(id) ON DELETE CASCADE,
  sort_order    integer NOT NULL DEFAULT 0,
  is_optional   boolean NOT NULL DEFAULT false,
  icon_override text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meal_id, category_id)
);

CREATE TRIGGER meal_categories_updated_at
  BEFORE UPDATE ON public.meal_categories
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meal_categories ENABLE ROW LEVEL SECURITY;

CREATE POLICY meal_categories_select_auth ON public.meal_categories
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY meal_categories_insert_admin ON public.meal_categories
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY meal_categories_update_admin ON public.meal_categories
  FOR UPDATE USING (public.is_admin());

CREATE POLICY meal_categories_delete_admin ON public.meal_categories
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 7. foods
-- ============================================================
CREATE TABLE IF NOT EXISTS public.foods (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name           text NOT NULL,
  note           text,
  sub_group      text,
  sub_group_icon text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  updated_at     timestamptz NOT NULL DEFAULT now()
);

CREATE TRIGGER foods_updated_at
  BEFORE UPDATE ON public.foods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY foods_select_auth ON public.foods
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY foods_insert_admin ON public.foods
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY foods_update_admin ON public.foods
  FOR UPDATE USING (public.is_admin());

CREATE POLICY foods_delete_admin ON public.foods
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 8. meal_category_foods (food in a meal-category context with base_weight)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.meal_category_foods (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  meal_category_id uuid NOT NULL REFERENCES public.meal_categories(id) ON DELETE CASCADE,
  food_id          uuid NOT NULL REFERENCES public.foods(id) ON DELETE CASCADE,
  base_weight      integer NOT NULL,
  sort_order       integer NOT NULL DEFAULT 0,
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now(),
  UNIQUE(meal_category_id, food_id)
);

CREATE TRIGGER meal_category_foods_updated_at
  BEFORE UPDATE ON public.meal_category_foods
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.meal_category_foods ENABLE ROW LEVEL SECURITY;

CREATE POLICY mcf_select_auth ON public.meal_category_foods
  FOR SELECT USING (auth.uid() IS NOT NULL);

CREATE POLICY mcf_insert_admin ON public.meal_category_foods
  FOR INSERT WITH CHECK (public.is_admin());

CREATE POLICY mcf_update_admin ON public.meal_category_foods
  FOR UPDATE USING (public.is_admin());

CREATE POLICY mcf_delete_admin ON public.meal_category_foods
  FOR DELETE USING (public.is_admin());

-- ============================================================
-- 9. user_food_overrides
-- ============================================================
CREATE TABLE IF NOT EXISTS public.user_food_overrides (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id              uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  meal_category_food_id uuid NOT NULL REFERENCES public.meal_category_foods(id) ON DELETE CASCADE,
  custom_weight        integer NOT NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  UNIQUE(user_id, meal_category_food_id)
);

CREATE TRIGGER user_food_overrides_updated_at
  BEFORE UPDATE ON public.user_food_overrides
  FOR EACH ROW EXECUTE FUNCTION public.set_updated_at();

ALTER TABLE public.user_food_overrides ENABLE ROW LEVEL SECURITY;

CREATE POLICY ufo_select_own ON public.user_food_overrides
  FOR SELECT USING (user_id = auth.uid());

CREATE POLICY ufo_insert_own ON public.user_food_overrides
  FOR INSERT WITH CHECK (user_id = auth.uid());

CREATE POLICY ufo_update_own ON public.user_food_overrides
  FOR UPDATE USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY ufo_delete_own ON public.user_food_overrides
  FOR DELETE USING (user_id = auth.uid());

-- ============================================================
-- Grant access to service role for server-side operations
-- ============================================================
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO service_role;
