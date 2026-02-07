-- ============================================================
-- NutriPlan: Seed food data from meal-data.ts
-- ============================================================
-- Inserts meals, categories, meal_categories, foods, meal_category_foods.
-- Foods and categories are deduplicated by name.

DO $$
DECLARE
  -- Meal IDs
  m_colazione     uuid;
  m_spuntino      uuid;
  m_pranzo        uuid;
  m_merenda       uuid;
  m_cena          uuid;

  -- Category IDs (deduplicated by name)
  cat_latticini   uuid;
  cat_cereali     uuid;
  cat_condimenti  uuid;
  cat_frutta      uuid;
  cat_preparazioni uuid;
  cat_fruttasecca uuid;
  cat_carbo       uuid;
  cat_proteine    uuid;
  cat_verdure     uuid;

  -- Meal-Category junction IDs
  mc_col_latticini   uuid;
  mc_col_cereali     uuid;
  mc_col_condimenti  uuid;
  mc_sm_frutta       uuid;
  mc_sm_preparazioni uuid;
  mc_sm_fruttasecca  uuid;
  mc_pr_carbo        uuid;
  mc_pr_proteine     uuid;
  mc_pr_verdure      uuid;
  mc_pr_condimenti   uuid;
  mc_me_frutta       uuid;
  mc_me_preparazioni uuid;
  mc_ce_carbo        uuid;
  mc_ce_proteine     uuid;
  mc_ce_verdure      uuid;
  mc_ce_condimenti   uuid;

  -- Food IDs (deduplicated by name)
  -- Colazione - Latticini
  f_yogurt_greco      uuid;
  f_latte_vacca       uuid;
  f_yogurt_bianco     uuid;
  f_yogurt_soia       uuid;
  f_centrifugato      uuid;
  f_bev_avena         uuid;
  f_bev_nocciola      uuid;
  f_bev_cocco         uuid;
  f_latte_mandorle    uuid;
  f_latte_soia        uuid;

  -- Colazione - Cereali
  f_fette_integrali   uuid;
  f_pane_integrale    uuid;
  f_biscotti_integrali uuid;
  f_pane_lariano      uuid;
  f_fette_biscottate  uuid;
  f_pane_segale       uuid;
  f_fiocchi_avena     uuid;
  f_fiocchi_orzo      uuid;
  f_muesli            uuid;
  f_allbran           uuid;

  -- Colazione - Condimenti
  f_marmellata        uuid;

  -- Frutta (shared spuntino/merenda)
  f_pere              uuid;
  f_mele              uuid;
  f_mele_annurche     uuid;
  f_ananas_fette      uuid;
  f_banane            uuid;
  f_prugne            uuid;
  f_fragole           uuid;
  f_castagne          uuid;
  f_arance            uuid;
  f_mirtilli          uuid;
  f_kiwi              uuid;
  f_mandarini         uuid;
  f_melone_inv        uuid;
  f_melagrane         uuid;
  f_papaya            uuid;
  f_clementine        uuid;
  f_uva               uuid;
  f_pompelmo          uuid;
  f_mango             uuid;

  -- Preparazioni (shared spuntino/merenda)
  f_frullata          uuid;
  f_frullato_latte    uuid;
  f_omogeneizzato     uuid;
  f_estratto_2v1f     uuid;
  f_spremuta          uuid;
  f_barretta_melinda  uuid;
  f_centrifuga_2v1f   uuid;
  f_ananas_secco      uuid;

  -- Frutta secca (spuntino)
  f_mandorle          uuid;
  f_noci              uuid;
  f_pinoli            uuid;
  f_noci_pecan        uuid;
  f_nocciole          uuid;
  f_pistacchi         uuid;
  f_macadamia         uuid;
  f_anacardi          uuid;

  -- Pranzo/Cena - Carboidrati (shared)
  f_pasta_integrale   uuid;
  f_pasta_semola      uuid;
  f_riso_integrale    uuid;
  f_riso_basmati      uuid;
  f_amaranto          uuid;
  f_avena             uuid;
  f_miglio            uuid;
  f_farro             uuid;
  f_mais_dolce        uuid;
  f_quinoa            uuid;
  f_orzo              uuid;
  f_grano_saraceno    uuid;
  f_gnocchi           uuid;
  f_polenta           uuid;
  f_patate            uuid;

  -- Pranzo/Cena - Proteine Animali (shared)
  f_tonno             uuid;
  f_vongola           uuid;
  f_triglia           uuid;
  f_salmone_fresco    uuid;
  f_salmone_affum     uuid;
  f_acciughe          uuid;
  f_sarda             uuid;
  f_sgombro           uuid;
  f_calamari          uuid;
  f_polpo             uuid;
  f_seppie            uuid;
  f_merluzzo          uuid;
  f_spigola           uuid;
  f_orata             uuid;
  f_pollo_petto       uuid;
  f_vitello           uuid;
  f_maiale            uuid;
  f_tacchino          uuid;
  f_pollo_intero      uuid;
  f_uovo              uuid;

  -- Pranzo/Cena - Proteine Vegetali (shared)
  f_legumi_scatola    uuid;
  f_piselli_freschi   uuid;
  f_fave              uuid;
  f_lupini            uuid;
  f_hummus            uuid;
  f_fagioli_borlotti  uuid;
  f_fagioli_cannellini uuid;
  f_lenticchie        uuid;
  f_piselli_scatola   uuid;
  f_legumi_secchi     uuid;

  -- Pranzo/Cena - Derivati/Alternative (shared)
  f_feta              uuid;
  f_mozzarella        uuid;
  f_fiocchi_formaggio uuid;
  f_caciottina        uuid;
  f_stracchino        uuid;
  f_ricotta           uuid;
  f_tofu              uuid;
  f_bistecca_soia     uuid;
  f_tempeh            uuid;

  -- Pranzo/Cena - Salumi (shared)
  f_prosciutto_sd     uuid;
  f_prosciutto_parma  uuid;
  f_bresaola          uuid;

  -- Pranzo/Cena - Verdure (shared)
  f_lattuga           uuid;
  f_alghe_wakame      uuid;
  f_carote            uuid;
  f_radicchio         uuid;
  f_pomodori          uuid;
  f_cetrioli          uuid;
  f_asparagi          uuid;
  f_crescione         uuid;
  f_rucola            uuid;
  f_peperoni          uuid;
  f_finocchi          uuid;
  f_funghi            uuid;
  f_bieta             uuid;
  f_spinaci           uuid;
  f_scarola           uuid;
  f_melanzane         uuid;
  f_fagiolini         uuid;
  f_cavolfiore        uuid;
  f_cavoli_bruxelles  uuid;
  f_carciofi          uuid;
  f_zucca             uuid;
  f_zucchine          uuid;
  f_germogli_soia     uuid;
  f_verza             uuid;
  f_verdure_surg      uuid;

  -- Condimenti
  f_olio              uuid;

BEGIN
  -- ─── MEALS ────────────────────────────────────────────────
  INSERT INTO public.meals (slug, name, icon, sort_order, is_free)
  VALUES ('colazione', 'Colazione', '☀️', 1, false)
  RETURNING id INTO m_colazione;

  INSERT INTO public.meals (slug, name, icon, sort_order, is_free)
  VALUES ('spuntino-mattina', 'Spuntino Mattina', '🍎', 2, true)
  RETURNING id INTO m_spuntino;

  INSERT INTO public.meals (slug, name, icon, sort_order, is_free)
  VALUES ('pranzo', 'Pranzo', '🍝', 3, false)
  RETURNING id INTO m_pranzo;

  INSERT INTO public.meals (slug, name, icon, sort_order, is_free)
  VALUES ('merenda', 'Merenda', '🍊', 4, true)
  RETURNING id INTO m_merenda;

  INSERT INTO public.meals (slug, name, icon, sort_order, is_free)
  VALUES ('cena', 'Cena', '🌙', 5, false)
  RETURNING id INTO m_cena;

  -- ─── CATEGORIES (deduplicated) ────────────────────────────
  INSERT INTO public.categories (slug, name, icon)
  VALUES ('latticini-bevande', 'Latticini / Bevande', '🥛')
  RETURNING id INTO cat_latticini;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('cereali-pane', 'Cereali / Pane', '🍞')
  RETURNING id INTO cat_cereali;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('condimenti', 'Condimenti', '🍯')
  RETURNING id INTO cat_condimenti;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('frutta', 'Frutta', '🍇')
  RETURNING id INTO cat_frutta;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('preparazioni-alternative', 'Preparazioni / Alternative', '🥤')
  RETURNING id INTO cat_preparazioni;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('frutta-secca', 'Frutta Secca', '🥜')
  RETURNING id INTO cat_fruttasecca;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('carboidrati-basi', 'Carboidrati / Basi', '🌾')
  RETURNING id INTO cat_carbo;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('proteine', 'Proteine', '🥩')
  RETURNING id INTO cat_proteine;

  INSERT INTO public.categories (slug, name, icon)
  VALUES ('verdure', 'Verdure', '🥬')
  RETURNING id INTO cat_verdure;

  -- ─── MEAL-CATEGORIES ─────────────────────────────────────
  -- Colazione
  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_colazione, cat_latticini, 1, false)
  RETURNING id INTO mc_col_latticini;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_colazione, cat_cereali, 2, false)
  RETURNING id INTO mc_col_cereali;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional, icon_override)
  VALUES (m_colazione, cat_condimenti, 3, true, '🍯')
  RETURNING id INTO mc_col_condimenti;

  -- Spuntino Mattina
  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_spuntino, cat_frutta, 1, false)
  RETURNING id INTO mc_sm_frutta;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_spuntino, cat_preparazioni, 2, false)
  RETURNING id INTO mc_sm_preparazioni;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_spuntino, cat_fruttasecca, 3, false)
  RETURNING id INTO mc_sm_fruttasecca;

  -- Pranzo
  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_pranzo, cat_carbo, 1, false)
  RETURNING id INTO mc_pr_carbo;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_pranzo, cat_proteine, 2, false)
  RETURNING id INTO mc_pr_proteine;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_pranzo, cat_verdure, 3, false)
  RETURNING id INTO mc_pr_verdure;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional, icon_override)
  VALUES (m_pranzo, cat_condimenti, 4, true, '🫒')
  RETURNING id INTO mc_pr_condimenti;

  -- Merenda
  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_merenda, cat_frutta, 1, false)
  RETURNING id INTO mc_me_frutta;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_merenda, cat_preparazioni, 2, false)
  RETURNING id INTO mc_me_preparazioni;

  -- Cena
  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_cena, cat_carbo, 1, false)
  RETURNING id INTO mc_ce_carbo;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_cena, cat_proteine, 2, false)
  RETURNING id INTO mc_ce_proteine;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional)
  VALUES (m_cena, cat_verdure, 3, false)
  RETURNING id INTO mc_ce_verdure;

  INSERT INTO public.meal_categories (meal_id, category_id, sort_order, is_optional, icon_override)
  VALUES (m_cena, cat_condimenti, 4, true, '🫒')
  RETURNING id INTO mc_ce_condimenti;

  -- ─── FOODS (deduplicated by name) ────────────────────────
  -- Colazione - Latticini
  INSERT INTO public.foods (name) VALUES ('Yogurt greco 2%') RETURNING id INTO f_yogurt_greco;
  INSERT INTO public.foods (name) VALUES ('Latte di vacca parz. scremato') RETURNING id INTO f_latte_vacca;
  INSERT INTO public.foods (name) VALUES ('Yogurt da latte bianco') RETURNING id INTO f_yogurt_bianco;
  INSERT INTO public.foods (name) VALUES ('Yogurt di soia') RETURNING id INTO f_yogurt_soia;
  INSERT INTO public.foods (name) VALUES ('Centrifugato o estratto (2 frutti + verdura)') RETURNING id INTO f_centrifugato;
  INSERT INTO public.foods (name) VALUES ('Bevanda alla avena') RETURNING id INTO f_bev_avena;
  INSERT INTO public.foods (name) VALUES ('Bevanda alla nocciola') RETURNING id INTO f_bev_nocciola;
  INSERT INTO public.foods (name) VALUES ('Bevanda al cocco') RETURNING id INTO f_bev_cocco;
  INSERT INTO public.foods (name) VALUES ('Latte di mandorle') RETURNING id INTO f_latte_mandorle;
  INSERT INTO public.foods (name) VALUES ('Latte di soia') RETURNING id INTO f_latte_soia;

  -- Colazione - Cereali
  INSERT INTO public.foods (name) VALUES ('Fette biscottate integrali') RETURNING id INTO f_fette_integrali;
  INSERT INTO public.foods (name) VALUES ('Pane di tipo integrale') RETURNING id INTO f_pane_integrale;
  INSERT INTO public.foods (name) VALUES ('Biscotti integrali') RETURNING id INTO f_biscotti_integrali;
  INSERT INTO public.foods (name) VALUES ('Pane es. Lariano bianco/scuro') RETURNING id INTO f_pane_lariano;
  INSERT INTO public.foods (name) VALUES ('Fette biscottate') RETURNING id INTO f_fette_biscottate;
  INSERT INTO public.foods (name) VALUES ('Pane di segale') RETURNING id INTO f_pane_segale;
  INSERT INTO public.foods (name) VALUES ('Fiocchi di avena') RETURNING id INTO f_fiocchi_avena;
  INSERT INTO public.foods (name) VALUES ('Fiocchi di orzo') RETURNING id INTO f_fiocchi_orzo;
  INSERT INTO public.foods (name) VALUES ('Muesli') RETURNING id INTO f_muesli;
  INSERT INTO public.foods (name) VALUES ('All-Bran Flakes Kellogg''s') RETURNING id INTO f_allbran;

  -- Colazione - Condimenti
  INSERT INTO public.foods (name) VALUES ('Marmellata') RETURNING id INTO f_marmellata;

  -- Frutta (shared by spuntino and merenda - same weights per original data)
  INSERT INTO public.foods (name) VALUES ('Pere') RETURNING id INTO f_pere;
  INSERT INTO public.foods (name) VALUES ('Mele') RETURNING id INTO f_mele;
  INSERT INTO public.foods (name) VALUES ('Mele annurche') RETURNING id INTO f_mele_annurche;
  INSERT INTO public.foods (name) VALUES ('Ananas (fette)') RETURNING id INTO f_ananas_fette;
  INSERT INTO public.foods (name) VALUES ('Banane') RETURNING id INTO f_banane;
  INSERT INTO public.foods (name) VALUES ('Prugne') RETURNING id INTO f_prugne;
  INSERT INTO public.foods (name) VALUES ('Fragole') RETURNING id INTO f_fragole;
  INSERT INTO public.foods (name) VALUES ('Castagne fresche') RETURNING id INTO f_castagne;
  INSERT INTO public.foods (name) VALUES ('Arance') RETURNING id INTO f_arance;
  INSERT INTO public.foods (name) VALUES ('Mirtilli') RETURNING id INTO f_mirtilli;
  INSERT INTO public.foods (name) VALUES ('Kiwi') RETURNING id INTO f_kiwi;
  INSERT INTO public.foods (name) VALUES ('Mandarini') RETURNING id INTO f_mandarini;
  INSERT INTO public.foods (name) VALUES ('Melone invernale') RETURNING id INTO f_melone_inv;
  INSERT INTO public.foods (name) VALUES ('Melagrane') RETURNING id INTO f_melagrane;
  INSERT INTO public.foods (name) VALUES ('Papaya') RETURNING id INTO f_papaya;
  INSERT INTO public.foods (name) VALUES ('Clementine') RETURNING id INTO f_clementine;
  INSERT INTO public.foods (name) VALUES ('Uva') RETURNING id INTO f_uva;
  INSERT INTO public.foods (name) VALUES ('Pompelmo') RETURNING id INTO f_pompelmo;
  INSERT INTO public.foods (name) VALUES ('Mango') RETURNING id INTO f_mango;

  -- Preparazioni (shared by spuntino and merenda)
  INSERT INTO public.foods (name) VALUES ('Frutta frullata (smoothie)') RETURNING id INTO f_frullata;
  INSERT INTO public.foods (name) VALUES ('Frullato (latte di mandorla o vaccino)') RETURNING id INTO f_frullato_latte;
  INSERT INTO public.foods (name) VALUES ('Omogeneizzato di frutta') RETURNING id INTO f_omogeneizzato;
  INSERT INTO public.foods (name) VALUES ('Estratto (2 verdure, 1 frutto)') RETURNING id INTO f_estratto_2v1f;
  INSERT INTO public.foods (name) VALUES ('Spremuta di arancia') RETURNING id INTO f_spremuta;
  INSERT INTO public.foods (name) VALUES ('Barretta Melinda (solo frutta)') RETURNING id INTO f_barretta_melinda;
  INSERT INTO public.foods (name) VALUES ('Centrifuga (2 verdure, 1 frutto)') RETURNING id INTO f_centrifuga_2v1f;
  INSERT INTO public.foods (name) VALUES ('Ananas secco') RETURNING id INTO f_ananas_secco;

  -- Frutta secca
  INSERT INTO public.foods (name) VALUES ('Mandorle dolci secche') RETURNING id INTO f_mandorle;
  INSERT INTO public.foods (name) VALUES ('Noci secche') RETURNING id INTO f_noci;
  INSERT INTO public.foods (name) VALUES ('Pinoli') RETURNING id INTO f_pinoli;
  INSERT INTO public.foods (name) VALUES ('Noci pecan') RETURNING id INTO f_noci_pecan;
  INSERT INTO public.foods (name) VALUES ('Nocciole secche') RETURNING id INTO f_nocciole;
  INSERT INTO public.foods (name) VALUES ('Pistacchi') RETURNING id INTO f_pistacchi;
  INSERT INTO public.foods (name) VALUES ('Macadamia') RETURNING id INTO f_macadamia;
  INSERT INTO public.foods (name) VALUES ('Anacardi') RETURNING id INTO f_anacardi;

  -- Carboidrati (shared pranzo/cena - different weights)
  INSERT INTO public.foods (name) VALUES ('Pasta integrale') RETURNING id INTO f_pasta_integrale;
  INSERT INTO public.foods (name) VALUES ('Pasta di semola') RETURNING id INTO f_pasta_semola;
  INSERT INTO public.foods (name) VALUES ('Riso integrale') RETURNING id INTO f_riso_integrale;
  INSERT INTO public.foods (name) VALUES ('Riso (basmati)') RETURNING id INTO f_riso_basmati;
  INSERT INTO public.foods (name) VALUES ('Amaranto') RETURNING id INTO f_amaranto;
  INSERT INTO public.foods (name) VALUES ('Avena') RETURNING id INTO f_avena;
  INSERT INTO public.foods (name) VALUES ('Miglio') RETURNING id INTO f_miglio;
  INSERT INTO public.foods (name) VALUES ('Farro') RETURNING id INTO f_farro;
  INSERT INTO public.foods (name) VALUES ('Mais dolce (in scatola)') RETURNING id INTO f_mais_dolce;
  INSERT INTO public.foods (name) VALUES ('Quinoa') RETURNING id INTO f_quinoa;
  INSERT INTO public.foods (name) VALUES ('Orzo') RETURNING id INTO f_orzo;
  INSERT INTO public.foods (name) VALUES ('Grano saraceno') RETURNING id INTO f_grano_saraceno;
  INSERT INTO public.foods (name) VALUES ('Gnocchi') RETURNING id INTO f_gnocchi;
  INSERT INTO public.foods (name) VALUES ('Polenta') RETURNING id INTO f_polenta;
  INSERT INTO public.foods (name) VALUES ('Patate') RETURNING id INTO f_patate;

  -- Proteine Animali (shared pranzo/cena)
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Tonno sott''olio sgocciolato', 'Proteine Animali', '🐟') RETURNING id INTO f_tonno;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Vongola', 'Proteine Animali', '🐟') RETURNING id INTO f_vongola;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Triglia', 'Proteine Animali', '🐟') RETURNING id INTO f_triglia;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Salmone fresco', 'Proteine Animali', '🐟') RETURNING id INTO f_salmone_fresco;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Salmone affumicato', 'Proteine Animali', '🐟') RETURNING id INTO f_salmone_affum;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Acciughe o alici fresche', 'Proteine Animali', '🐟') RETURNING id INTO f_acciughe;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Sarda', 'Proteine Animali', '🐟') RETURNING id INTO f_sarda;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Sgombro o maccarello fresco', 'Proteine Animali', '🐟') RETURNING id INTO f_sgombro;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Calamari freschi', 'Proteine Animali', '🐟') RETURNING id INTO f_calamari;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Polpo', 'Proteine Animali', '🐟') RETURNING id INTO f_polpo;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Seppie', 'Proteine Animali', '🐟') RETURNING id INTO f_seppie;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Merluzzo o nasello / baccalà ammollato', 'Proteine Animali', '🐟') RETURNING id INTO f_merluzzo;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Spigola', 'Proteine Animali', '🐟') RETURNING id INTO f_spigola;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Orata filetti', 'Proteine Animali', '🐟') RETURNING id INTO f_orata;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Pollo petto', 'Proteine Animali', '🐟') RETURNING id INTO f_pollo_petto;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Vitello magro', 'Proteine Animali', '🐟') RETURNING id INTO f_vitello;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Maiale magro (lombo)', 'Proteine Animali', '🐟') RETURNING id INTO f_maiale;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Tacchino petto', 'Proteine Animali', '🐟') RETURNING id INTO f_tacchino;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Pollo intero senza pelle', 'Proteine Animali', '🐟') RETURNING id INTO f_pollo_intero;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Uovo di gallina intero', 'Proteine Animali', '🐟') RETURNING id INTO f_uovo;

  -- Proteine Vegetali / Legumi
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Legumi in scatola (media)', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_legumi_scatola;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Piselli freschi', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_piselli_freschi;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Fave', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_fave;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Lupini deamarizzati', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_lupini;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Hummus di ceci', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_hummus;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Fagioli borlotti in scatola (scolati)', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_fagioli_borlotti;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Fagioli cannellini in scatola (scolati)', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_fagioli_cannellini;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Lenticchie decorticate', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_lenticchie;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Piselli in scatola', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_piselli_scatola;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Legumi secchi (media)', 'Proteine Vegetali / Legumi', '🫘') RETURNING id INTO f_legumi_secchi;

  -- Derivati / Alternative Vegetali
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Feta', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_feta;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Mozzarella di vacca', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_mozzarella;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Fiocchi di formaggio magro', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_fiocchi_formaggio;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Caciottina fresca', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_caciottina;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Stracchino', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_stracchino;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Ricotta di vacca', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_ricotta;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Formaggio di soia (tofu)', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_tofu;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Bistecca di soia', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_bistecca_soia;
  INSERT INTO public.foods (name, sub_group, sub_group_icon) VALUES ('Tempeh', 'Derivati / Alternative Vegetali', '🧀') RETURNING id INTO f_tempeh;

  -- Salumi
  INSERT INTO public.foods (name, note, sub_group, sub_group_icon) VALUES ('Prosciutto crudo San Daniele magro', '1/7', 'Salumi (indicati 1/7)', '🥓') RETURNING id INTO f_prosciutto_sd;
  INSERT INTO public.foods (name, note, sub_group, sub_group_icon) VALUES ('Prosciutto crudo di Parma magro', '1/7', 'Salumi (indicati 1/7)', '🥓') RETURNING id INTO f_prosciutto_parma;
  INSERT INTO public.foods (name, note, sub_group, sub_group_icon) VALUES ('Bresaola', '1/7', 'Salumi (indicati 1/7)', '🥓') RETURNING id INTO f_bresaola;

  -- Verdure (shared pranzo/cena)
  INSERT INTO public.foods (name) VALUES ('Lattuga') RETURNING id INTO f_lattuga;
  INSERT INTO public.foods (name) VALUES ('Alghe Wakame secca') RETURNING id INTO f_alghe_wakame;
  INSERT INTO public.foods (name) VALUES ('Carote') RETURNING id INTO f_carote;
  INSERT INTO public.foods (name) VALUES ('Radicchio rosso') RETURNING id INTO f_radicchio;
  INSERT INTO public.foods (name) VALUES ('Pomodori da insalata') RETURNING id INTO f_pomodori;
  INSERT INTO public.foods (name) VALUES ('Cetrioli') RETURNING id INTO f_cetrioli;
  INSERT INTO public.foods (name) VALUES ('Asparagi di serra') RETURNING id INTO f_asparagi;
  INSERT INTO public.foods (name) VALUES ('Crescione') RETURNING id INTO f_crescione;
  INSERT INTO public.foods (name) VALUES ('Rucola o rughetta') RETURNING id INTO f_rucola;
  INSERT INTO public.foods (name) VALUES ('Peperoni') RETURNING id INTO f_peperoni;
  INSERT INTO public.foods (name) VALUES ('Finocchi') RETURNING id INTO f_finocchi;
  INSERT INTO public.foods (name) VALUES ('Funghi prataioli coltivati') RETURNING id INTO f_funghi;
  INSERT INTO public.foods (name) VALUES ('Bieta') RETURNING id INTO f_bieta;
  INSERT INTO public.foods (name) VALUES ('Spinaci') RETURNING id INTO f_spinaci;
  INSERT INTO public.foods (name) VALUES ('Scarola') RETURNING id INTO f_scarola;
  INSERT INTO public.foods (name) VALUES ('Melanzane') RETURNING id INTO f_melanzane;
  INSERT INTO public.foods (name) VALUES ('Fagiolini') RETURNING id INTO f_fagiolini;
  INSERT INTO public.foods (name) VALUES ('Cavolfiore') RETURNING id INTO f_cavolfiore;
  INSERT INTO public.foods (name) VALUES ('Cavoli di Bruxelles') RETURNING id INTO f_cavoli_bruxelles;
  INSERT INTO public.foods (name) VALUES ('Carciofi') RETURNING id INTO f_carciofi;
  INSERT INTO public.foods (name) VALUES ('Zucca gialla') RETURNING id INTO f_zucca;
  INSERT INTO public.foods (name) VALUES ('Zucchine') RETURNING id INTO f_zucchine;
  INSERT INTO public.foods (name) VALUES ('Germogli di soia') RETURNING id INTO f_germogli_soia;
  INSERT INTO public.foods (name) VALUES ('Verza') RETURNING id INTO f_verza;
  INSERT INTO public.foods (name) VALUES ('Verdure surgelate (media)') RETURNING id INTO f_verdure_surg;

  -- Olio
  INSERT INTO public.foods (name) VALUES ('Olio di oliva extravergine') RETURNING id INTO f_olio;

  -- ─── MEAL_CATEGORY_FOODS ─────────────────────────────────
  -- Each INSERT links a food to a meal-category with its context-specific base_weight.

  -- === COLAZIONE - Latticini ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_col_latticini, f_yogurt_greco, 100, 1),
    (mc_col_latticini, f_latte_vacca, 150, 2),
    (mc_col_latticini, f_yogurt_bianco, 170, 3),
    (mc_col_latticini, f_yogurt_soia, 125, 4),
    (mc_col_latticini, f_centrifugato, 150, 5),
    (mc_col_latticini, f_bev_avena, 150, 6),
    (mc_col_latticini, f_bev_nocciola, 150, 7),
    (mc_col_latticini, f_bev_cocco, 150, 8),
    (mc_col_latticini, f_latte_mandorle, 150, 9),
    (mc_col_latticini, f_latte_soia, 150, 10);

  -- === COLAZIONE - Cereali ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_col_cereali, f_fette_integrali, 60, 1),
    (mc_col_cereali, f_pane_integrale, 100, 2),
    (mc_col_cereali, f_biscotti_integrali, 50, 3),
    (mc_col_cereali, f_pane_lariano, 80, 4),
    (mc_col_cereali, f_fette_biscottate, 60, 5),
    (mc_col_cereali, f_pane_segale, 100, 6),
    (mc_col_cereali, f_fiocchi_avena, 60, 7),
    (mc_col_cereali, f_fiocchi_orzo, 60, 8),
    (mc_col_cereali, f_muesli, 60, 9),
    (mc_col_cereali, f_allbran, 60, 10);

  -- === COLAZIONE - Condimenti ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_col_condimenti, f_marmellata, 20, 1);

  -- === SPUNTINO MATTINA - Frutta ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_sm_frutta, f_pere, 250, 1),
    (mc_sm_frutta, f_mele, 150, 2),
    (mc_sm_frutta, f_mele_annurche, 200, 3),
    (mc_sm_frutta, f_ananas_fette, 200, 4),
    (mc_sm_frutta, f_banane, 150, 5),
    (mc_sm_frutta, f_prugne, 200, 6),
    (mc_sm_frutta, f_fragole, 300, 7),
    (mc_sm_frutta, f_castagne, 50, 8),
    (mc_sm_frutta, f_arance, 250, 9),
    (mc_sm_frutta, f_mirtilli, 300, 10),
    (mc_sm_frutta, f_kiwi, 200, 11),
    (mc_sm_frutta, f_mandarini, 100, 12),
    (mc_sm_frutta, f_melone_inv, 300, 13),
    (mc_sm_frutta, f_melagrane, 150, 14),
    (mc_sm_frutta, f_papaya, 300, 15),
    (mc_sm_frutta, f_clementine, 200, 16),
    (mc_sm_frutta, f_uva, 150, 17),
    (mc_sm_frutta, f_pompelmo, 300, 18),
    (mc_sm_frutta, f_mango, 150, 19);

  -- === SPUNTINO MATTINA - Preparazioni ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_sm_preparazioni, f_frullata, 100, 1),
    (mc_sm_preparazioni, f_frullato_latte, 100, 2),
    (mc_sm_preparazioni, f_omogeneizzato, 100, 3),
    (mc_sm_preparazioni, f_estratto_2v1f, 150, 4),
    (mc_sm_preparazioni, f_spremuta, 150, 5),
    (mc_sm_preparazioni, f_barretta_melinda, 50, 6),
    (mc_sm_preparazioni, f_centrifuga_2v1f, 150, 7),
    (mc_sm_preparazioni, f_ananas_secco, 100, 8);

  -- === SPUNTINO MATTINA - Frutta Secca ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_sm_fruttasecca, f_mandorle, 20, 1),
    (mc_sm_fruttasecca, f_noci, 20, 2),
    (mc_sm_fruttasecca, f_pinoli, 20, 3),
    (mc_sm_fruttasecca, f_noci_pecan, 20, 4),
    (mc_sm_fruttasecca, f_nocciole, 20, 5),
    (mc_sm_fruttasecca, f_pistacchi, 20, 6),
    (mc_sm_fruttasecca, f_macadamia, 20, 7),
    (mc_sm_fruttasecca, f_anacardi, 20, 8);

  -- === PRANZO - Carboidrati ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_pr_carbo, f_pane_integrale, 150, 1),
    (mc_pr_carbo, f_pasta_integrale, 100, 2),
    (mc_pr_carbo, f_pasta_semola, 100, 3),
    (mc_pr_carbo, f_riso_integrale, 100, 4),
    (mc_pr_carbo, f_riso_basmati, 100, 5),
    (mc_pr_carbo, f_amaranto, 90, 6),
    (mc_pr_carbo, f_avena, 110, 7),
    (mc_pr_carbo, f_miglio, 90, 8),
    (mc_pr_carbo, f_pane_segale, 150, 9),
    (mc_pr_carbo, f_farro, 100, 10),
    (mc_pr_carbo, f_mais_dolce, 200, 11),
    (mc_pr_carbo, f_quinoa, 90, 12),
    (mc_pr_carbo, f_orzo, 110, 13),
    (mc_pr_carbo, f_grano_saraceno, 110, 14),
    (mc_pr_carbo, f_gnocchi, 230, 15),
    (mc_pr_carbo, f_polenta, 150, 16),
    (mc_pr_carbo, f_pane_lariano, 120, 17),
    (mc_pr_carbo, f_patate, 300, 18);

  -- === PRANZO - Proteine ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    -- Proteine Animali
    (mc_pr_proteine, f_tonno, 60, 1),
    (mc_pr_proteine, f_vongola, 100, 2),
    (mc_pr_proteine, f_triglia, 80, 3),
    (mc_pr_proteine, f_salmone_fresco, 80, 4),
    (mc_pr_proteine, f_salmone_affum, 80, 5),
    (mc_pr_proteine, f_acciughe, 100, 6),
    (mc_pr_proteine, f_sarda, 80, 7),
    (mc_pr_proteine, f_sgombro, 60, 8),
    (mc_pr_proteine, f_calamari, 120, 9),
    (mc_pr_proteine, f_polpo, 150, 10),
    (mc_pr_proteine, f_seppie, 120, 11),
    (mc_pr_proteine, f_merluzzo, 100, 12),
    (mc_pr_proteine, f_spigola, 100, 13),
    (mc_pr_proteine, f_orata, 100, 14),
    (mc_pr_proteine, f_pollo_petto, 90, 15),
    (mc_pr_proteine, f_vitello, 90, 16),
    (mc_pr_proteine, f_maiale, 80, 17),
    (mc_pr_proteine, f_tacchino, 80, 18),
    (mc_pr_proteine, f_pollo_intero, 80, 19),
    (mc_pr_proteine, f_uovo, 60, 20),
    -- Proteine Vegetali / Legumi
    (mc_pr_proteine, f_legumi_scatola, 100, 21),
    (mc_pr_proteine, f_piselli_freschi, 150, 22),
    (mc_pr_proteine, f_fave, 200, 23),
    (mc_pr_proteine, f_lupini, 80, 24),
    (mc_pr_proteine, f_hummus, 60, 25),
    (mc_pr_proteine, f_fagioli_borlotti, 100, 26),
    (mc_pr_proteine, f_fagioli_cannellini, 120, 27),
    (mc_pr_proteine, f_lenticchie, 120, 28),
    (mc_pr_proteine, f_piselli_scatola, 150, 29),
    (mc_pr_proteine, f_legumi_secchi, 40, 30),
    -- Derivati / Alternative Vegetali
    (mc_pr_proteine, f_feta, 60, 31),
    (mc_pr_proteine, f_mozzarella, 60, 32),
    (mc_pr_proteine, f_fiocchi_formaggio, 80, 33),
    (mc_pr_proteine, f_caciottina, 50, 34),
    (mc_pr_proteine, f_stracchino, 50, 35),
    (mc_pr_proteine, f_ricotta, 60, 36),
    (mc_pr_proteine, f_tofu, 100, 37),
    (mc_pr_proteine, f_bistecca_soia, 80, 38),
    (mc_pr_proteine, f_tempeh, 60, 39),
    -- Salumi
    (mc_pr_proteine, f_prosciutto_sd, 60, 40),
    (mc_pr_proteine, f_prosciutto_parma, 60, 41),
    (mc_pr_proteine, f_bresaola, 60, 42);

  -- === PRANZO - Verdure ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_pr_verdure, f_lattuga, 200, 1),
    (mc_pr_verdure, f_alghe_wakame, 30, 2),
    (mc_pr_verdure, f_carote, 250, 3),
    (mc_pr_verdure, f_radicchio, 250, 4),
    (mc_pr_verdure, f_pomodori, 300, 5),
    (mc_pr_verdure, f_cetrioli, 300, 6),
    (mc_pr_verdure, f_asparagi, 200, 7),
    (mc_pr_verdure, f_crescione, 100, 8),
    (mc_pr_verdure, f_rucola, 150, 9),
    (mc_pr_verdure, f_peperoni, 300, 10),
    (mc_pr_verdure, f_finocchi, 300, 11),
    (mc_pr_verdure, f_funghi, 200, 12),
    (mc_pr_verdure, f_bieta, 300, 13),
    (mc_pr_verdure, f_spinaci, 200, 14),
    (mc_pr_verdure, f_scarola, 200, 15),
    (mc_pr_verdure, f_melanzane, 300, 16),
    (mc_pr_verdure, f_fagiolini, 150, 17),
    (mc_pr_verdure, f_cavolfiore, 150, 18),
    (mc_pr_verdure, f_cavoli_bruxelles, 150, 19),
    (mc_pr_verdure, f_carciofi, 150, 20),
    (mc_pr_verdure, f_zucca, 300, 21),
    (mc_pr_verdure, f_zucchine, 300, 22),
    (mc_pr_verdure, f_germogli_soia, 100, 23),
    (mc_pr_verdure, f_verza, 150, 24),
    (mc_pr_verdure, f_verdure_surg, 150, 25);

  -- === PRANZO - Condimenti ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_pr_condimenti, f_olio, 15, 1);

  -- === MERENDA - Frutta (same weights as spuntino) ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_me_frutta, f_mele, 150, 1),
    (mc_me_frutta, f_pere, 250, 2),
    (mc_me_frutta, f_mele_annurche, 200, 3),
    (mc_me_frutta, f_ananas_fette, 200, 4),
    (mc_me_frutta, f_banane, 150, 5),
    (mc_me_frutta, f_prugne, 200, 6),
    (mc_me_frutta, f_fragole, 300, 7),
    (mc_me_frutta, f_castagne, 50, 8),
    (mc_me_frutta, f_arance, 250, 9),
    (mc_me_frutta, f_mirtilli, 300, 10),
    (mc_me_frutta, f_kiwi, 200, 11),
    (mc_me_frutta, f_mandarini, 100, 12),
    (mc_me_frutta, f_melone_inv, 300, 13),
    (mc_me_frutta, f_melagrane, 150, 14),
    (mc_me_frutta, f_papaya, 300, 15),
    (mc_me_frutta, f_clementine, 200, 16),
    (mc_me_frutta, f_uva, 150, 17),
    (mc_me_frutta, f_pompelmo, 300, 18),
    (mc_me_frutta, f_mango, 150, 19);

  -- === MERENDA - Preparazioni (same weights as spuntino) ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_me_preparazioni, f_frullata, 100, 1),
    (mc_me_preparazioni, f_frullato_latte, 100, 2),
    (mc_me_preparazioni, f_omogeneizzato, 100, 3),
    (mc_me_preparazioni, f_estratto_2v1f, 150, 4),
    (mc_me_preparazioni, f_spremuta, 150, 5),
    (mc_me_preparazioni, f_barretta_melinda, 50, 6),
    (mc_me_preparazioni, f_centrifuga_2v1f, 150, 7),
    (mc_me_preparazioni, f_ananas_secco, 100, 8);

  -- === CENA - Carboidrati (different weights than pranzo) ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_ce_carbo, f_pasta_integrale, 120, 1),
    (mc_ce_carbo, f_pane_integrale, 150, 2),
    (mc_ce_carbo, f_pasta_semola, 110, 3),
    (mc_ce_carbo, f_amaranto, 100, 4),
    (mc_ce_carbo, f_riso_basmati, 120, 5),
    (mc_ce_carbo, f_riso_integrale, 120, 6),
    (mc_ce_carbo, f_avena, 130, 7),
    (mc_ce_carbo, f_miglio, 110, 8),
    (mc_ce_carbo, f_farro, 120, 9),
    (mc_ce_carbo, f_mais_dolce, 200, 10),
    (mc_ce_carbo, f_quinoa, 110, 11),
    (mc_ce_carbo, f_orzo, 120, 12),
    (mc_ce_carbo, f_grano_saraceno, 120, 13),
    (mc_ce_carbo, f_gnocchi, 270, 14),
    (mc_ce_carbo, f_polenta, 150, 15),
    (mc_ce_carbo, f_pane_segale, 150, 16),
    (mc_ce_carbo, f_pane_lariano, 140, 17),
    (mc_ce_carbo, f_patate, 300, 18);

  -- === CENA - Proteine (different weights than pranzo) ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    -- Proteine Animali
    (mc_ce_proteine, f_tonno, 80, 1),
    (mc_ce_proteine, f_vongola, 130, 2),
    (mc_ce_proteine, f_triglia, 100, 3),
    (mc_ce_proteine, f_salmone_fresco, 100, 4),
    (mc_ce_proteine, f_salmone_affum, 100, 5),
    (mc_ce_proteine, f_acciughe, 130, 6),
    (mc_ce_proteine, f_sarda, 100, 7),
    (mc_ce_proteine, f_sgombro, 80, 8),
    (mc_ce_proteine, f_calamari, 150, 9),
    (mc_ce_proteine, f_polpo, 200, 10),
    (mc_ce_proteine, f_seppie, 150, 11),
    (mc_ce_proteine, f_merluzzo, 130, 12),
    (mc_ce_proteine, f_spigola, 130, 13),
    (mc_ce_proteine, f_orata, 130, 14),
    (mc_ce_proteine, f_pollo_petto, 120, 15),
    (mc_ce_proteine, f_vitello, 120, 16),
    (mc_ce_proteine, f_maiale, 100, 17),
    (mc_ce_proteine, f_tacchino, 110, 18),
    (mc_ce_proteine, f_pollo_intero, 110, 19),
    (mc_ce_proteine, f_uovo, 60, 20),
    -- Proteine Vegetali / Legumi
    (mc_ce_proteine, f_piselli_freschi, 300, 21),
    (mc_ce_proteine, f_fave, 300, 22),
    (mc_ce_proteine, f_lupini, 200, 23),
    (mc_ce_proteine, f_hummus, 230, 24),
    (mc_ce_proteine, f_fagioli_borlotti, 300, 25),
    (mc_ce_proteine, f_fagioli_cannellini, 300, 26),
    (mc_ce_proteine, f_legumi_scatola, 300, 27),
    (mc_ce_proteine, f_lenticchie, 300, 28),
    (mc_ce_proteine, f_piselli_scatola, 300, 29),
    (mc_ce_proteine, f_legumi_secchi, 130, 30),
    -- Derivati / Alternative Vegetali
    (mc_ce_proteine, f_feta, 80, 31),
    (mc_ce_proteine, f_mozzarella, 80, 32),
    (mc_ce_proteine, f_fiocchi_formaggio, 100, 33),
    (mc_ce_proteine, f_caciottina, 70, 34),
    (mc_ce_proteine, f_stracchino, 70, 35),
    (mc_ce_proteine, f_ricotta, 80, 36),
    (mc_ce_proteine, f_tofu, 130, 37),
    (mc_ce_proteine, f_bistecca_soia, 100, 38),
    (mc_ce_proteine, f_tempeh, 80, 39),
    -- Salumi
    (mc_ce_proteine, f_prosciutto_sd, 60, 40),
    (mc_ce_proteine, f_prosciutto_parma, 60, 41),
    (mc_ce_proteine, f_bresaola, 60, 42);

  -- === CENA - Verdure (same weights as pranzo, different order) ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_ce_verdure, f_finocchi, 300, 1),
    (mc_ce_verdure, f_lattuga, 200, 2),
    (mc_ce_verdure, f_carote, 250, 3),
    (mc_ce_verdure, f_radicchio, 250, 4),
    (mc_ce_verdure, f_pomodori, 300, 5),
    (mc_ce_verdure, f_cetrioli, 300, 6),
    (mc_ce_verdure, f_asparagi, 200, 7),
    (mc_ce_verdure, f_crescione, 100, 8),
    (mc_ce_verdure, f_rucola, 150, 9),
    (mc_ce_verdure, f_peperoni, 300, 10),
    (mc_ce_verdure, f_funghi, 200, 11),
    (mc_ce_verdure, f_bieta, 300, 12),
    (mc_ce_verdure, f_spinaci, 200, 13),
    (mc_ce_verdure, f_scarola, 200, 14),
    (mc_ce_verdure, f_melanzane, 300, 15),
    (mc_ce_verdure, f_fagiolini, 150, 16),
    (mc_ce_verdure, f_cavolfiore, 150, 17),
    (mc_ce_verdure, f_cavoli_bruxelles, 150, 18),
    (mc_ce_verdure, f_carciofi, 150, 19),
    (mc_ce_verdure, f_zucca, 300, 20),
    (mc_ce_verdure, f_zucchine, 300, 21),
    (mc_ce_verdure, f_germogli_soia, 100, 22),
    (mc_ce_verdure, f_verza, 150, 23),
    (mc_ce_verdure, f_verdure_surg, 150, 24);

  -- === CENA - Condimenti ===
  INSERT INTO public.meal_category_foods (meal_category_id, food_id, base_weight, sort_order) VALUES
    (mc_ce_condimenti, f_olio, 10, 1);

  RAISE NOTICE 'Seed complete.';
END;
$$;
