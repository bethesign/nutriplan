import { useState, useEffect, useCallback } from "react";
import {
  User, Ruler, Weight, Target, Calendar, Save, Plus,
  Loader2, AlertCircle, TrendingDown, TrendingUp, Minus,
  Activity, Mail, UserPlus, Trash2, Send, CheckCircle2,
} from "lucide-react";
import { toast } from "sonner";
import { apiFetch } from "./supabase-client";
import { useAuth } from "./auth-provider";
import {
  LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, ReferenceLine, Legend,
} from "recharts";
import { format } from "date-fns";
import { it } from "date-fns/locale";

interface Profile {
  user_id: string;
  email: string;
  name: string;
  gender: string | null;
  birth_date: string | null;
  height_cm: number | null;
  current_weight_kg: number | null;
  goal: string | null;
}

interface WeightLog {
  weight_kg: number;
  bmi: number | null;
  logged_at: string;
}

function getBmiCategory(bmi: number): { label: string; color: string } {
  if (bmi < 18.5) return { label: "Sottopeso", color: "#3b82f6" };
  if (bmi < 25) return { label: "Normopeso", color: "#22c55e" };
  if (bmi < 30) return { label: "Sovrappeso", color: "#f59e0b" };
  return { label: "Obesità", color: "#ef4444" };
}

// Helper: safely parse JSON response, logging raw text on failure
async function safeJson(res: Response, label: string): Promise<any> {
  const text = await res.text();
  try {
    return JSON.parse(text);
  } catch {
    console.error(`${label}: non-JSON response (${res.status}):`, text.slice(0, 500));
    return { error: `Risposta server non valida (HTTP ${res.status})` };
  }
}

interface InvitedEntry {
  email: string;
  name?: string;
  invited_by: string;
  invited_at: string;
}

export function ProfilePage() {
  const { user } = useAuth();
  const [profile, setProfile] = useState<Profile | null>(null);
  const [weightLogs, setWeightLogs] = useState<WeightLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [loggingWeight, setLoggingWeight] = useState(false);

  // Invite state
  const [invitedList, setInvitedList] = useState<InvitedEntry[]>([]);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteName, setInviteName] = useState("");
  const [inviting, setInviting] = useState(false);
  const [loadingInvites, setLoadingInvites] = useState(true);
  const [deletingEmail, setDeletingEmail] = useState<string | null>(null);

  // Form state
  const [form, setForm] = useState({
    name: "",
    gender: "",
    birth_date: "",
    height_cm: "",
    current_weight_kg: "",
    goal: "",
  });

  const loadData = useCallback(async (showSpinner = false) => {
    if (showSpinner) setLoading(true);
    try {
      const [profileRes, logsRes] = await Promise.all([
        apiFetch("/profile"),
        apiFetch("/weight-logs"),
      ]);

      const profileData = await safeJson(profileRes, "GET /profile");
      const logsData = await safeJson(logsRes, "GET /weight-logs");

      if (profileData.error) {
        console.error("Profile load error:", profileData.error);
        if (showSpinner) toast.error(`Profilo: ${profileData.error}`);
      }
      if (logsData.error) {
        console.error("Weight logs load error:", logsData.error);
      }

      if (profileData.profile) {
        const p = profileData.profile;
        setProfile(p);
        setForm({
          name: p.name || "",
          gender: p.gender || "",
          birth_date: p.birth_date || "",
          height_cm: p.height_cm != null ? String(p.height_cm) : "",
          current_weight_kg: p.current_weight_kg != null ? String(p.current_weight_kg) : "",
          goal: p.goal || "",
        });
      }
      if (logsData.logs) {
        setWeightLogs(logsData.logs);
      }
    } catch (err) {
      console.error("Error loading profile data:", err);
      if (showSpinner) toast.error("Errore nel caricamento del profilo");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadData(true);
  }, [loadData]);

  // ─── Invite handlers ───
  const loadInvites = useCallback(async () => {
    setLoadingInvites(true);
    try {
      const res = await apiFetch("/invited");
      const data = await safeJson(res, "GET /invited");
      if (data.invited) {
        const entries: InvitedEntry[] = data.invited.map((item: any) => ({
          email: item.email || "",
          name: item.name || "",
          invited_by: item.invited_by || "",
          invited_at: item.invited_at || "",
        }));
        entries.sort((a, b) => new Date(b.invited_at).getTime() - new Date(a.invited_at).getTime());
        setInvitedList(entries);
      }
    } catch (err) {
      console.error("Error loading invites:", err);
    } finally {
      setLoadingInvites(false);
    }
  }, []);

  useEffect(() => {
    loadInvites();
  }, [loadInvites]);

  const handleInvite = async (e: React.FormEvent) => {
    e.preventDefault();
    const email = inviteEmail.trim().toLowerCase();
    if (!email) return;
    setInviting(true);
    try {
      const res = await apiFetch("/invite", {
        method: "POST",
        body: JSON.stringify({ email, name: inviteName.trim() }),
      });
      const data = await safeJson(res, "POST /invite");
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`${email} invitato con successo!`);
        setInviteEmail("");
        setInviteName("");
        await loadInvites();
      }
    } catch (err) {
      console.error("Invite error:", err);
      toast.error("Errore nell'invio dell'invito");
    } finally {
      setInviting(false);
    }
  };

  const handleDeleteInvite = async (email: string) => {
    setDeletingEmail(email);
    try {
      const res = await apiFetch("/invite", {
        method: "DELETE",
        body: JSON.stringify({ email }),
      });
      const data = await safeJson(res, "DELETE /invite");
      if (data.error) {
        toast.error(data.error);
      } else {
        toast.success(`${email} rimosso dalla lista inviti`);
        setInvitedList((prev) => prev.filter((e) => e.email !== email));
      }
    } catch (err) {
      console.error("Delete invite error:", err);
      toast.error("Errore nella rimozione dell'invito");
    } finally {
      setDeletingEmail(null);
    }
  };

  const handleSaveProfile = async () => {
    setSaving(true);
    try {
      const payload = {
        name: form.name || null,
        gender: form.gender || null,
        birth_date: form.birth_date || null,
        height_cm: form.height_cm ? parseFloat(form.height_cm) : null,
        current_weight_kg: form.current_weight_kg ? parseFloat(form.current_weight_kg) : null,
        goal: form.goal || null,
      };
      console.log("Saving profile:", payload);
      const res = await apiFetch("/profile", {
        method: "PUT",
        body: JSON.stringify(payload),
      });
      const data = await safeJson(res, "PUT /profile");
      if (data.error) {
        toast.error(data.error);
        console.error("Save profile response error:", data.error);
      } else {
        setProfile(data.profile);
        toast.success("Profilo aggiornato!");
        console.log("Profile saved successfully:", data.profile);
      }
    } catch (err) {
      console.error("Save profile exception:", err);
      toast.error("Errore nel salvataggio del profilo");
    } finally {
      setSaving(false);
    }
  };

  const handleLogWeight = async () => {
    const weight = parseFloat(newWeight);
    if (isNaN(weight) || weight <= 0) {
      toast.error("Inserisci un peso valido");
      return;
    }
    setLoggingWeight(true);
    try {
      console.log("Logging weight:", weight);
      const res = await apiFetch("/weight-log", {
        method: "POST",
        body: JSON.stringify({ weight_kg: weight }),
      });
      const data = await safeJson(res, "POST /weight-log");
      if (data.error) {
        toast.error(data.error);
        console.error("Weight log response error:", data.error);
      } else {
        toast.success("Peso registrato!");
        console.log("Weight logged successfully:", data.log);
        setNewWeight("");
        setForm((prev) => ({ ...prev, current_weight_kg: weight.toString() }));
        // Reload data to get updated logs (no spinner)
        await loadData(false);
      }
    } catch (err) {
      console.error("Log weight exception:", err);
      toast.error("Errore nel salvataggio del peso");
    } finally {
      setLoggingWeight(false);
    }
  };

  // Compute BMI
  const currentBmi = (() => {
    const h = form.height_cm ? parseFloat(form.height_cm) : null;
    const w = form.current_weight_kg ? parseFloat(form.current_weight_kg) : null;
    if (h && w && h > 0) {
      return Math.round((w / ((h / 100) * (h / 100))) * 10) / 10;
    }
    return null;
  })();

  // Chart data
  const chartData = weightLogs.map((log) => ({
    date: format(new Date(log.logged_at), "dd MMM", { locale: it }),
    fullDate: format(new Date(log.logged_at), "dd MMMM yyyy", { locale: it }),
    peso: log.weight_kg,
    bmi: log.bmi,
  }));

  // Weight trend
  const weightTrend = (() => {
    if (weightLogs.length < 2) return null;
    const first = weightLogs[0].weight_kg;
    const last = weightLogs[weightLogs.length - 1].weight_kg;
    return last - first;
  })();

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full">
        <Loader2 className="w-6 h-6 text-[#52b788] animate-spin" />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      {/* Profile Header */}
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-[#52b788] to-[#2d6a4f] flex items-center justify-center shadow-md">
          <User className="w-7 h-7 text-white" />
        </div>
        <div>
          <h2 className="text-xl font-semibold text-[#1b4332]">Il mio profilo</h2>
          <p className="text-sm text-[#95d5b2]">{user?.email}</p>
        </div>
      </div>

      {/* Profile Form */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8f5e9] bg-[#f8fdf9]">
          <h3 className="font-medium text-[#2d6a4f]">Dati personali</h3>
          <p className="text-xs text-[#95d5b2] mt-0.5">Tutti i campi sono opzionali</p>
        </div>
        <div className="p-5 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {/* Name */}
            <div>
              <label className="block text-sm text-[#555] mb-1.5">Nome</label>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Il tuo nome"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Gender */}
            <div>
              <label className="block text-sm text-[#555] mb-1.5">Sesso</label>
              <select
                value={form.gender}
                onChange={(e) => setForm({ ...form, gender: e.target.value })}
                className="w-full px-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm appearance-none cursor-pointer"
              >
                <option value="">Seleziona</option>
                <option value="M">Maschio</option>
                <option value="F">Femmina</option>
                <option value="altro">Altro</option>
              </select>
            </div>

            {/* Birth Date */}
            <div>
              <label className="block text-sm text-[#555] mb-1.5">Data di nascita</label>
              <div className="relative">
                <Calendar className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <input
                  type="date"
                  value={form.birth_date}
                  onChange={(e) => setForm({ ...form, birth_date: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Goal */}
            <div>
              <label className="block text-sm text-[#555] mb-1.5">Obiettivo</label>
              <div className="relative">
                <Target className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <select
                  value={form.goal}
                  onChange={(e) => setForm({ ...form, goal: e.target.value })}
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm appearance-none cursor-pointer"
                >
                  <option value="">Seleziona</option>
                  <option value="perdere_peso">Perdere peso</option>
                  <option value="mantenere">Mantenere il peso</option>
                  <option value="aumentare_massa">Aumentare massa muscolare</option>
                  <option value="benessere">Benessere generale</option>
                </select>
              </div>
            </div>

            {/* Height */}
            <div>
              <label className="block text-sm text-[#555] mb-1.5">Altezza (cm)</label>
              <div className="relative">
                <Ruler className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <input
                  type="number"
                  min={100}
                  max={250}
                  value={form.height_cm}
                  onChange={(e) => setForm({ ...form, height_cm: e.target.value })}
                  placeholder="es. 175"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
                />
              </div>
            </div>

            {/* Weight */}
            <div>
              <label className="block text-sm text-[#555] mb-1.5">Peso attuale (kg)</label>
              <div className="relative">
                <Weight className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <div className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#f0f0f0] text-sm min-h-[42px] flex items-center">
                  {form.current_weight_kg ? (
                    <span className="text-[#333]">{form.current_weight_kg} kg</span>
                  ) : (
                    <span className="text-[#bbb]">Nessun peso registrato</span>
                  )}
                </div>
              </div>
              <p className="text-xs text-[#999] mt-1">Aggiorna il peso dalla sezione "Registro Peso" qui sotto</p>
            </div>
          </div>

          <button
            onClick={handleSaveProfile}
            disabled={saving}
            className="flex items-center gap-2 px-5 py-2.5 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
            Salva profilo
          </button>
        </div>
      </div>

      {/* BMI Card */}
      {currentBmi !== null && (
        <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
          <div className="px-5 py-4 border-b border-[#e8f5e9] bg-[#f8fdf9]">
            <h3 className="font-medium text-[#2d6a4f] flex items-center gap-2">
              <Activity className="w-4 h-4" />
              Il tuo BMI
            </h3>
          </div>
          <div className="p-5">
            <div className="flex items-center gap-6 flex-wrap">
              <div className="text-center">
                <div className="text-4xl font-bold" style={{ color: getBmiCategory(currentBmi).color }}>
                  {currentBmi}
                </div>
                <div
                  className="text-sm font-medium mt-1"
                  style={{ color: getBmiCategory(currentBmi).color }}
                >
                  {getBmiCategory(currentBmi).label}
                </div>
              </div>

              {/* BMI scale */}
              <div className="flex-1 min-w-[200px]">
                <div className="h-3 rounded-full flex overflow-hidden">
                  <div className="bg-blue-400 flex-1" />
                  <div className="bg-green-400 flex-[1.3]" />
                  <div className="bg-amber-400 flex-1" />
                  <div className="bg-red-400 flex-1" />
                </div>
                <div className="flex justify-between text-[10px] text-[#888] mt-1 px-0.5">
                  <span>&lt;18.5</span>
                  <span>18.5</span>
                  <span>25</span>
                  <span>30</span>
                  <span>40+</span>
                </div>
                {/* BMI indicator */}
                <div className="relative h-2 mt-0.5">
                  <div
                    className="absolute w-2 h-2 rounded-full bg-[#1b4332] border-2 border-white shadow -translate-x-1/2"
                    style={{
                      left: `${Math.min(100, Math.max(0, ((currentBmi - 15) / 25) * 100))}%`,
                    }}
                  />
                </div>
              </div>

              {weightTrend !== null && (
                <div className="text-center px-3">
                  <div className="flex items-center gap-1 text-sm">
                    {weightTrend < 0 ? (
                      <TrendingDown className="w-4 h-4 text-green-500" />
                    ) : weightTrend > 0 ? (
                      <TrendingUp className="w-4 h-4 text-amber-500" />
                    ) : (
                      <Minus className="w-4 h-4 text-gray-400" />
                    )}
                    <span
                      className={`font-medium ${
                        weightTrend < 0 ? "text-green-600" : weightTrend > 0 ? "text-amber-600" : "text-gray-500"
                      }`}
                    >
                      {weightTrend > 0 ? "+" : ""}
                      {weightTrend.toFixed(1)} kg
                    </span>
                  </div>
                  <p className="text-[10px] text-[#999] mt-0.5">trend totale</p>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Weight Tracker */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8f5e9] bg-[#f8fdf9]">
          <h3 className="font-medium text-[#2d6a4f] flex items-center gap-2">
            <Weight className="w-4 h-4" />
            Registro peso
          </h3>
          <p className="text-xs text-[#95d5b2] mt-0.5">
            {form.height_cm
              ? "Registra il tuo peso per monitorare il BMI nel tempo"
              : "Imposta prima l'altezza nel profilo per calcolare il BMI"}
          </p>
        </div>
        <div className="p-5 space-y-4">
          {/* Log new weight */}
          <div className="flex items-end gap-3">
            <div className="flex-1 max-w-[200px]">
              <label className="block text-sm text-[#555] mb-1.5">Nuovo peso (kg)</label>
              <input
                type="number"
                min={30}
                max={300}
                step={0.1}
                value={newWeight}
                onChange={(e) => setNewWeight(e.target.value)}
                placeholder="es. 70.5"
                className="w-full px-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
                onKeyDown={(e) => e.key === "Enter" && handleLogWeight()}
              />
            </div>
            <button
              onClick={handleLogWeight}
              disabled={loggingWeight || !newWeight}
              className="flex items-center gap-2 px-4 py-2.5 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {loggingWeight ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Plus className="w-4 h-4" />
              )}
              Registra
            </button>
          </div>

          {/* Chart */}
          {chartData.length > 0 ? (
            <div className="mt-4">
              <ResponsiveContainer width="100%" height={280}>
                <LineChart data={chartData} margin={{ top: 5, right: 10, left: -10, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke="#e8f5e9" />
                  <XAxis
                    dataKey="date"
                    tick={{ fontSize: 11, fill: "#888" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e0e0e0" }}
                  />
                  <YAxis
                    yAxisId="weight"
                    tick={{ fontSize: 11, fill: "#888" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e0e0e0" }}
                    unit=" kg"
                    domain={["dataMin - 2", "dataMax + 2"]}
                  />
                  <YAxis
                    yAxisId="bmi"
                    orientation="right"
                    tick={{ fontSize: 11, fill: "#888" }}
                    tickLine={false}
                    axisLine={{ stroke: "#e0e0e0" }}
                    domain={[15, 40]}
                    hide
                  />
                  <Tooltip
                    contentStyle={{
                      borderRadius: 12,
                      border: "1px solid #e8f5e9",
                      boxShadow: "0 4px 12px rgba(0,0,0,0.08)",
                      fontSize: 13,
                    }}
                    formatter={(value: number, name: string) =>
                      name === "peso"
                        ? [`${value} kg`, "Peso"]
                        : [`${value}`, "BMI"]
                    }
                    labelFormatter={(label) => label}
                  />
                  <Legend
                    iconType="circle"
                    iconSize={8}
                    wrapperStyle={{ fontSize: 12 }}
                  />
                  <ReferenceLine
                    yAxisId="bmi"
                    y={25}
                    stroke="#f59e0b"
                    strokeDasharray="5 5"
                    strokeOpacity={0.5}
                  />
                  <Line
                    yAxisId="weight"
                    type="monotone"
                    dataKey="peso"
                    stroke="#40916c"
                    strokeWidth={2.5}
                    dot={{ r: 4, fill: "#40916c", stroke: "#fff", strokeWidth: 2 }}
                    activeDot={{ r: 6, fill: "#2d6a4f" }}
                    name="peso"
                  />
                  {chartData.some((d) => d.bmi !== null) && (
                    <Line
                      yAxisId="bmi"
                      type="monotone"
                      dataKey="bmi"
                      stroke="#6c63ff"
                      strokeWidth={2}
                      strokeDasharray="5 5"
                      dot={{ r: 3, fill: "#6c63ff", stroke: "#fff", strokeWidth: 2 }}
                      activeDot={{ r: 5, fill: "#5b54e6" }}
                      name="BMI"
                    />
                  )}
                </LineChart>
              </ResponsiveContainer>
            </div>
          ) : (
            <div className="flex items-center gap-2 text-sm text-[#999] py-8 justify-center">
              <AlertCircle className="w-4 h-4" />
              Nessun dato ancora. Registra il tuo primo peso!
            </div>
          )}

          {/* Weight log list */}
          {weightLogs.length > 0 && (
            <div className="border-t border-[#e8f5e9] pt-4 mt-4">
              <h4 className="text-sm font-medium text-[#555] mb-2">Storico</h4>
              <div className="space-y-1 max-h-[200px] overflow-y-auto">
                {[...weightLogs].reverse().map((log, i) => (
                  <div
                    key={`${log.logged_at}-${i}`}
                    className="flex items-center justify-between py-1.5 px-3 rounded-lg text-sm hover:bg-[#f8fdf9]"
                  >
                    <span className="text-[#888]">
                      {format(new Date(log.logged_at), "dd MMM yyyy, HH:mm", { locale: it })}
                    </span>
                    <div className="flex items-center gap-3">
                      <span className="font-medium text-[#333]">{log.weight_kg} kg</span>
                      {log.bmi && (
                        <span className="text-xs px-2 py-0.5 rounded-full" style={{
                          backgroundColor: `${getBmiCategory(log.bmi).color}15`,
                          color: getBmiCategory(log.bmi).color,
                        }}>
                          BMI {log.bmi}
                        </span>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Invite Section */}
      <div className="bg-white rounded-2xl border border-[#e8f5e9] shadow-sm overflow-hidden">
        <div className="px-5 py-4 border-b border-[#e8f5e9] bg-[#f8fdf9]">
          <h3 className="font-medium text-[#2d6a4f] flex items-center gap-2">
            <UserPlus className="w-4 h-4" />
            Invita persone
          </h3>
          <p className="text-xs text-[#95d5b2] mt-0.5">
            Invita nuove persone a utilizzare NutriPlan
          </p>
        </div>
        <div className="p-5 space-y-4">
          {/* Invite form */}
          <form onSubmit={handleInvite} className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="relative">
                <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => setInviteEmail(e.target.value)}
                  placeholder="Email da invitare"
                  required
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
                />
              </div>
              <div className="relative">
                <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-[#95d5b2]" />
                <input
                  type="text"
                  value={inviteName}
                  onChange={(e) => setInviteName(e.target.value)}
                  placeholder="Nome (opzionale)"
                  className="w-full pl-9 pr-3 py-2.5 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all text-sm"
                />
              </div>
            </div>
            <button
              type="submit"
              disabled={inviting || !inviteEmail.trim()}
              className="flex items-center gap-2 px-5 py-2.5 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl text-sm font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
            >
              {inviting ? (
                <Loader2 className="w-4 h-4 animate-spin" />
              ) : (
                <Send className="w-4 h-4" />
              )}
              Invia invito
            </button>
          </form>

          {/* Invited list */}
          <div className="border-t border-[#e8f5e9] pt-4">
            <h4 className="text-sm font-medium text-[#555] mb-2 flex items-center gap-2">
              Email autorizzate
              {!loadingInvites && (
                <span className="text-xs font-normal text-[#999] bg-[#f5f5f5] px-2 py-0.5 rounded-full">
                  {invitedList.length}
                </span>
              )}
            </h4>

            {loadingInvites ? (
              <div className="flex items-center justify-center py-6">
                <Loader2 className="w-5 h-5 text-[#95d5b2] animate-spin" />
              </div>
            ) : invitedList.length === 0 ? (
              <div className="flex items-center gap-2 text-sm text-[#999] py-6 justify-center">
                <AlertCircle className="w-4 h-4" />
                Nessun invito ancora
              </div>
            ) : (
              <div className="space-y-1 max-h-[240px] overflow-y-auto">
                {invitedList.map((entry) => (
                  <div
                    key={entry.email}
                    className="flex items-center justify-between py-2 px-3 rounded-lg text-sm hover:bg-[#f8fdf9] group"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-8 h-8 rounded-full bg-[#d8f3dc] flex items-center justify-center flex-shrink-0">
                        <Mail className="w-3.5 h-3.5 text-[#40916c]" />
                      </div>
                      <div className="min-w-0">
                        <p className="text-[#333] truncate">{entry.email}</p>
                        <div className="flex items-center gap-2">
                          {entry.name && (
                            <span className="text-xs text-[#999]">{entry.name}</span>
                          )}
                          {entry.invited_at && (
                            <span className="text-[10px] text-[#ccc]">
                              {(() => {
                                try {
                                  return format(new Date(entry.invited_at), "dd MMM yyyy", { locale: it });
                                } catch {
                                  return "";
                                }
                              })()}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                    <button
                      onClick={() => handleDeleteInvite(entry.email)}
                      disabled={deletingEmail === entry.email}
                      className="flex-shrink-0 p-1.5 rounded-lg text-[#ccc] hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all cursor-pointer disabled:opacity-50"
                      title={`Rimuovi ${entry.email}`}
                    >
                      {deletingEmail === entry.email ? (
                        <Loader2 className="w-4 h-4 animate-spin" />
                      ) : (
                        <Trash2 className="w-4 h-4" />
                      )}
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}