import { useState, useEffect, useCallback } from "react";
import {
  ShoppingCart, Leaf, RotateCcw, LogOut, Loader2,
  UtensilsCrossed, User, Settings2, Shield, AlertCircle,
} from "lucide-react";
import { Toaster } from "sonner";
import { useMealsData } from "./components/use-meals-data";
import { useMealPlanner } from "./components/use-meal-planner";
import { FoodGrid } from "./components/food-grid";
import { CartSidebar } from "./components/cart-sidebar";
import { AuthProvider, useAuth } from "./components/auth-provider";
import { LoginScreen } from "./components/login-screen";
import { ProfilePage } from "./components/profile-page";
import { FoodOverridesPage, type FoodOverrides } from "./components/food-overrides-page";
import { AdminPanel } from "./components/admin-panel";
import { apiFetch } from "./components/supabase-client";

type AppView = "planner" | "profile" | "overrides" | "admin";

function MealPlannerApp() {
  const [activeView, setActiveView] = useState<AppView>("planner");
  const [mobileCartOpen, setMobileCartOpen] = useState(false);
  const [foodOverrides, setFoodOverrides] = useState<FoodOverrides>({});
  const [loadingOverrides, setLoadingOverrides] = useState(true);
  const [userRole, setUserRole] = useState<string>("user");
  const { user, signOut } = useAuth();

  // Load meals from database
  const { meals, loading: mealsLoading, error: mealsError, reload: reloadMeals } = useMealsData();
  const [activeMealId, setActiveMealId] = useState<string>("");

  // Set first meal as active when meals load
  useEffect(() => {
    if (meals.length > 0 && !activeMealId) {
      setActiveMealId(meals[0].id);
    }
  }, [meals, activeMealId]);

  // Load user profile to check role
  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/profile");
        if (res.ok) {
          const data = await res.json();
          if (data.profile?.role) {
            setUserRole(data.profile.role);
          }
        }
      } catch (err) {
        console.error("Error loading profile role:", err);
      }
    })();
  }, []);

  // Load food overrides on mount
  const loadOverrides = useCallback(async () => {
    try {
      const res = await apiFetch("/food-overrides");
      if (res.ok) {
        const data = await res.json();
        if (data.overrides) {
          setFoodOverrides(data.overrides);
        }
      } else {
        console.warn("loadOverrides: non-ok response", res.status);
        if (res.status === 401) {
          await new Promise((r) => setTimeout(r, 1500));
          const retryRes = await apiFetch("/food-overrides");
          if (retryRes.ok) {
            const data = await retryRes.json();
            if (data.overrides) {
              setFoodOverrides(data.overrides);
            }
          }
        }
      }
    } catch (err) {
      console.error("Error loading food overrides:", err);
    } finally {
      setLoadingOverrides(false);
    }
  }, []);

  useEffect(() => {
    loadOverrides();
  }, [loadOverrides]);

  const {
    selections,
    toggleFood,
    updatePercentage,
    isFoodSelected,
    clearMeal,
    clearAll,
    copyMealPlan,
    copyPrompt,
    hasSelections,
    allMealsComplete,
    getIncompleteMeals,
  } = useMealPlanner(meals, foodOverrides);

  const activeMeal = meals.find((m) => m.id === activeMealId);
  const cartItemCount = selections.reduce(
    (total, m) => total + m.categories.reduce((s, c) => s + c.foods.length, 0),
    0
  );

  const displayName =
    user?.user_metadata?.name || user?.email?.split("@")[0] || "Utente";

  const isAdmin = userRole === "admin";

  const navItems: { id: AppView; label: string; icon: React.ReactNode; mobileLabel: string; adminOnly?: boolean }[] = [
    {
      id: "planner",
      label: "Piano Pasti",
      mobileLabel: "Pasti",
      icon: <UtensilsCrossed className="w-4 h-4" />,
    },
    {
      id: "overrides",
      label: "Gestione Alimenti",
      mobileLabel: "Alimenti",
      icon: <Settings2 className="w-4 h-4" />,
    },
    {
      id: "profile",
      label: "Profilo",
      mobileLabel: "Profilo",
      icon: <User className="w-4 h-4" />,
    },
    ...(isAdmin
      ? [
          {
            id: "admin" as AppView,
            label: "Admin",
            mobileLabel: "Admin",
            icon: <Shield className="w-4 h-4" />,
          },
        ]
      : []),
  ];

  // Show loading while meals are being fetched
  if (mealsLoading) {
    return (
      <div className="size-full flex items-center justify-center bg-[#f5faf7]">
        <div className="flex flex-col items-center gap-3">
          <Loader2 className="w-6 h-6 text-[#52b788] animate-spin" />
          <p className="text-sm text-[#95d5b2]">Caricamento piano pasti...</p>
        </div>
      </div>
    );
  }

  if (mealsError) {
    return (
      <div className="size-full flex items-center justify-center bg-[#f5faf7]">
        <div className="flex flex-col items-center gap-3 text-center px-6">
          <AlertCircle className="w-8 h-8 text-red-400" />
          <p className="text-sm text-red-500">{mealsError}</p>
          <button
            onClick={reloadMeals}
            className="px-4 py-2 bg-[#40916c] text-white rounded-xl text-sm hover:bg-[#2d6a4f] transition-colors cursor-pointer"
          >
            Riprova
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="size-full flex flex-col bg-[#f5faf7]">
      <Toaster position="top-center" richColors />

      {/* Top Header */}
      <header className="flex-shrink-0 bg-white border-b border-[#e0e0e0] px-4 lg:px-6 py-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 bg-gradient-to-br from-[#52b788] to-[#2d6a4f] rounded-xl flex items-center justify-center shadow-sm">
              <Leaf className="w-5 h-5 text-white" />
            </div>
            <div>
              <h1 className="text-[#1b4332] leading-tight">NutriPlan</h1>
              <p className="text-xs text-[#95d5b2] hidden sm:block">Il tuo piano alimentare giornaliero</p>
            </div>
          </div>

          {/* Main navigation - desktop */}
          <nav className="hidden md:flex items-center gap-1 bg-[#f5faf7] rounded-xl p-1">
            {navItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`
                  flex items-center gap-2 px-4 py-2 rounded-lg text-sm transition-all cursor-pointer
                  ${
                    activeView === item.id
                      ? "bg-white text-[#1b4332] shadow-sm font-medium"
                      : "text-[#888] hover:text-[#555]"
                  }
                `}
              >
                {item.icon}
                {item.label}
              </button>
            ))}
          </nav>

          <div className="flex items-center gap-2">
            {/* User badge */}
            <div className="hidden sm:flex items-center gap-2 mr-1">
              <div className="w-7 h-7 rounded-full bg-[#d8f3dc] flex items-center justify-center text-xs font-medium text-[#2d6a4f]">
                {displayName.charAt(0).toUpperCase()}
              </div>
              <span className="text-sm text-[#555] max-w-[100px] truncate">{displayName}</span>
              {isAdmin && (
                <span className="text-[10px] bg-amber-100 text-amber-700 px-1.5 py-0.5 rounded-full font-medium">
                  Admin
                </span>
              )}
            </div>

            {activeView === "planner" && hasSelections && (
              <button
                onClick={clearAll}
                className="hidden sm:flex items-center gap-1.5 text-sm text-[#999] hover:text-[#d00] px-3 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                Reset
              </button>
            )}

            <button
              onClick={signOut}
              className="flex items-center gap-1.5 text-sm text-[#999] hover:text-[#d00] px-2 py-1.5 rounded-lg hover:bg-red-50 transition-colors cursor-pointer"
              title="Esci"
            >
              <LogOut className="w-4 h-4" />
              <span className="hidden sm:inline">Esci</span>
            </button>

            {activeView === "planner" && (
              <button
                onClick={() => setMobileCartOpen(true)}
                className="lg:hidden relative p-2 rounded-xl bg-[#d8f3dc] text-[#40916c] hover:bg-[#b7e4c7] transition-colors cursor-pointer"
              >
                <ShoppingCart className="w-5 h-5" />
                {cartItemCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-5 h-5 bg-[#40916c] text-white text-xs rounded-full flex items-center justify-center">
                    {cartItemCount}
                  </span>
                )}
              </button>
            )}
          </div>
        </div>
      </header>

      {/* Main Content */}
      <div className="flex-1 flex overflow-hidden">
        {activeView === "planner" && activeMeal && (
          <>
            {/* Left panel */}
            <div className="flex-1 flex flex-col overflow-hidden">
              {/* Meal Tabs */}
              <nav className="flex-shrink-0 bg-white border-b border-[#e8e8e8] px-2 lg:px-4">
                <div className="flex gap-1 overflow-x-auto py-2 scrollbar-hide">
                  {meals.map((meal) => {
                    const isActive = meal.id === activeMealId;
                    const mealSel = selections.find((m) => m.mealId === meal.id);
                    const count = mealSel
                      ? mealSel.categories.reduce((s, c) => s + c.foods.length, 0)
                      : 0;

                    return (
                      <button
                        key={meal.id}
                        onClick={() => setActiveMealId(meal.id)}
                        className={`
                          flex items-center gap-2 px-3 lg:px-4 py-2 rounded-xl whitespace-nowrap transition-all duration-200 cursor-pointer
                          ${
                            isActive
                              ? "bg-[#d8f3dc] text-[#1b4332] shadow-sm"
                              : "text-[#888] hover:text-[#555] hover:bg-[#f5f5f5]"
                          }
                        `}
                      >
                        <span>{meal.icon}</span>
                        <span className="text-sm">{meal.name}</span>
                        {count > 0 && (
                          <span
                            className={`text-xs rounded-full px-1.5 py-0.5 ${
                              isActive
                                ? "bg-[#40916c] text-white"
                                : "bg-[#e8e8e8] text-[#888]"
                            }`}
                          >
                            {count}
                          </span>
                        )}
                      </button>
                    );
                  })}
                </div>
              </nav>

              {/* Food Grid */}
              <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-5">
                <div className="mb-4">
                  <h2 className="text-[#1b4332]">
                    {activeMeal.icon} {activeMeal.name}
                  </h2>
                  <p className="text-sm text-[#95d5b2] mt-0.5">
                    Seleziona gli alimenti per comporre il tuo pasto
                  </p>
                </div>
                <FoodGrid
                  mealId={activeMealId}
                  categories={activeMeal.categories}
                  isFoodSelected={isFoodSelected}
                  onToggle={toggleFood}
                  overrides={foodOverrides}
                />
              </div>
            </div>

            {/* Right Cart Sidebar */}
            <CartSidebar
              selections={selections}
              hasSelections={hasSelections}
              allMealsComplete={allMealsComplete}
              getIncompleteMeals={getIncompleteMeals}
              onUpdatePercentage={updatePercentage}
              onClearMeal={clearMeal}
              onClearAll={clearAll}
              copyMealPlan={copyMealPlan}
              copyPrompt={copyPrompt}
              onToggleFood={toggleFood}
              mobileOpen={mobileCartOpen}
              onMobileClose={() => setMobileCartOpen(false)}
            />
          </>
        )}

        {activeView === "profile" && (
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6">
            <ProfilePage />
          </div>
        )}

        {activeView === "overrides" && (
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6">
            <FoodOverridesPage
              meals={meals}
              overrides={foodOverrides}
              onOverridesChange={setFoodOverrides}
            />
          </div>
        )}

        {activeView === "admin" && isAdmin && (
          <div className="flex-1 overflow-y-auto px-4 lg:px-6 py-6">
            <AdminPanel onMealsChanged={reloadMeals} />
          </div>
        )}
      </div>

      {/* Mobile bottom navigation */}
      <nav className="md:hidden flex-shrink-0 bg-white border-t border-[#e0e0e0] flex">
        {navItems.map((item) => (
          <button
            key={item.id}
            onClick={() => setActiveView(item.id)}
            className={`
              flex-1 flex flex-col items-center gap-0.5 py-2.5 text-xs transition-colors cursor-pointer
              ${
                activeView === item.id
                  ? "text-[#40916c] font-medium"
                  : "text-[#999]"
              }
            `}
          >
            {item.icon}
            {item.mobileLabel}
          </button>
        ))}
      </nav>
    </div>
  );
}

function AuthGate() {
  const { user, loading } = useAuth();

  if (loading) {
    return (
      <div className="size-full flex items-center justify-center bg-[#f5faf7]">
        <div className="flex flex-col items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-[#52b788] to-[#2d6a4f] rounded-2xl flex items-center justify-center shadow-lg">
            <Leaf className="w-6 h-6 text-white" />
          </div>
          <Loader2 className="w-5 h-5 text-[#52b788] animate-spin" />
        </div>
      </div>
    );
  }

  if (!user) {
    return <LoginScreen />;
  }

  return <MealPlannerApp />;
}

export default function App() {
  return (
    <AuthProvider>
      <AuthGate />
    </AuthProvider>
  );
}
