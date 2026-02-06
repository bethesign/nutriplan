import { useState } from "react";
import { Copy, Sparkles, Trash2, ChevronDown, ChevronUp, ShoppingCart, X, AlertCircle } from "lucide-react";
import type { MealSelection } from "./types";
import { toast } from "sonner";

interface CartSidebarProps {
  selections: MealSelection[];
  hasSelections: boolean;
  allMealsComplete: boolean;
  getIncompleteMeals: () => { mealName: string; missingCategories: string[] }[];
  onUpdatePercentage: (mealId: string, categoryId: string, foodId: string, newPercentage: number) => void;
  onClearMeal: (mealId: string) => void;
  onClearAll: () => void;
  copyMealPlan: () => string;
  copyPrompt: () => string;
  onToggleFood: (
    mealId: string,
    categoryId: string,
    categoryName: string,
    foodId: string,
    foodName: string,
    baseWeight: number,
    note?: string
  ) => void;
  mobileOpen: boolean;
  onMobileClose: () => void;
}

export function CartSidebar({
  selections,
  hasSelections,
  allMealsComplete,
  getIncompleteMeals,
  onUpdatePercentage,
  onClearMeal,
  onClearAll,
  copyMealPlan,
  copyPrompt,
  onToggleFood,
  mobileOpen,
  onMobileClose,
}: CartSidebarProps) {
  const [collapsedMeals, setCollapsedMeals] = useState<Set<string>>(new Set());

  const toggleCollapse = (mealId: string) => {
    setCollapsedMeals((prev) => {
      const next = new Set(prev);
      if (next.has(mealId)) next.delete(mealId);
      else next.add(mealId);
      return next;
    });
  };

  const fallbackCopy = (text: string) => {
    const textarea = document.createElement("textarea");
    textarea.value = text;
    textarea.style.position = "fixed";
    textarea.style.opacity = "0";
    document.body.appendChild(textarea);
    textarea.select();
    try {
      document.execCommand("copy");
      return true;
    } catch {
      return false;
    } finally {
      document.body.removeChild(textarea);
    }
  };

  const copyToClipboard = async (text: string, successMsg: string) => {
    try {
      await navigator.clipboard.writeText(text);
      toast.success(successMsg);
    } catch {
      if (fallbackCopy(text)) {
        toast.success(successMsg);
      } else {
        toast.error("Impossibile copiare negli appunti.");
      }
    }
  };

  const handleCopyMeals = () => {
    const text = copyMealPlan();
    copyToClipboard(text, "Piano alimentare copiato negli appunti!");
  };

  const handleCopyPrompt = () => {
    const text = copyPrompt();
    copyToClipboard(text, "Prompt AI copiato negli appunti!");
  };

  const handlePercentageChange = (
    mealId: string,
    categoryId: string,
    foodId: string,
    value: string
  ) => {
    const num = parseFloat(value);
    if (!isNaN(num)) {
      onUpdatePercentage(mealId, categoryId, foodId, num);
    }
  };

  const activeMeals = selections.filter((m) => m.categories.length > 0);

  const sidebarContent = (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-4 border-b border-[#e0e0e0]">
        <div className="flex items-center gap-2">
          <ShoppingCart className="w-5 h-5 text-[#40916c]" />
          <h2 className="text-[#1b4332]">Il tuo piano</h2>
        </div>
        <div className="flex items-center gap-2">
          {hasSelections && (
            <button
              onClick={onClearAll}
              className="text-xs text-[#d00] hover:text-red-700 px-2 py-1 rounded-md hover:bg-red-50 transition-colors cursor-pointer"
            >
              Svuota tutto
            </button>
          )}
          <button
            onClick={onMobileClose}
            className="lg:hidden p-1 rounded-md hover:bg-[#f0f0f0] transition-colors cursor-pointer"
          >
            <X className="w-5 h-5 text-[#666]" />
          </button>
        </div>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto px-4 py-3">
        {!hasSelections ? (
          <div className="flex flex-col items-center justify-center h-full text-center py-12 opacity-60">
            <ShoppingCart className="w-10 h-10 text-[#95d5b2] mb-3" />
            <p className="text-[#888] text-sm">Seleziona gli alimenti dal menu per comporre il tuo piano</p>
          </div>
        ) : (
          <div className="space-y-4">
            {activeMeals.map((mealSel) => {
              const collapsed = collapsedMeals.has(mealSel.mealId);
              const totalItems = mealSel.categories.reduce((s, c) => s + c.foods.length, 0);

              return (
                <div key={mealSel.mealId} className="bg-[#f8fdf9] rounded-xl border border-[#d8f3dc] overflow-hidden">
                  <div
                    className="flex items-center justify-between px-3 py-2.5 cursor-pointer hover:bg-[#eef8f0] transition-colors"
                    onClick={() => toggleCollapse(mealSel.mealId)}
                  >
                    <div className="flex items-center gap-2">
                      <span className="text-[#2d6a4f]">{mealSel.mealName}</span>
                      <span className="text-xs bg-[#40916c] text-white rounded-full px-2 py-0.5">
                        {totalItems}
                      </span>
                    </div>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          onClearMeal(mealSel.mealId);
                        }}
                        className="p-1 text-[#ccc] hover:text-red-500 transition-colors cursor-pointer"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                      {collapsed ? (
                        <ChevronDown className="w-4 h-4 text-[#95d5b2]" />
                      ) : (
                        <ChevronUp className="w-4 h-4 text-[#95d5b2]" />
                      )}
                    </div>
                  </div>

                  {!collapsed && (
                    <div className="px-3 pb-3 space-y-3">
                      {mealSel.categories.map((cat) => (
                        <div key={cat.categoryId}>
                          <div className="text-xs text-[#52b788] mb-1.5 uppercase tracking-wide">
                            {cat.categoryName}
                          </div>
                          <div className="space-y-1.5">
                            {cat.foods.map((food) => {
                              const singleItem = cat.foods.length === 1;
                              return (
                                <div
                                  key={food.foodId}
                                  className="flex items-center gap-2 bg-white rounded-lg px-2.5 py-2 border border-[#e8f5e9]"
                                >
                                  <button
                                    onClick={() =>
                                      onToggleFood(
                                        mealSel.mealId,
                                        cat.categoryId,
                                        cat.categoryName,
                                        food.foodId,
                                        food.name,
                                        food.baseWeight,
                                        food.note
                                      )
                                    }
                                    className="flex-shrink-0 text-[#ccc] hover:text-red-400 transition-colors cursor-pointer"
                                  >
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                  <div className="flex-1 min-w-0">
                                    <span className="text-sm text-[#333] block truncate">{food.name}</span>
                                    <span className="text-xs text-[#40916c]">
                                      {food.adjustedWeight}g
                                      {food.note && <span className="ml-1 opacity-60">({food.note})</span>}
                                    </span>
                                  </div>
                                  <div className="flex items-center gap-1 flex-shrink-0">
                                    <input
                                      type="number"
                                      min={0}
                                      max={100}
                                      value={Math.round(food.percentage)}
                                      disabled={singleItem}
                                      onChange={(e) =>
                                        handlePercentageChange(
                                          mealSel.mealId,
                                          cat.categoryId,
                                          food.foodId,
                                          e.target.value
                                        )
                                      }
                                      className={`w-12 text-right text-sm rounded-md border px-1.5 py-0.5 ${
                                        singleItem
                                          ? "bg-[#f0f0f0] text-[#999] border-[#e0e0e0] cursor-not-allowed"
                                          : "bg-white text-[#333] border-[#ccc] focus:border-[#52b788] focus:outline-none"
                                      }`}
                                    />
                                    <span className="text-xs text-[#999]">%</span>
                                  </div>
                                </div>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Action Buttons */}
      {hasSelections && (() => {
        const incomplete = getIncompleteMeals();
        const isDisabled = !allMealsComplete;
        return (
          <div className="px-4 py-4 border-t border-[#e0e0e0] space-y-2">
            {isDisabled && incomplete.length > 0 && (
              <div className="flex items-start gap-2 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2 mb-1">
                <AlertCircle className="w-4 h-4 text-amber-500 flex-shrink-0 mt-0.5" />
                <div className="text-xs text-amber-700">
                  <span className="block mb-1">Completa le categorie obbligatorie:</span>
                  {incomplete.map((m) => (
                    <div key={m.mealName} className="ml-1">
                      <span className="font-medium">{m.mealName}:</span>{" "}
                      {m.missingCategories.join(", ")}
                    </div>
                  ))}
                </div>
              </div>
            )}
            <button
              onClick={handleCopyMeals}
              disabled={isDisabled}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-colors ${
                isDisabled
                  ? "bg-[#c5d8ce] text-white/70 cursor-not-allowed"
                  : "bg-[#40916c] hover:bg-[#2d6a4f] text-white cursor-pointer"
              }`}
            >
              <Copy className="w-4 h-4" />
              Copia Pasti
            </button>
            <button
              onClick={handleCopyPrompt}
              disabled={isDisabled}
              className={`w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl transition-colors ${
                isDisabled
                  ? "bg-[#c5c3e6] text-white/70 cursor-not-allowed"
                  : "bg-gradient-to-r from-[#6c63ff] to-[#a855f7] hover:from-[#5b54e6] hover:to-[#9333ea] text-white cursor-pointer"
              }`}
            >
              <Sparkles className="w-4 h-4" />
              Copia Prompt
            </button>
          </div>
        );
      })()}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar */}
      <aside className="hidden lg:flex w-[380px] flex-shrink-0 bg-white border-l border-[#e8e8e8] flex-col h-full">
        {sidebarContent}
      </aside>

      {/* Mobile overlay */}
      {mobileOpen && (
        <div className="lg:hidden fixed inset-0 z-50 flex">
          <div className="absolute inset-0 bg-black/30" onClick={onMobileClose} />
          <div className="relative ml-auto w-[90%] max-w-[400px] bg-white h-full flex flex-col shadow-2xl">
            {sidebarContent}
          </div>
        </div>
      )}
    </>
  );
}