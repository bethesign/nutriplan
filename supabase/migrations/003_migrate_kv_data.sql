-- ============================================================
-- NutriPlan: Migrate user data from KV store → relational tables
-- ============================================================
-- Run AFTER 001_schema.sql and 002_seed_foods.sql.
-- Migrates profiles, weight_logs, invitations, and food_overrides.
-- The KV store table is preserved for rollback safety.

-- ─── 1. Migrate Profiles ────────────────────────────────────
INSERT INTO public.profiles (id, email, name, gender, birth_date, height_cm, current_weight_kg, goal, created_at, updated_at)
SELECT
  (value->>'user_id')::uuid,
  COALESCE(value->>'email', ''),
  COALESCE(value->>'name', ''),
  value->>'gender',
  CASE WHEN value->>'birth_date' IS NOT NULL AND value->>'birth_date' != ''
       THEN (value->>'birth_date')::date ELSE NULL END,
  CASE WHEN value->>'height_cm' IS NOT NULL AND value->>'height_cm' != 'null'
       THEN (value->>'height_cm')::numeric ELSE NULL END,
  CASE WHEN value->>'current_weight_kg' IS NOT NULL AND value->>'current_weight_kg' != 'null'
       THEN (value->>'current_weight_kg')::numeric ELSE NULL END,
  value->>'goal',
  COALESCE((value->>'created_at')::timestamptz, now()),
  COALESCE((value->>'updated_at')::timestamptz, now())
FROM kv_store_48e8ada4
WHERE key LIKE 'profile:%'
ON CONFLICT (id) DO NOTHING;

-- ─── 2. Migrate Weight Logs ─────────────────────────────────
INSERT INTO public.weight_logs (user_id, weight_kg, bmi, logged_at)
SELECT
  (value->>'user_id')::uuid,
  (value->>'weight_kg')::numeric,
  CASE WHEN value->>'bmi' IS NOT NULL AND value->>'bmi' != 'null'
       THEN (value->>'bmi')::numeric ELSE NULL END,
  COALESCE((value->>'logged_at')::timestamptz, now())
FROM kv_store_48e8ada4
WHERE key LIKE 'weight_log:%'
  AND (value->>'user_id') IS NOT NULL
  AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (value->>'user_id')::uuid)
ORDER BY (value->>'logged_at')::timestamptz;

-- ─── 3. Migrate Invitations ────────────────────────────────
-- Note: invited_by = 'system' becomes NULL (system invites)
INSERT INTO public.invitations (email, name, invited_by, invited_at)
SELECT
  COALESCE(value->>'email', ''),
  COALESCE(value->>'name', ''),
  CASE
    WHEN value->>'invited_by' = 'system' THEN NULL
    WHEN value->>'invited_by' IS NOT NULL
         AND EXISTS (SELECT 1 FROM public.profiles WHERE id = (value->>'invited_by')::uuid)
    THEN (value->>'invited_by')::uuid
    ELSE NULL
  END,
  COALESCE((value->>'invited_at')::timestamptz, now())
FROM kv_store_48e8ada4
WHERE key LIKE 'invited_email:%'
ON CONFLICT (email) DO NOTHING;

-- ─── 4. Migrate Food Overrides ──────────────────────────────
-- This is the most complex migration because the old system uses
-- sequential IDs (food-1, food-2, ...) that must be mapped to
-- meal_category_foods UUIDs.
--
-- Strategy: Replay the uid() counter from meal-data.ts to build
-- a mapping from food-N → meal_category_foods.id using sort_order
-- within each meal_category (which matches the original insertion order).

DO $$
DECLARE
  kv_record RECORD;
  user_id_val uuid;
  overrides_json jsonb;
  override_key text;
  override_val numeric;
  food_counter integer;
  mcf_id uuid;

  -- Build the mapping: we replay the counter by iterating through
  -- meal_categories and their foods in the same order as meal-data.ts
  mapping_key text;
  mapping_mcf_id uuid;
BEGIN
  -- Create a temporary mapping table
  CREATE TEMP TABLE IF NOT EXISTS food_id_mapping (
    old_id text PRIMARY KEY,
    new_mcf_id uuid NOT NULL
  );

  -- Truncate in case of re-run
  TRUNCATE food_id_mapping;

  -- Replay the counter: meals in sort_order, then meal_categories in sort_order,
  -- then meal_category_foods in sort_order
  food_counter := 0;

  FOR mapping_mcf_id IN
    SELECT mcf.id
    FROM public.meals m
    JOIN public.meal_categories mc ON mc.meal_id = m.id
    JOIN public.meal_category_foods mcf ON mcf.meal_category_id = mc.id
    ORDER BY m.sort_order, mc.sort_order, mcf.sort_order
  LOOP
    food_counter := food_counter + 1;
    INSERT INTO food_id_mapping (old_id, new_mcf_id)
    VALUES ('food-' || food_counter, mapping_mcf_id)
    ON CONFLICT (old_id) DO NOTHING;
  END LOOP;

  RAISE NOTICE 'Food ID mapping created: % entries', food_counter;

  -- Now migrate overrides for each user
  FOR kv_record IN
    SELECT key, value FROM kv_store_48e8ada4 WHERE key LIKE 'food_overrides:%'
  LOOP
    user_id_val := substring(kv_record.key FROM 'food_overrides:(.+)')::uuid;
    overrides_json := kv_record.value;

    -- Skip if user doesn't exist in profiles
    IF NOT EXISTS (SELECT 1 FROM public.profiles WHERE id = user_id_val) THEN
      RAISE NOTICE 'Skipping overrides for unknown user: %', user_id_val;
      CONTINUE;
    END IF;

    -- Iterate over each override entry
    FOR override_key, override_val IN
      SELECT k, (v)::numeric
      FROM jsonb_each_text(overrides_json) AS x(k, v)
      WHERE v ~ '^\d+\.?\d*$'
    LOOP
      -- Look up the mapping
      SELECT new_mcf_id INTO mcf_id
      FROM food_id_mapping
      WHERE old_id = override_key;

      IF mcf_id IS NOT NULL THEN
        INSERT INTO public.user_food_overrides (user_id, meal_category_food_id, custom_weight)
        VALUES (user_id_val, mcf_id, override_val::integer)
        ON CONFLICT (user_id, meal_category_food_id) DO UPDATE
        SET custom_weight = EXCLUDED.custom_weight;
      ELSE
        RAISE NOTICE 'No mapping for override key: % (user: %)', override_key, user_id_val;
      END IF;
    END LOOP;
  END LOOP;

  -- Clean up temp table
  DROP TABLE IF EXISTS food_id_mapping;

  RAISE NOTICE 'Food overrides migration complete.';
END;
$$;

-- ─── 5. Verification Counts ────────────────────────────────
DO $$
DECLARE
  kv_profiles bigint;
  new_profiles bigint;
  kv_weights bigint;
  new_weights bigint;
  kv_invites bigint;
  new_invites bigint;
  kv_overrides bigint;
  new_overrides bigint;
BEGIN
  SELECT COUNT(*) INTO kv_profiles FROM kv_store_48e8ada4 WHERE key LIKE 'profile:%';
  SELECT COUNT(*) INTO new_profiles FROM public.profiles;

  SELECT COUNT(*) INTO kv_weights FROM kv_store_48e8ada4 WHERE key LIKE 'weight_log:%';
  SELECT COUNT(*) INTO new_weights FROM public.weight_logs;

  SELECT COUNT(*) INTO kv_invites FROM kv_store_48e8ada4 WHERE key LIKE 'invited_email:%';
  SELECT COUNT(*) INTO new_invites FROM public.invitations;

  SELECT COUNT(*) INTO kv_overrides FROM kv_store_48e8ada4 WHERE key LIKE 'food_overrides:%';
  SELECT COUNT(*) INTO new_overrides FROM (SELECT DISTINCT user_id FROM public.user_food_overrides) t;

  RAISE NOTICE '=== Migration Verification ===';
  RAISE NOTICE 'Profiles:  KV=% → New=%', kv_profiles, new_profiles;
  RAISE NOTICE 'Weights:   KV=% → New=%', kv_weights, new_weights;
  RAISE NOTICE 'Invites:   KV=% → New=%', kv_invites, new_invites;
  RAISE NOTICE 'Overrides: KV=% users → New=% users', kv_overrides, new_overrides;
END;
$$;
