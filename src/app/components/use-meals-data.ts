import { useState, useEffect, useCallback } from "react";
import type { Meal } from "./types";
import { apiFetch } from "./supabase-client";

interface UseMealsDataResult {
  meals: Meal[];
  loading: boolean;
  error: string | null;
  reload: () => Promise<void>;
}

export function useMealsData(): UseMealsDataResult {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await apiFetch("/meals-structure");
      if (!res.ok) {
        // Retry once on 401
        if (res.status === 401) {
          await new Promise((r) => setTimeout(r, 1500));
          const retry = await apiFetch("/meals-structure");
          if (retry.ok) {
            const data = await retry.json();
            if (data.meals) {
              setMeals(data.meals);
              return;
            }
          }
        }
        setError(`Errore nel caricamento (HTTP ${res.status})`);
        return;
      }
      const data = await res.json();
      if (data.error) {
        setError(data.error);
      } else if (data.meals) {
        setMeals(data.meals);
      }
    } catch (err) {
      console.error("Error loading meals structure:", err);
      setError("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  return { meals, loading, error, reload: load };
}
