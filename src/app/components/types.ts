export interface FoodItem {
  id: string;
  food_id?: string; // UUID from foods table (for admin operations)
  name: string;
  baseWeight: number;
  note?: string; // e.g., "(1/7)"
  subGroup?: string; // visual grouping within a category, e.g. "Proteine Animali"
  subGroupIcon?: string; // icon for the sub-group, e.g. "🐟"
}

export interface Category {
  id: string;
  name: string;
  icon: string;
  is_optional?: boolean;
  items: FoodItem[];
}

export interface Meal {
  id: string;
  name: string;
  icon: string;
  is_free?: boolean;
  categories: Category[];
}

export interface SelectedFood {
  foodId: string;
  name: string;
  baseWeight: number;
  percentage: number;
  adjustedWeight: number;
  note?: string;
}

export interface CategorySelection {
  categoryId: string;
  categoryName: string;
  foods: SelectedFood[];
}

export interface MealSelection {
  mealId: string;
  mealName: string;
  categories: CategorySelection[];
}