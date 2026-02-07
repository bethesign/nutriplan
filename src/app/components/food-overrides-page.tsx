import { useState, useEffect, useMemo } from "react";
import {
  Search, Save, RotateCcw, Loader2, ChevronDown, ChevronRight,
  AlertCircle, CheckCircle2, Settings2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "./supabase-client";
import type { Meal } from "./types";

// Overrides keyed by meal_category_food UUID → custom weight
export type FoodOverrides = Record<string, number>;

interface FoodOverridesPageProps {
  meals: Meal[];
  overrides: FoodOverrides;
  onOverridesChange: (overrides: FoodOverrides) => void;
}

export function FoodOverridesPage({ meals, overrides, onOverridesChange }: FoodOverridesPageProps) {
  const [localOverrides, setLocalOverrides] = useState<FoodOverrides>({});
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set(meals.map((m) => m.id)));
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [hasChanges, setHasChanges] = useState(false);

  useEffect(() => {
    setLocalOverrides({ ...overrides });
    setHasChanges(false);
  }, [overrides]);

  const toggleMeal = (id: string) => {
    setExpandedMeals((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const toggleCat = (id: string) => {
    setExpandedCats((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  };

  const handleWeightChange = (foodId: string, value: string) => {
    const num = parseFloat(value);
    setLocalOverrides((prev) => {
      const next = { ...prev };
      if (value === "" || isNaN(num)) {
        delete next[foodId];
      } else {
        next[foodId] = num;
      }
      return next;
    });
    setHasChanges(true);
  };

  const handleReset = (foodId: string) => {
    setLocalOverrides((prev) => {
      const next = { ...prev };
      delete next[foodId];
      return next;
    });
    setHasChanges(true);
  };

  const handleResetAll = () => {
    setLocalOverrides({});
    setHasChanges(true);
  };

  const handleSave = async () => {
    setSaving(true);
    try {
      const res = await apiFetch("/food-overrides", {
        method: "PUT",
        body: JSON.stringify({ overrides: localOverrides }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Pesi personalizzati salvati!");
        onOverridesChange(localOverrides);
        setHasChanges(false);
      }
    } catch (err) {
      console.error("Save overrides error:", err);
      toast.error("Errore nel salvataggio");
    } finally {
      setSaving(false);
    }
  };

  // Count overrides
  const overrideCount = Object.keys(localOverrides).length;

  // Search filter
  const searchLower = search.toLowerCase().trim();

  // All food IDs with their meal/category context for search
  const allFoods = useMemo(() => {
    const result: {
      mealId: string;
      mealName: string;
      catId: string;
      catName: string;
      foodId: string;
      foodName: string;
      defaultWeight: number;
    }[] = [];
    meals.forEach((meal) => {
      meal.categories.forEach((cat) => {
        cat.items.forEach((item) => {
          result.push({
            mealId: meal.id,
            mealName: meal.name,
            catId: cat.id,
            catName: cat.name,
            foodId: item.id,
            foodName: item.name,
            defaultWeight: item.baseWeight,
          });
        });
      });
    });
    return result;
  }, [meals]);

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#6c63ff] to-[#a855f7] flex items-center justify-center shadow-md">
          <Settings2 className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#1b4332]">Gestione alimenti</h2>
          <p className="text-sm text-[#95d5b2]">
            Personalizza i pesi base per adattarli alle tue esigenze
          </p>
        </div>
      </div>

      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
          {/* Search */}
          <div className="relative flex-1 w-full">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
            <input
              type="text"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
              placeholder="Cerca alimento..."
              className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
            />
          </div>

          <div className="flex items-center gap-2 flex-shrink-0">
            {overrideCount > 0 && (
              <span className="text-xs text-[#6c63ff] bg-[#6c63ff]/10 px-2.5 py-1 rounded-full">
                {overrideCount} personalizzat{overrideCount === 1 ? "o" : "i"}
              </span>
            )}

            {overrideCount > 0 && (
              <button
                onClick={handleResetAll}
                className="flex items-center gap-1.5 text-xs text-[#999] hover:text-[#d00] px-2.5 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3 h-3" />
                Reset tutti
              </button>
            )}

            <button
              onClick={handleSave}
              disabled={saving || !hasChanges}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
              Salva
            </button>
          </div>
        </div>

        {hasChanges && (
          <div className="flex items-center gap-2 mt-3 text-xs text-amber-600 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
            <AlertCircle className="w-3.5 h-3.5 flex-shrink-0" />
            Hai modifiche non salvate
          </div>
        )}
      </div>

      {/* Food list by meal/category */}
      {searchLower ? (
        /* Search results */
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e8f5e9] bg-[#f8fdf9]">
            <span className="text-sm text-[#888]">
              Risultati per "{search}"
            </span>
          </div>
          <div className="divide-y divide-[#f0f0f0]">
            {allFoods
              .filter((f) => f.foodName.toLowerCase().includes(searchLower))
              .map((food) => (
                <FoodRow
                  key={food.foodId}
                  foodId={food.foodId}
                  foodName={food.foodName}
                  defaultWeight={food.defaultWeight}
                  customWeight={localOverrides[food.foodId]}
                  mealName={food.mealName}
                  catName={food.catName}
                  onWeightChange={handleWeightChange}
                  onReset={handleReset}
                />
              ))}
            {allFoods.filter((f) => f.foodName.toLowerCase().includes(searchLower)).length === 0 && (
              <div className="px-5 py-8 text-center text-sm text-[#999]">
                Nessun alimento trovato
              </div>
            )}
          </div>
        </div>
      ) : (
        /* Grouped by meal */
        <div className="space-y-3">
          {meals.map((meal) => {
            const mealExpanded = expandedMeals.has(meal.id);
            const mealOverrideCount = meal.categories.reduce(
              (sum, cat) =>
                sum + cat.items.filter((item) => localOverrides[item.id] !== undefined).length,
              0
            );

            return (
              <div
                key={meal.id}
                className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden"
              >
                <button
                  onClick={() => toggleMeal(meal.id)}
                  className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#f8fdf9] transition-colors cursor-pointer"
                >
                  <div className="flex items-center gap-2.5">
                    {mealExpanded ? (
                      <ChevronDown className="w-4 h-4 text-[#95d5b2]" />
                    ) : (
                      <ChevronRight className="w-4 h-4 text-[#95d5b2]" />
                    )}
                    <span className="text-lg">{meal.icon}</span>
                    <span className="font-medium text-[#1b4332]">{meal.name}</span>
                    {mealOverrideCount > 0 && (
                      <span className="text-xs bg-[#6c63ff]/10 text-[#6c63ff] rounded-full px-2 py-0.5">
                        {mealOverrideCount}
                      </span>
                    )}
                  </div>
                  <span className="text-xs text-[#bbb]">
                    {meal.categories.reduce((s, c) => s + c.items.length, 0)} alimenti
                  </span>
                </button>

                {mealExpanded && (
                  <div className="border-t border-[#e8f5e9]">
                    {meal.categories.map((cat) => {
                      const catKey = `${meal.id}:${cat.id}`;
                      const catExpanded = expandedCats.has(catKey);
                      const catOverrideCount = cat.items.filter(
                        (item) => localOverrides[item.id] !== undefined
                      ).length;

                      // Check if this category has sub-groups
                      const hasSubGroups = cat.items.some((item) => item.subGroup);

                      return (
                        <div key={cat.id}>
                          <button
                            onClick={() => toggleCat(catKey)}
                            className="w-full flex items-center justify-between px-7 py-2.5 hover:bg-[#fafcfa] transition-colors cursor-pointer"
                          >
                            <div className="flex items-center gap-2">
                              {catExpanded ? (
                                <ChevronDown className="w-3.5 h-3.5 text-[#ccc]" />
                              ) : (
                                <ChevronRight className="w-3.5 h-3.5 text-[#ccc]" />
                              )}
                              <span>{cat.icon}</span>
                              <span className="text-sm text-[#555]">{cat.name}</span>
                              {catOverrideCount > 0 && (
                                <span className="w-4 h-4 bg-[#6c63ff] text-white text-[10px] rounded-full flex items-center justify-center">
                                  {catOverrideCount}
                                </span>
                              )}
                            </div>
                            <span className="text-xs text-[#ccc]">{cat.items.length}</span>
                          </button>

                          {catExpanded && (
                            <div className="divide-y divide-[#f5f5f5]">
                              {hasSubGroups ? (
                                (() => {
                                  const groupOrder: string[] = [];
                                  const groups: Record<string, { icon?: string; items: typeof cat.items }> = {};
                                  cat.items.forEach((item) => {
                                    const key = item.subGroup || "__none__";
                                    if (!groups[key]) {
                                      groups[key] = { icon: item.subGroupIcon, items: [] };
                                      groupOrder.push(key);
                                    }
                                    groups[key].items.push(item);
                                  });
                                  return groupOrder.map((groupKey) => {
                                    const group = groups[groupKey];
                                    return (
                                      <div key={groupKey}>
                                        {groupKey !== "__none__" && (
                                          <div className="flex items-center gap-2 px-10 py-2 bg-[#f8fdf9] border-b border-[#e8f5e9]">
                                            {group.icon && <span className="text-sm">{group.icon}</span>}
                                            <span className="text-xs font-medium text-[#52b788]">{groupKey}</span>
                                          </div>
                                        )}
                                        {group.items.map((item) => (
                                          <FoodRow
                                            key={item.id}
                                            foodId={item.id}
                                            foodName={item.name}
                                            defaultWeight={item.baseWeight}
                                            customWeight={localOverrides[item.id]}
                                            onWeightChange={handleWeightChange}
                                            onReset={handleReset}
                                            indent
                                          />
                                        ))}
                                      </div>
                                    );
                                  });
                                })()
                              ) : (
                                cat.items.map((item) => (
                                  <FoodRow
                                    key={item.id}
                                    foodId={item.id}
                                    foodName={item.name}
                                    defaultWeight={item.baseWeight}
                                    customWeight={localOverrides[item.id]}
                                    onWeightChange={handleWeightChange}
                                    onReset={handleReset}
                                    indent
                                  />
                                ))
                              )}
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Single food row ───

interface FoodRowProps {
  foodId: string;
  foodName: string;
  defaultWeight: number;
  customWeight?: number;
  mealName?: string;
  catName?: string;
  onWeightChange: (foodId: string, value: string) => void;
  onReset: (foodId: string) => void;
  indent?: boolean;
}

function FoodRow({
  foodId,
  foodName,
  defaultWeight,
  customWeight,
  mealName,
  catName,
  onWeightChange,
  onReset,
  indent = false,
}: FoodRowProps) {
  const isOverridden = customWeight !== undefined;
  const displayWeight = isOverridden ? customWeight : defaultWeight;

  return (
    <div
      className={`flex items-center gap-3 py-2.5 pr-5 hover:bg-[#fafcfa] transition-colors ${
        indent ? "pl-14" : "px-5"
      }`}
    >
      <div className="flex-1 min-w-0">
        <span className={`text-sm block truncate ${isOverridden ? "text-[#1b4332] font-medium" : "text-[#555]"}`}>
          {foodName}
        </span>
        {(mealName || catName) && (
          <span className="text-[10px] text-[#bbb]">
            {mealName} &gt; {catName}
          </span>
        )}
      </div>

      <div className="flex items-center gap-2 flex-shrink-0">
        {/* Default weight label */}
        <span className={`text-xs ${isOverridden ? "line-through text-[#ccc]" : "text-[#999]"}`}>
          {defaultWeight}g
        </span>

        {/* Input */}
        <div className="relative">
          <input
            type="number"
            min={0}
            step={1}
            value={isOverridden ? customWeight : ""}
            onChange={(e) => onWeightChange(foodId, e.target.value)}
            placeholder={`${defaultWeight}`}
            className={`w-20 text-right text-sm rounded-lg border px-2 py-1.5 ${
              isOverridden
                ? "bg-[#6c63ff]/5 border-[#6c63ff]/30 text-[#6c63ff] font-medium focus:border-[#6c63ff]"
                : "bg-[#fafafa] border-[#e0e0e0] text-[#999] placeholder:text-[#ccc] focus:border-[#52b788]"
            } focus:outline-none transition-all`}
          />
          <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] text-[#bbb] pointer-events-none">
            g
          </span>
        </div>

        {/* Reset button */}
        {isOverridden && (
          <button
            onClick={() => onReset(foodId)}
            className="p-1 text-[#ccc] hover:text-[#999] transition-colors cursor-pointer"
            title="Ripristina valore predefinito"
          >
            <RotateCcw className="w-3.5 h-3.5" />
          </button>
        )}
        {isOverridden && (
          <CheckCircle2 className="w-3.5 h-3.5 text-[#6c63ff] flex-shrink-0" />
        )}
      </div>
    </div>
  );
}