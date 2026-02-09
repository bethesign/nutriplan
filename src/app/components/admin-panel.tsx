import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Shield, Users, UtensilsCrossed, Package,
  Search, Plus, Pencil, Trash2, Save, X, Loader2,
  AlertCircle, CheckCircle2, ChevronDown, ChevronRight,
  Mail, UserCheck, Clock, UserCog, ShieldCheck, ShieldOff,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "./supabase-client";
import type { Meal } from "./types";
import { format } from "date-fns";
import { it } from "date-fns/locale";

type AdminTab = "foods" | "assignments" | "invitations" | "users";

interface AdminPanelProps {
  onMealsChanged: () => Promise<void>;
}

// ─── Types ────────────────────────────────────────────────────

interface FoodRecord {
  id: string;
  name: string;
  note: string | null;
  sub_group: string | null;
  sub_group_icon: string | null;
}

interface Invitation {
  id: string;
  email: string;
  name: string | null;
  invited_at: string;
  accepted_at: string | null;
  inviter: { id: string; email: string; name: string } | null;
}

interface UserProfile {
  id: string;
  email: string;
  name: string | null;
  role: string;
  created_at: string;
}

// ─── Main Admin Panel ─────────────────────────────────────────

export function AdminPanel({ onMealsChanged }: AdminPanelProps) {
  const [activeTab, setActiveTab] = useState<AdminTab>("foods");

  const tabs: { id: AdminTab; label: string; icon: React.ReactNode }[] = [
    { id: "foods", label: "Alimenti", icon: <Package className="w-4 h-4" /> },
    { id: "assignments", label: "Assegnazioni", icon: <UtensilsCrossed className="w-4 h-4" /> },
    { id: "invitations", label: "Inviti", icon: <Users className="w-4 h-4" /> },
    { id: "users", label: "Utenti", icon: <UserCog className="w-4 h-4" /> },
  ];

  return (
    <div className="max-w-5xl mx-auto space-y-5">
      {/* Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-amber-500 to-orange-600 flex items-center justify-center shadow-md">
          <Shield className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#1b4332]">Pannello Admin</h2>
          <p className="text-sm text-[#95d5b2]">Gestione alimenti, assegnazioni, inviti e utenti</p>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex gap-1 bg-white rounded-xl p-1 border border-[#e8f5e9] shadow-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            onClick={() => setActiveTab(tab.id)}
            className={`
              flex-1 flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg text-sm transition-all cursor-pointer
              ${activeTab === tab.id
                ? "bg-[#d8f3dc] text-[#1b4332] font-medium shadow-sm"
                : "text-[#888] hover:text-[#555] hover:bg-[#f5f5f5]"
              }
            `}
          >
            {tab.icon}
            {tab.label}
          </button>
        ))}
      </div>

      {/* Tab Content */}
      {activeTab === "foods" && <FoodsTab onMealsChanged={onMealsChanged} />}
      {activeTab === "assignments" && <AssignmentsTab onMealsChanged={onMealsChanged} />}
      {activeTab === "invitations" && <InvitationsTab />}
      {activeTab === "users" && <UsersTab />}
    </div>
  );
}

// ─── Foods Tab ────────────────────────────────────────────────

function FoodsTab({ onMealsChanged }: { onMealsChanged: () => Promise<void> }) {
  const [allFoods, setAllFoods] = useState<FoodRecord[]>([]);
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [editingFood, setEditingFood] = useState<FoodRecord | null>(null);
  const [showCreateForm, setShowCreateForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNote, setFormNote] = useState("");
  const [formSubGroup, setFormSubGroup] = useState("");
  const [formSubGroupIcon, setFormSubGroupIcon] = useState("");
  const [subGroupMode, setSubGroupMode] = useState<"none" | "existing" | "new">("none");

  // Post-creation assignment
  const [createdFoodId, setCreatedFoodId] = useState<string | null>(null);
  const [createdFoodName, setCreatedFoodName] = useState("");
  const [assignMealId, setAssignMealId] = useState("");
  const [assignCatId, setAssignCatId] = useState("");
  const [assignWeight, setAssignWeight] = useState("");
  const [assigning, setAssigning] = useState(false);

  const loadData = useCallback(async () => {
    setLoading(true);
    try {
      const [foodsRes, mealsRes] = await Promise.all([
        apiFetch("/admin/foods"),
        apiFetch("/meals-structure"),
      ]);
      if (foodsRes.ok) {
        const data = await foodsRes.json();
        setAllFoods(data.foods || []);
      } else {
        const text = await foodsRes.text();
        console.error("Load foods failed:", foodsRes.status, text);
        toast.error(`Errore caricamento alimenti (${foodsRes.status})`);
      }
      if (mealsRes.ok) {
        const data = await mealsRes.json();
        setMeals(data.meals || []);
      }
    } catch (err) {
      console.error("Error loading data:", err);
      toast.error("Errore di connessione");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Extract unique sub-groups from existing foods
  const existingSubGroups = useMemo(() => {
    const map = new Map<string, string>();
    allFoods.forEach((f) => {
      if (f.sub_group) {
        map.set(f.sub_group, f.sub_group_icon || "");
      }
    });
    return Array.from(map.entries()).map(([name, icon]) => ({ name, icon }));
  }, [allFoods]);

  const searchLower = search.toLowerCase().trim();
  const filteredFoods = searchLower
    ? allFoods.filter((f) => f.name.toLowerCase().includes(searchLower))
    : allFoods;

  const resetForm = () => {
    setFormName("");
    setFormNote("");
    setFormSubGroup("");
    setFormSubGroupIcon("");
    setSubGroupMode("none");
  };

  const startEdit = (food: FoodRecord) => {
    setEditingFood(food);
    setFormName(food.name);
    setFormNote(food.note || "");
    setFormSubGroup(food.sub_group || "");
    setFormSubGroupIcon(food.sub_group_icon || "");
    setSubGroupMode(food.sub_group ? "existing" : "none");
    setShowCreateForm(false);
    setCreatedFoodId(null);
  };

  const startCreate = () => {
    setEditingFood(null);
    resetForm();
    setShowCreateForm(true);
    setCreatedFoodId(null);
  };

  const cancelForm = () => {
    setEditingFood(null);
    setShowCreateForm(false);
    setCreatedFoodId(null);
    resetForm();
  };

  const handleSave = async () => {
    if (!formName.trim()) {
      toast.error("Il nome dell'alimento e' obbligatorio.");
      return;
    }
    setSaving(true);
    try {
      const payload = {
        name: formName.trim(),
        note: formNote.trim() || null,
        sub_group: subGroupMode !== "none" ? (formSubGroup.trim() || null) : null,
        sub_group_icon: subGroupMode !== "none" ? (formSubGroupIcon.trim() || null) : null,
      };

      let res: Response;
      if (editingFood) {
        res = await apiFetch(`/admin/foods/${editingFood.id}`, {
          method: "PUT",
          body: JSON.stringify(payload),
        });
      } else {
        res = await apiFetch("/admin/foods", {
          method: "POST",
          body: JSON.stringify(payload),
        });
      }

      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else if (!res.ok) {
        toast.error(`Errore server (${res.status})`);
      } else {
        toast.success(editingFood ? "Alimento aggiornato!" : "Alimento creato!");
        const savedFood = data.food;
        const wasCreating = !editingFood;
        cancelForm();
        await loadData();
        await onMealsChanged();
        // After creating, offer assignment step
        if (wasCreating && savedFood?.id) {
          setCreatedFoodId(savedFood.id);
          setCreatedFoodName(savedFood.name);
          setAssignMealId("");
          setAssignCatId("");
          setAssignWeight("");
        }
      }
    } catch (err) {
      console.error("Save food error:", err);
      toast.error(`Errore nel salvataggio: ${err}`);
    } finally {
      setSaving(false);
    }
  };

  const handleAssign = async () => {
    if (!assignCatId || !assignWeight || !createdFoodId) {
      toast.error("Seleziona pasto, categoria e peso.");
      return;
    }
    const weight = parseFloat(assignWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Peso non valido.");
      return;
    }
    setAssigning(true);
    try {
      const res = await apiFetch("/admin/meal-category-foods", {
        method: "POST",
        body: JSON.stringify({
          meal_category_id: assignCatId,
          food_id: createdFoodId,
          base_weight: weight,
          sort_order: 99,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`"${createdFoodName}" assegnato al pasto!`);
        setCreatedFoodId(null);
        await loadData();
        await onMealsChanged();
      }
    } catch (err) {
      toast.error("Errore nell'assegnazione");
    } finally {
      setAssigning(false);
    }
  };

  const handleDelete = async (food: FoodRecord) => {
    if (!confirm(`Eliminare "${food.name}"? Verranno rimosse anche tutte le assegnazioni.`)) return;
    setDeletingId(food.id);
    try {
      const res = await apiFetch(`/admin/foods/${food.id}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`"${food.name}" eliminato.`);
        await loadData();
        await onMealsChanged();
      }
    } catch (err) {
      console.error("Delete food error:", err);
      toast.error("Errore nell'eliminazione");
    } finally {
      setDeletingId(null);
    }
  };

  // Categories for the selected meal (assignment step)
  const selectedMealCats = assignMealId
    ? (meals.find((m) => m.id === assignMealId)?.categories || [])
    : [];

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#52b788] animate-spin" />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-3">
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
            <span className="text-xs text-[#999]">{allFoods.length} alimenti</span>
            <button
              onClick={startCreate}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#40916c] hover:bg-[#2d6a4f] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer"
            >
              <Plus className="w-3.5 h-3.5" />
              Nuovo
            </button>
          </div>
        </div>
      </div>

      {/* Post-creation assignment card */}
      {createdFoodId && (
        <div className="bg-white rounded-2xl border-2 border-[#52b788] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e8f5e9] bg-[#d8f3dc] flex items-center justify-between">
            <span className="text-sm font-medium text-[#1b4332]">
              Assegna "{createdFoodName}" a un pasto
            </span>
            <button
              onClick={() => setCreatedFoodId(null)}
              className="text-xs text-[#52b788] hover:text-[#2d6a4f] cursor-pointer"
            >
              Salta
            </button>
          </div>
          <div className="p-5 space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div>
                <label className="block text-xs text-[#888] mb-1">Pasto</label>
                <select
                  value={assignMealId}
                  onChange={(e) => { setAssignMealId(e.target.value); setAssignCatId(""); }}
                  className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                >
                  <option value="">Seleziona pasto...</option>
                  {meals.map((m) => (
                    <option key={m.id} value={m.id}>{m.icon} {m.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Categoria</label>
                <select
                  value={assignCatId}
                  onChange={(e) => setAssignCatId(e.target.value)}
                  disabled={!assignMealId}
                  className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all disabled:opacity-50"
                >
                  <option value="">Seleziona categoria...</option>
                  {selectedMealCats.map((c) => (
                    <option key={c.id} value={c.id}>{c.icon} {c.name}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Peso base (g)</label>
                <input
                  type="number"
                  min={1}
                  value={assignWeight}
                  onChange={(e) => setAssignWeight(e.target.value)}
                  placeholder="es. 80"
                  className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                />
              </div>
            </div>
            <button
              onClick={handleAssign}
              disabled={assigning || !assignCatId || !assignWeight}
              className="flex items-center gap-1.5 px-4 py-2 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {assigning ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Plus className="w-3.5 h-3.5" />}
              Assegna al pasto
            </button>
          </div>
        </div>
      )}

      {/* Create/Edit Form */}
      {(showCreateForm || editingFood) && (
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
          <div className="px-5 py-3 border-b border-[#e8f5e9] bg-[#f8fdf9] flex items-center justify-between">
            <span className="text-sm font-medium text-[#2d6a4f]">
              {editingFood ? `Modifica: ${editingFood.name}` : "Nuovo alimento"}
            </span>
            <button onClick={cancelForm} className="p-1 text-[#999] hover:text-[#555] cursor-pointer">
              <X className="w-4 h-4" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {/* Name + Note */}
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs text-[#888] mb-1">Nome *</label>
                <input
                  type="text"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                  placeholder="es. Pasta integrale"
                  className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                />
              </div>
              <div>
                <label className="block text-xs text-[#888] mb-1">Nota (opzionale)</label>
                <input
                  type="text"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                  placeholder='es. "a settimana", "(1/7)"'
                  className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                />
              </div>
            </div>

            {/* Sub-group selector */}
            <div>
              <label className="block text-xs text-[#888] mb-1.5">Sotto-gruppo</label>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => { setSubGroupMode("none"); setFormSubGroup(""); setFormSubGroupIcon(""); }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    subGroupMode === "none"
                      ? "bg-[#d8f3dc] text-[#1b4332]"
                      : "bg-[#f5f5f5] text-[#888] hover:bg-[#eee]"
                  }`}
                >
                  Nessuno
                </button>
                {existingSubGroups.map((sg) => (
                  <button
                    key={sg.name}
                    type="button"
                    onClick={() => {
                      setSubGroupMode("existing");
                      setFormSubGroup(sg.name);
                      setFormSubGroupIcon(sg.icon);
                    }}
                    className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                      subGroupMode === "existing" && formSubGroup === sg.name
                        ? "bg-[#6c63ff]/15 text-[#6c63ff] ring-1 ring-[#6c63ff]/30"
                        : "bg-[#f5f5f5] text-[#888] hover:bg-[#eee]"
                    }`}
                  >
                    {sg.icon} {sg.name}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() => {
                    setSubGroupMode("new");
                    setFormSubGroup("");
                    setFormSubGroupIcon("");
                  }}
                  className={`px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer ${
                    subGroupMode === "new"
                      ? "bg-amber-100 text-amber-700 ring-1 ring-amber-300"
                      : "bg-[#f5f5f5] text-[#888] hover:bg-[#eee]"
                  }`}
                >
                  <Plus className="w-3 h-3 inline -mt-0.5 mr-0.5" />
                  Nuovo...
                </button>
              </div>

              {/* New sub-group inputs */}
              {subGroupMode === "new" && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 mt-3">
                  <div>
                    <label className="block text-xs text-[#888] mb-1">Nome sotto-gruppo</label>
                    <input
                      type="text"
                      value={formSubGroup}
                      onChange={(e) => setFormSubGroup(e.target.value)}
                      placeholder="es. Proteine Animali"
                      className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                    />
                  </div>
                  <div>
                    <label className="block text-xs text-[#888] mb-1">Icona</label>
                    <input
                      type="text"
                      value={formSubGroupIcon}
                      onChange={(e) => setFormSubGroupIcon(e.target.value)}
                      placeholder="es. 🐟"
                      className="w-full px-3 py-2 rounded-lg border border-[#e0e0e0] bg-[#fafafa] text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                    />
                  </div>
                </div>
              )}
            </div>

            {/* Save button */}
            <div className="flex gap-2 pt-1">
              <button
                onClick={handleSave}
                disabled={saving}
                className="flex items-center gap-1.5 px-4 py-2 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                {editingFood ? "Salva modifiche" : "Crea alimento"}
              </button>
              <button
                onClick={cancelForm}
                className="px-4 py-2 text-[#999] hover:text-[#555] text-sm rounded-xl hover:bg-[#f5f5f5] transition-colors cursor-pointer"
              >
                Annulla
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Foods list */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
        <div className="divide-y divide-[#f0f0f0]">
          {filteredFoods.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[#999]">
              {searchLower ? "Nessun alimento trovato" : "Nessun alimento disponibile"}
            </div>
          )}
          {filteredFoods.map((food) => (
            <div
              key={food.id}
              className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafcfa] transition-colors group"
            >
              <div className="flex-1 min-w-0">
                <span className="text-sm text-[#333] font-medium block truncate">{food.name}</span>
                <div className="flex items-center gap-2 mt-0.5">
                  {food.note && (
                    <span className="text-[10px] text-[#999] bg-[#f5f5f5] px-1.5 py-0.5 rounded">
                      {food.note}
                    </span>
                  )}
                  {food.sub_group && (
                    <span className="text-[10px] text-[#6c63ff] bg-[#6c63ff]/10 px-1.5 py-0.5 rounded">
                      {food.sub_group_icon} {food.sub_group}
                    </span>
                  )}
                </div>
              </div>
              <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                <button
                  onClick={() => startEdit(food)}
                  className="p-1.5 rounded-lg text-[#999] hover:text-[#52b788] hover:bg-[#d8f3dc] transition-colors cursor-pointer"
                  title="Modifica"
                >
                  <Pencil className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => handleDelete(food)}
                  disabled={deletingId === food.id}
                  className="p-1.5 rounded-lg text-[#999] hover:text-red-500 hover:bg-red-50 transition-colors cursor-pointer disabled:opacity-50"
                  title="Elimina"
                >
                  {deletingId === food.id ? (
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  ) : (
                    <Trash2 className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Assignments Tab ──────────────────────────────────────────

function AssignmentsTab({ onMealsChanged }: { onMealsChanged: () => Promise<void> }) {
  const [meals, setMeals] = useState<Meal[]>([]);
  const [loading, setLoading] = useState(true);
  const [expandedMeals, setExpandedMeals] = useState<Set<string>>(new Set());
  const [expandedCats, setExpandedCats] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editWeight, setEditWeight] = useState("");
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  // Create assignment form
  const [showAddForm, setShowAddForm] = useState<string | null>(null); // meal_category_id
  const [addFoodSearch, setAddFoodSearch] = useState("");
  const [addFoodId, setAddFoodId] = useState("");
  const [addWeight, setAddWeight] = useState("");

  const [allFoods, setAllFoods] = useState<{ id: string; name: string }[]>([]);

  const loadMeals = useCallback(async () => {
    setLoading(true);
    try {
      const [mealsRes, foodsRes] = await Promise.all([
        apiFetch("/meals-structure"),
        apiFetch("/admin/foods"),
      ]);
      if (mealsRes.ok) {
        const data = await mealsRes.json();
        setMeals(data.meals || []);
      }
      if (foodsRes.ok) {
        const data = await foodsRes.json();
        setAllFoods((data.foods || []).map((f: any) => ({ id: f.id, name: f.name })));
      }
    } catch (err) {
      console.error("Error loading meals:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadMeals();
  }, [loadMeals]);

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

  const handleUpdateWeight = async (mcfId: string) => {
    const weight = parseFloat(editWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Peso non valido");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch(`/admin/meal-category-foods/${mcfId}`, {
        method: "PUT",
        body: JSON.stringify({ base_weight: weight }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Peso aggiornato!");
        setEditingId(null);
        await loadMeals();
        await onMealsChanged();
      }
    } catch (err) {
      toast.error("Errore nell'aggiornamento");
    } finally {
      setSaving(false);
    }
  };

  const handleDeleteAssignment = async (mcfId: string, foodName: string) => {
    if (!confirm(`Rimuovere "${foodName}" da questa categoria?`)) return;
    setDeletingId(mcfId);
    try {
      const res = await apiFetch(`/admin/meal-category-foods/${mcfId}`, { method: "DELETE" });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Assegnazione rimossa!");
        await loadMeals();
        await onMealsChanged();
      }
    } catch (err) {
      toast.error("Errore nella rimozione");
    } finally {
      setDeletingId(null);
    }
  };

  const handleAddAssignment = async (mealCategoryId: string) => {
    if (!addFoodId || !addWeight) {
      toast.error("Seleziona un alimento e un peso.");
      return;
    }
    const weight = parseFloat(addWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Peso non valido");
      return;
    }
    setSaving(true);
    try {
      const res = await apiFetch("/admin/meal-category-foods", {
        method: "POST",
        body: JSON.stringify({
          meal_category_id: mealCategoryId,
          food_id: addFoodId,
          base_weight: weight,
          sort_order: 99,
        }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success("Alimento assegnato!");
        setShowAddForm(null);
        setAddFoodSearch("");
        setAddFoodId("");
        setAddWeight("");
        await loadMeals();
        await onMealsChanged();
      }
    } catch (err) {
      toast.error("Errore nell'assegnazione");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#52b788] animate-spin" />
      </div>
    );
  }

  const filteredAddFoods = addFoodSearch.trim()
    ? allFoods.filter((f) => f.name.toLowerCase().includes(addFoodSearch.toLowerCase()))
    : allFoods;

  return (
    <div className="space-y-3">
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4">
        <p className="text-sm text-[#888]">
          Gestisci le assegnazioni degli alimenti ai pasti. Ogni alimento puo' apparire in piu' pasti con pesi diversi.
        </p>
      </div>

      {meals.map((meal) => {
        const mealExpanded = expandedMeals.has(meal.id);
        const totalItems = meal.categories.reduce((s, c) => s + c.items.length, 0);

        return (
          <div key={meal.id} className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
            <button
              onClick={() => toggleMeal(meal.id)}
              className="w-full flex items-center justify-between px-5 py-3.5 hover:bg-[#f8fdf9] transition-colors cursor-pointer"
            >
              <div className="flex items-center gap-2.5">
                {mealExpanded ? <ChevronDown className="w-4 h-4 text-[#95d5b2]" /> : <ChevronRight className="w-4 h-4 text-[#95d5b2]" />}
                <span className="text-lg">{meal.icon}</span>
                <span className="font-medium text-[#1b4332]">{meal.name}</span>
                {meal.is_free && (
                  <span className="text-[10px] bg-blue-50 text-blue-600 px-1.5 py-0.5 rounded-full">libero</span>
                )}
              </div>
              <span className="text-xs text-[#bbb]">{totalItems} alimenti</span>
            </button>

            {mealExpanded && (
              <div className="border-t border-[#e8f5e9]">
                {meal.categories.map((cat) => {
                  const catKey = `${meal.id}:${cat.id}`;
                  const catExpanded = expandedCats.has(catKey);

                  return (
                    <div key={cat.id}>
                      <button
                        onClick={() => toggleCat(catKey)}
                        className="w-full flex items-center justify-between px-7 py-2.5 hover:bg-[#fafcfa] transition-colors cursor-pointer"
                      >
                        <div className="flex items-center gap-2">
                          {catExpanded ? <ChevronDown className="w-3.5 h-3.5 text-[#ccc]" /> : <ChevronRight className="w-3.5 h-3.5 text-[#ccc]" />}
                          <span>{cat.icon}</span>
                          <span className="text-sm text-[#555]">{cat.name}</span>
                          {cat.is_optional && (
                            <span className="text-[9px] bg-gray-100 text-gray-500 px-1 py-0.5 rounded">opzionale</span>
                          )}
                        </div>
                        <span className="text-xs text-[#ccc]">{cat.items.length}</span>
                      </button>

                      {catExpanded && (
                        <div className="divide-y divide-[#f5f5f5]">
                          {cat.items.map((item) => (
                            <div key={item.id} className="flex items-center gap-3 px-10 py-2.5 hover:bg-[#fafcfa] transition-colors group">
                              <div className="flex-1 min-w-0">
                                <span className="text-sm text-[#555] block truncate">{item.name}</span>
                                {item.note && <span className="text-[10px] text-[#bbb]">{item.note}</span>}
                              </div>

                              {editingId === item.id ? (
                                <div className="flex items-center gap-2">
                                  <input
                                    type="number"
                                    min={1}
                                    value={editWeight}
                                    onChange={(e) => setEditWeight(e.target.value)}
                                    className="w-20 text-right text-sm rounded-lg border border-[#52b788] px-2 py-1 focus:outline-none bg-white"
                                    autoFocus
                                    onKeyDown={(e) => {
                                      if (e.key === "Enter") handleUpdateWeight(item.id);
                                      if (e.key === "Escape") setEditingId(null);
                                    }}
                                  />
                                  <span className="text-xs text-[#999]">g</span>
                                  <button
                                    onClick={() => handleUpdateWeight(item.id)}
                                    disabled={saving}
                                    className="p-1 text-[#52b788] hover:text-[#2d6a4f] cursor-pointer"
                                  >
                                    {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <CheckCircle2 className="w-3.5 h-3.5" />}
                                  </button>
                                  <button onClick={() => setEditingId(null)} className="p-1 text-[#999] hover:text-[#555] cursor-pointer">
                                    <X className="w-3.5 h-3.5" />
                                  </button>
                                </div>
                              ) : (
                                <div className="flex items-center gap-2">
                                  <span className="text-sm text-[#888]">{item.baseWeight}g</span>
                                  <div className="flex items-center gap-0.5 opacity-0 group-hover:opacity-100 transition-opacity">
                                    <button
                                      onClick={() => { setEditingId(item.id); setEditWeight(String(item.baseWeight)); }}
                                      className="p-1 text-[#ccc] hover:text-[#52b788] cursor-pointer"
                                      title="Modifica peso"
                                    >
                                      <Pencil className="w-3 h-3" />
                                    </button>
                                    <button
                                      onClick={() => handleDeleteAssignment(item.id, item.name)}
                                      disabled={deletingId === item.id}
                                      className="p-1 text-[#ccc] hover:text-red-500 cursor-pointer disabled:opacity-50"
                                      title="Rimuovi"
                                    >
                                      {deletingId === item.id ? <Loader2 className="w-3 h-3 animate-spin" /> : <Trash2 className="w-3 h-3" />}
                                    </button>
                                  </div>
                                </div>
                              )}
                            </div>
                          ))}

                          {/* Add food to this category */}
                          {showAddForm === cat.id ? (
                            <div className="px-10 py-3 bg-[#f8fdf9] space-y-2">
                              <div className="flex flex-col sm:flex-row gap-2">
                                <div className="flex-1 relative">
                                  <input
                                    type="text"
                                    value={addFoodSearch}
                                    onChange={(e) => { setAddFoodSearch(e.target.value); setAddFoodId(""); }}
                                    placeholder="Cerca alimento..."
                                    className="w-full px-3 py-1.5 rounded-lg border border-[#e0e0e0] bg-white text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                                  />
                                  {addFoodSearch && !addFoodId && (
                                    <div className="absolute top-full left-0 right-0 mt-1 bg-white border border-[#e0e0e0] rounded-lg shadow-lg max-h-40 overflow-y-auto z-10">
                                      {filteredAddFoods.slice(0, 10).map((f) => (
                                        <button
                                          key={f.id}
                                          onClick={() => { setAddFoodId(f.id); setAddFoodSearch(f.name); }}
                                          className="w-full text-left px-3 py-1.5 text-sm hover:bg-[#d8f3dc] cursor-pointer"
                                        >
                                          {f.name}
                                        </button>
                                      ))}
                                    </div>
                                  )}
                                </div>
                                <input
                                  type="number"
                                  min={1}
                                  value={addWeight}
                                  onChange={(e) => setAddWeight(e.target.value)}
                                  placeholder="Peso (g)"
                                  className="w-24 px-3 py-1.5 rounded-lg border border-[#e0e0e0] bg-white text-sm text-[#333] focus:outline-none focus:border-[#52b788] transition-all"
                                />
                              </div>
                              <div className="flex gap-2">
                                <button
                                  onClick={() => handleAddAssignment(cat.id)}
                                  disabled={saving || !addFoodId}
                                  className="flex items-center gap-1 px-3 py-1.5 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-lg text-xs font-medium cursor-pointer disabled:cursor-not-allowed transition-colors"
                                >
                                  {saving ? <Loader2 className="w-3 h-3 animate-spin" /> : <Plus className="w-3 h-3" />}
                                  Aggiungi
                                </button>
                                <button
                                  onClick={() => { setShowAddForm(null); setAddFoodSearch(""); setAddFoodId(""); setAddWeight(""); }}
                                  className="px-3 py-1.5 text-[#999] hover:text-[#555] text-xs rounded-lg hover:bg-white cursor-pointer transition-colors"
                                >
                                  Annulla
                                </button>
                              </div>
                            </div>
                          ) : (
                            <button
                              onClick={() => setShowAddForm(cat.id)}
                              className="w-full flex items-center gap-1.5 px-10 py-2 text-xs text-[#95d5b2] hover:text-[#52b788] hover:bg-[#f8fdf9] transition-colors cursor-pointer"
                            >
                              <Plus className="w-3 h-3" />
                              Aggiungi alimento
                            </button>
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
  );
}

// ─── Users Tab ────────────────────────────────────────────────

function UsersTab() {
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [togglingId, setTogglingId] = useState<string | null>(null);

  const loadUsers = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch("/admin/users");
      if (res.ok) {
        const data = await res.json();
        setUsers(data.users || []);
      }
    } catch (err) {
      console.error("Error loading users:", err);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadUsers();
  }, [loadUsers]);

  const handleToggleRole = async (user: UserProfile) => {
    const newRole = user.role === "admin" ? "user" : "admin";
    const action = newRole === "admin" ? "promuovere ad admin" : "rimuovere da admin";
    if (!confirm(`Vuoi ${action} "${user.name || user.email}"?`)) return;

    setTogglingId(user.id);
    try {
      const res = await apiFetch(`/admin/users/${user.id}/role`, {
        method: "PUT",
        body: JSON.stringify({ role: newRole }),
      });
      const data = await res.json();
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(newRole === "admin" ? "Utente promosso ad admin!" : "Ruolo admin rimosso!");
        await loadUsers();
      }
    } catch (err) {
      console.error("Toggle role error:", err);
      toast.error("Errore nel cambio ruolo");
    } finally {
      setTogglingId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#52b788] animate-spin" />
      </div>
    );
  }

  const searchLower = search.toLowerCase().trim();
  const filteredUsers = searchLower
    ? users.filter(
        (u) =>
          (u.email || "").toLowerCase().includes(searchLower) ||
          (u.name || "").toLowerCase().includes(searchLower)
      )
    : users;

  const adminCount = users.filter((u) => u.role === "admin").length;

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-3">
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-[#1b4332]">{users.length}</div>
          <div className="text-xs text-[#95d5b2] mt-0.5">Utenti totali</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{adminCount}</div>
          <div className="text-xs text-[#95d5b2] mt-0.5">Admin</div>
        </div>
      </div>

      {/* Search */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4">
        <div className="relative">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
          <input
            type="text"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Cerca per nome o email..."
            className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
          />
        </div>
      </div>

      {/* Users list */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e8f5e9] bg-[#f8fdf9]">
          <span className="text-sm font-medium text-[#2d6a4f]">Tutti gli utenti</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {filteredUsers.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[#999]">
              <AlertCircle className="w-5 h-5 mx-auto mb-2 text-[#ccc]" />
              {searchLower ? "Nessun utente trovato" : "Nessun utente presente"}
            </div>
          )}
          {filteredUsers.map((user) => (
            <div key={user.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafcfa] transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                user.role === "admin" ? "bg-amber-50" : "bg-gray-50"
              }`}>
                {user.role === "admin" ? (
                  <ShieldCheck className="w-4 h-4 text-amber-500" />
                ) : (
                  <Users className="w-4 h-4 text-gray-400" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#333] truncate">
                    {user.name || user.email}
                  </span>
                  {user.role === "admin" && (
                    <span className="text-[9px] bg-amber-50 text-amber-600 px-1.5 py-0.5 rounded-full font-medium">
                      admin
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {user.name && (
                    <span className="text-xs text-[#999] truncate">{user.email}</span>
                  )}
                  <span className="text-[10px] text-[#ccc]">
                    dal {(() => {
                      try {
                        return format(new Date(user.created_at), "dd MMM yyyy", { locale: it });
                      } catch { return ""; }
                    })()}
                  </span>
                </div>
              </div>
              <button
                onClick={() => handleToggleRole(user)}
                disabled={togglingId === user.id}
                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${
                  user.role === "admin"
                    ? "text-red-600 bg-red-50 hover:bg-red-100"
                    : "text-amber-600 bg-amber-50 hover:bg-amber-100"
                }`}
                title={user.role === "admin" ? "Rimuovi admin" : "Promuovi ad admin"}
              >
                {togglingId === user.id ? (
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                ) : user.role === "admin" ? (
                  <ShieldOff className="w-3.5 h-3.5" />
                ) : (
                  <ShieldCheck className="w-3.5 h-3.5" />
                )}
                {user.role === "admin" ? "Rimuovi" : "Promuovi"}
              </button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ─── Invitations Tab ──────────────────────────────────────────

function InvitationsTab() {
  const [invitations, setInvitations] = useState<Invitation[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        const res = await apiFetch("/admin/invitations");
        if (res.ok) {
          const data = await res.json();
          setInvitations(data.invitations || []);
        }
      } catch (err) {
        console.error("Error loading invitations:", err);
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <Loader2 className="w-6 h-6 text-[#52b788] animate-spin" />
      </div>
    );
  }

  const accepted = invitations.filter((i) => i.accepted_at);
  const pending = invitations.filter((i) => !i.accepted_at);

  return (
    <div className="space-y-4">
      {/* Stats */}
      <div className="grid grid-cols-3 gap-3">
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-[#1b4332]">{invitations.length}</div>
          <div className="text-xs text-[#95d5b2] mt-0.5">Totali</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-green-600">{accepted.length}</div>
          <div className="text-xs text-[#95d5b2] mt-0.5">Registrati</div>
        </div>
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm p-4 text-center">
          <div className="text-2xl font-bold text-amber-600">{pending.length}</div>
          <div className="text-xs text-[#95d5b2] mt-0.5">In attesa</div>
        </div>
      </div>

      {/* Invitations list */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
        <div className="px-5 py-3 border-b border-[#e8f5e9] bg-[#f8fdf9]">
          <span className="text-sm font-medium text-[#2d6a4f]">Tutti gli inviti</span>
        </div>
        <div className="divide-y divide-[#f0f0f0]">
          {invitations.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-[#999]">
              <AlertCircle className="w-5 h-5 mx-auto mb-2 text-[#ccc]" />
              Nessun invito presente
            </div>
          )}
          {invitations.map((inv) => (
            <div key={inv.id} className="flex items-center gap-3 px-5 py-3 hover:bg-[#fafcfa] transition-colors">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 ${
                inv.accepted_at ? "bg-green-50" : "bg-amber-50"
              }`}>
                {inv.accepted_at ? (
                  <UserCheck className="w-4 h-4 text-green-500" />
                ) : (
                  <Clock className="w-4 h-4 text-amber-500" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-medium text-[#333] truncate">{inv.email}</span>
                  {inv.accepted_at && (
                    <span className="text-[9px] bg-green-50 text-green-600 px-1.5 py-0.5 rounded-full">registrato</span>
                  )}
                </div>
                <div className="flex items-center gap-2 mt-0.5">
                  {inv.name && <span className="text-xs text-[#999]">{inv.name}</span>}
                  <span className="text-[10px] text-[#ccc]">
                    invitato {(() => {
                      try {
                        return format(new Date(inv.invited_at), "dd MMM yyyy", { locale: it });
                      } catch { return ""; }
                    })()}
                  </span>
                  {inv.inviter && (
                    <span className="text-[10px] text-[#bbb]">
                      da {inv.inviter.name || inv.inviter.email}
                    </span>
                  )}
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
