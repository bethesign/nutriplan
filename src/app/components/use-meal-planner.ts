import { useState, useCallback, useEffect, useRef } from "react";
import type { Meal, MealSelection, SelectedFood, CategorySelection } from "./types";
import type { FoodOverrides } from "./food-overrides-page";

// Helper: get effective base weight considering overrides
function getEffectiveWeight(foodId: string, defaultWeight: number, overrides: FoodOverrides): number {
  return overrides[foodId] !== undefined ? overrides[foodId] : defaultWeight;
}

export function useMealPlanner(meals: Meal[], overrides: FoodOverrides = {}) {
  const [selections, setSelections] = useState<MealSelection[]>([]);
  const prevMealsRef = useRef<string>("");

  // Re-initialize selections when meals change
  useEffect(() => {
    const mealsKey = meals.map((m) => m.id).join(",");
    if (mealsKey !== prevMealsRef.current) {
      prevMealsRef.current = mealsKey;
      setSelections(
        meals.map((meal) => ({
          mealId: meal.id,
          mealName: meal.name,
          categories: [],
        }))
      );
    }
  }, [meals]);

  const toggleFood = useCallback(
    (mealId: string, categoryId: string, categoryName: string, foodId: string, foodName: string, baseWeight: number, note?: string) => {
      const effectiveWeight = getEffectiveWeight(foodId, baseWeight, overrides);
      setSelections((prev) =>
        prev.map((mealSel) => {
          if (mealSel.mealId !== mealId) return mealSel;

          const existingCat = mealSel.categories.find((c) => c.categoryId === categoryId);

          if (existingCat) {
            const existingFood = existingCat.foods.find((f) => f.foodId === foodId);

            if (existingFood) {
              // Remove food
              const newFoods = existingCat.foods.filter((f) => f.foodId !== foodId);
              if (newFoods.length === 0) {
                return {
                  ...mealSel,
                  categories: mealSel.categories.filter((c) => c.categoryId !== categoryId),
                };
              }
              // Redistribute percentages equally
              const equalPct = 100 / newFoods.length;
              const redistributed = newFoods.map((f) => {
                const w = getEffectiveWeight(f.foodId, f.baseWeight, overrides);
                return {
                  ...f,
                  baseWeight: w,
                  percentage: equalPct,
                  adjustedWeight: Math.round(w * equalPct / 100),
                };
              });
              return {
                ...mealSel,
                categories: mealSel.categories.map((c) =>
                  c.categoryId === categoryId ? { ...c, foods: redistributed } : c
                ),
              };
            } else {
              // Add food
              const newCount = existingCat.foods.length + 1;
              const equalPct = 100 / newCount;
              const newFood: SelectedFood = {
                foodId,
                name: foodName,
                baseWeight: effectiveWeight,
                percentage: equalPct,
                adjustedWeight: Math.round(effectiveWeight * equalPct / 100),
                note,
              };
              const updatedFoods = [
                ...existingCat.foods.map((f) => {
                  const w = getEffectiveWeight(f.foodId, f.baseWeight, overrides);
                  return {
                    ...f,
                    baseWeight: w,
                    percentage: equalPct,
                    adjustedWeight: Math.round(w * equalPct / 100),
                  };
                }),
                newFood,
              ];
              return {
                ...mealSel,
                categories: mealSel.categories.map((c) =>
                  c.categoryId === categoryId ? { ...c, foods: updatedFoods } : c
                ),
              };
            }
          } else {
            // New category
            const newCatSel: CategorySelection = {
              categoryId,
              categoryName,
              foods: [
                {
                  foodId,
                  name: foodName,
                  baseWeight: effectiveWeight,
                  percentage: 100,
                  adjustedWeight: effectiveWeight,
                  note,
                },
              ],
            };
            return {
              ...mealSel,
              categories: [...mealSel.categories, newCatSel],
            };
          }
        })
      );
    },
    [overrides]
  );

  const updatePercentage = useCallback(
    (mealId: string, categoryId: string, foodId: string, newPercentage: number) => {
      setSelections((prev) =>
        prev.map((mealSel) => {
          if (mealSel.mealId !== mealId) return mealSel;

          return {
            ...mealSel,
            categories: mealSel.categories.map((cat) => {
              if (cat.categoryId !== categoryId) return cat;
              if (cat.foods.length <= 1) return cat;

              const clamped = Math.min(100, Math.max(0, newPercentage));
              const otherFoods = cat.foods.filter((f) => f.foodId !== foodId);
              const otherTotal = otherFoods.reduce((s, f) => s + f.percentage, 0);
              const remaining = 100 - clamped;

              const updatedFoods = cat.foods.map((f) => {
                if (f.foodId === foodId) {
                  return {
                    ...f,
                    percentage: clamped,
                    adjustedWeight: Math.round(f.baseWeight * clamped / 100),
                  };
                }
                // Distribute remaining proportionally
                const ratio = otherTotal > 0 ? f.percentage / otherTotal : 1 / otherFoods.length;
                const newPct = remaining * ratio;
                return {
                  ...f,
                  percentage: newPct,
                  adjustedWeight: Math.round(f.baseWeight * newPct / 100),
                };
              });

              return { ...cat, foods: updatedFoods };
            }),
          };
        })
      );
    },
    []
  );

  const isFoodSelected = useCallback(
    (mealId: string, foodId: string) => {
      const mealSel = selections.find((m) => m.mealId === mealId);
      if (!mealSel) return false;
      return mealSel.categories.some((c) => c.foods.some((f) => f.foodId === foodId));
    },
    [selections]
  );

  const getMealSelection = useCallback(
    (mealId: string) => {
      return selections.find((m) => m.mealId === mealId);
    },
    [selections]
  );

  const clearMeal = useCallback((mealId: string) => {
    setSelections((prev) =>
      prev.map((m) => (m.mealId === mealId ? { ...m, categories: [] } : m))
    );
  }, []);

  const clearAll = useCallback(() => {
    setSelections((prev) => prev.map((m) => ({ ...m, categories: [] })));
  }, []);

  const copyMealPlan = useCallback(() => {
    const lines: string[] = ["PIANO ALIMENTARE GIORNALIERO", "═".repeat(40), ""];

    selections.forEach((mealSel) => {
      if (mealSel.categories.length === 0) return;
      lines.push(`▸ ${mealSel.mealName.toUpperCase()}`);
      lines.push("─".repeat(30));

      mealSel.categories.forEach((cat) => {
        lines.push(`  ${cat.categoryName}:`);
        cat.foods.forEach((f) => {
          const noteStr = f.note ? ` (${f.note})` : "";
          lines.push(`    • ${f.name}: ${f.adjustedWeight} g${noteStr}`);
        });
      });
      lines.push("");
    });

    return lines.join("\n");
  }, [selections]);

  const copyPrompt = useCallback(() => {
    const mealParts: string[] = [];

    selections.forEach((mealSel) => {
      if (mealSel.categories.length === 0) return;
      const ingredients: string[] = [];
      mealSel.categories.forEach((cat) => {
        cat.foods.forEach((f) => {
          ingredients.push(`${f.name} (${f.adjustedWeight}g)`);
        });
      });
      mealParts.push(`${mealSel.mealName}: ${ingredients.join(", ")}`);
    });

    const prompt = `Sei un nutrizionista e chef esperto. Ho bisogno che tu crei delle ricette sane, gustose e bilanciate per il mio piano alimentare giornaliero, utilizzando ESCLUSIVAMENTE gli ingredienti e le quantità indicate di seguito. Per ogni pasto, proponi una ricetta completa con: nome della ricetta, lista ingredienti con dosi, procedimento passo-passo, tempo di preparazione e cottura. Cerca di variare le tecniche di cottura (al vapore, al forno, in padella, crudo) per mantenere il piano interessante e salutare.\n\nEcco il mio piano alimentare:\n\n${mealParts.join("\n\n")}\n\nPer ogni ricetta, suggerisci anche eventuali erbe aromatiche o spezie (senza calorie significative) che possano esaltare il sapore dei piatti. Fornisci le ricette in italiano.`;

    return prompt;
  }, [selections]);

  const hasSelections = selections.some((m) => m.categories.length > 0);

  // ─── Validation rules (now dynamic from meals data) ───
  // Helper: check whether a category has at least one food selected
  const catHasFood = (mealSel: typeof selections[number], catId: string) =>
    mealSel.categories.some((cs) => cs.categoryId === catId && cs.foods.length > 0);

  // Check if all active meals satisfy the validation rules
  const allMealsComplete = (() => {
    if (!hasSelections) return false;
    const activeMealSelections = selections.filter((m) => m.categories.length > 0);
    return activeMealSelections.every((mealSel) => {
      const mealDef = meals.find((m) => m.id === mealSel.mealId);
      if (!mealDef) return false;

      // Free meals are always valid
      if (mealDef.is_free) return true;

      // Every non-optional category must have at least one food selected
      return mealDef.categories
        .filter((cat) => !cat.is_optional)
        .every((cat) => catHasFood(mealSel, cat.id));
    });
  })();

  // Get incomplete categories per meal for feedback
  const getIncompleteMeals = useCallback(() => {
    const incomplete: { mealName: string; missingCategories: string[] }[] = [];
    selections.forEach((mealSel) => {
      if (mealSel.categories.length === 0) return;

      const mealDef = meals.find((m) => m.id === mealSel.mealId);
      if (!mealDef) return;

      // Free meals never report missing categories
      if (mealDef.is_free) return;

      const missing = mealDef.categories
        .filter((cat) => !cat.is_optional)
        .filter((cat) => !catHasFood(mealSel, cat.id))
        .map((cat) => cat.name);

      if (missing.length > 0) {
        incomplete.push({ mealName: mealSel.mealName, missingCategories: missing });
      }
    });
    return incomplete;
  }, [selections, meals]);

  return {
    selections,
    toggleFood,
    updatePercentage,
    isFoodSelected,
    getMealSelection,
    clearMeal,
    clearAll,
    copyMealPlan,
    copyPrompt,
    hasSelections,
    allMealsComplete,
    getIncompleteMeals,
  };
}
