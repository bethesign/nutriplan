import { Check } from "lucide-react";
import type { Category, FoodItem } from "./types";
import type { FoodOverrides } from "./food-overrides-page";

interface FoodGridProps {
  mealId: string;
  categories: Category[];
  isFoodSelected: (mealId: string, foodId: string) => boolean;
  onToggle: (
    mealId: string,
    categoryId: string,
    categoryName: string,
    foodId: string,
    foodName: string,
    baseWeight: number,
    note?: string
  ) => void;
  overrides?: FoodOverrides;
}

function FoodItemButton({
  item,
  selected,
  hasOverride,
  displayWeight,
  onClick,
}: {
  item: FoodItem;
  selected: boolean;
  hasOverride: boolean;
  displayWeight: number;
  onClick: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={`
        group relative flex items-center gap-3 px-3 py-2.5 rounded-xl border transition-all duration-200 text-left cursor-pointer
        ${
          selected
            ? "bg-[#d8f3dc] border-[#52b788] shadow-sm"
            : "bg-white border-[#e8e8e8] hover:border-[#95d5b2] hover:bg-[#f0faf4]"
        }
      `}
    >
      <div
        className={`
          flex-shrink-0 w-5 h-5 rounded-md border-2 flex items-center justify-center transition-all duration-200
          ${selected ? "bg-[#40916c] border-[#40916c]" : "border-[#ccc] group-hover:border-[#95d5b2]"}
        `}
      >
        {selected && <Check className="w-3 h-3 text-white" strokeWidth={3} />}
      </div>
      <div className="flex-1 min-w-0">
        <span className={`block truncate ${selected ? "text-[#1b4332]" : "text-[#555]"}`}>
          {item.name}
        </span>
      </div>
      <span
        className={`flex-shrink-0 text-xs px-2 py-0.5 rounded-full ${
          hasOverride
            ? selected
              ? "bg-[#6c63ff]/20 text-[#6c63ff] font-medium"
              : "bg-[#6c63ff]/10 text-[#6c63ff] font-medium"
            : selected
            ? "bg-[#40916c]/15 text-[#2d6a4f]"
            : "bg-[#f5f5f5] text-[#999]"
        }`}
      >
        {displayWeight}g
        {hasOverride && <span className="ml-0.5">*</span>}
        {item.note && <span className="ml-1 opacity-70">({item.note})</span>}
      </span>
    </button>
  );
}

export function FoodGrid({ mealId, categories, isFoodSelected, onToggle, overrides = {} }: FoodGridProps) {
  return (
    <div className="space-y-6">
      {categories.map((category) => {
        // Check if items have sub-groups
        const hasSubGroups = category.items.some((item) => item.subGroup);

        if (hasSubGroups) {
          // Group items by subGroup, preserving order
          const groupOrder: string[] = [];
          const groups: Record<string, { icon?: string; items: typeof category.items }> = {};

          category.items.forEach((item) => {
            const key = item.subGroup || "__none__";
            if (!groups[key]) {
              groups[key] = { icon: item.subGroupIcon, items: [] };
              groupOrder.push(key);
            }
            groups[key].items.push(item);
          });

          return (
            <div key={category.id}>
              {/* Category header */}
              <div className="flex items-center gap-2 mb-4 px-1">
                <span className="text-lg">{category.icon}</span>
                <h3 className="text-[#2d6a4f]">{category.name}</h3>
              </div>

              {/* Sub-groups */}
              <div className="space-y-5 pl-1">
                {groupOrder.map((groupKey) => {
                  const group = groups[groupKey];
                  return (
                    <div key={groupKey}>
                      {/* Sub-group header */}
                      {groupKey !== "__none__" && (
                        <div className="flex items-center gap-2 mb-2.5 ml-1">
                          {group.icon && <span className="text-base">{group.icon}</span>}
                          <h4 className="text-sm text-[#52b788] font-medium">{groupKey}</h4>
                          <div className="flex-1 h-px bg-[#e8f5e9]" />
                        </div>
                      )}
                      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
                        {group.items.map((item) => {
                          const selected = isFoodSelected(mealId, item.id);
                          const hasOverride = overrides[item.id] !== undefined;
                          const displayWeight = hasOverride ? overrides[item.id] : item.baseWeight;

                          return (
                            <FoodItemButton
                              key={item.id}
                              item={item}
                              selected={selected}
                              hasOverride={hasOverride}
                              displayWeight={displayWeight}
                              onClick={() =>
                                onToggle(mealId, category.id, category.name, item.id, item.name, item.baseWeight, item.note)
                              }
                            />
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          );
        }

        // Standard category without sub-groups
        return (
          <div key={category.id}>
            <div className="flex items-center gap-2 mb-3 px-1">
              <span className="text-lg">{category.icon}</span>
              <h3 className="text-[#2d6a4f]">{category.name}</h3>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2">
              {category.items.map((item) => {
                const selected = isFoodSelected(mealId, item.id);
                const hasOverride = overrides[item.id] !== undefined;
                const displayWeight = hasOverride ? overrides[item.id] : item.baseWeight;

                return (
                  <FoodItemButton
                    key={item.id}
                    item={item}
                    selected={selected}
                    hasOverride={hasOverride}
                    displayWeight={displayWeight}
                    onClick={() =>
                      onToggle(mealId, category.id, category.name, item.id, item.name, item.baseWeight, item.note)
                    }
                  />
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}
