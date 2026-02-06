import { useState } from "react";
import { Leaf, ArrowRight, Lock, Mail, User, Loader2, AlertCircle, CheckCircle2 } from "lucide-react";
import { supabase, apiFetch } from "./supabase-client";
import { motion } from "motion/react";

type AuthStep = "email" | "set-password" | "login";

export function LoginScreen() {
  const [step, setStep] = useState<AuthStep>("email");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [name, setName] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");

  const handleCheckEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const res = await apiFetch("/check-email", {
        method: "POST",
        body: JSON.stringify({ email: email.trim() }),
      });

      const data = await res.json();

      if (data.status === "not_invited") {
        setError(data.message);
      } else if (data.status === "new_user") {
        setStep("set-password");
        setSuccess(data.message);
      } else if (data.status === "existing_user") {
        setStep("login");
        setSuccess(data.message);
      } else if (data.error) {
        setError(data.error);
      }
    } catch (err) {
      console.error("Check email error:", err);
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");

    if (password.length < 6) {
      setError("La password deve avere almeno 6 caratteri.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Le password non coincidono.");
      return;
    }

    setLoading(true);

    try {
      const res = await apiFetch("/signup", {
        method: "POST",
        body: JSON.stringify({ email: email.trim(), password, name: name.trim() }),
      });

      const data = await res.json();

      if (data.error) {
        setError(data.error);
        return;
      }

      // Auto-login after signup
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError(`Account creato, ma errore nel login automatico: ${loginError.message}`);
        setStep("login");
      }
      // onAuthStateChange in AuthProvider will handle the redirect
    } catch (err) {
      console.error("Signup error:", err);
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      const { error: loginError } = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });

      if (loginError) {
        setError(`Credenziali non valide: ${loginError.message}`);
      }
      // onAuthStateChange in AuthProvider will handle the redirect
    } catch (err) {
      console.error("Login error:", err);
      setError("Errore di connessione. Riprova.");
    } finally {
      setLoading(false);
    }
  };

  const handleBack = () => {
    setStep("email");
    setPassword("");
    setConfirmPassword("");
    setName("");
    setError("");
    setSuccess("");
  };

  return (
    <div className="min-h-full flex items-center justify-center bg-gradient-to-br from-[#f5faf7] via-[#e8f5e9] to-[#d8f3dc] p-4">
      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ duration: 0.5 }}
        className="w-full max-w-md"
      >
        {/* Logo */}
        <div className="text-center mb-8">
          <div className="inline-flex items-center justify-center w-16 h-16 bg-gradient-to-br from-[#52b788] to-[#2d6a4f] rounded-2xl shadow-lg mb-4">
            <Leaf className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-semibold text-[#1b4332]">NutriPlan</h1>
          <p className="text-sm text-[#52b788] mt-1">Il tuo piano alimentare giornaliero</p>
        </div>

        {/* Card */}
        <div className="bg-white rounded-2xl shadow-xl border border-[#e8f5e9] overflow-hidden">
          {/* Step indicator */}
          <div className="bg-[#f8fdf9] px-6 py-4 border-b border-[#e8f5e9]">
            <div className="flex items-center gap-3">
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step === "email" ? "bg-[#40916c] text-white" : "bg-[#d8f3dc] text-[#40916c]"
              }`}>
                1
              </div>
              <div className={`h-0.5 flex-1 rounded ${step !== "email" ? "bg-[#40916c]" : "bg-[#e0e0e0]"}`} />
              <div className={`w-8 h-8 rounded-full flex items-center justify-center text-sm font-medium ${
                step !== "email" ? "bg-[#40916c] text-white" : "bg-[#f0f0f0] text-[#ccc]"
              }`}>
                2
              </div>
            </div>
          </div>

          <div className="p-6">
            {/* Success message */}
            {success && !error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 bg-green-50 border border-green-200 rounded-lg px-3 py-2.5 mb-4"
              >
                <CheckCircle2 className="w-4 h-4 text-green-600 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-green-700">{success}</span>
              </motion.div>
            )}

            {/* Error message */}
            {error && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: "auto" }}
                className="flex items-start gap-2 bg-red-50 border border-red-200 rounded-lg px-3 py-2.5 mb-4"
              >
                <AlertCircle className="w-4 h-4 text-red-500 flex-shrink-0 mt-0.5" />
                <span className="text-sm text-red-700">{error}</span>
              </motion.div>
            )}

            {/* STEP: Email */}
            {step === "email" && (
              <motion.form
                key="email-step"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleCheckEmail}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-medium text-[#1b4332] mb-1">Accedi</h2>
                  <p className="text-sm text-[#888]">Inserisci la tua email per iniziare</p>
                </div>

                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#95d5b2]" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="La tua email"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !email.trim()}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <>
                      Continua
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>
              </motion.form>
            )}

            {/* STEP: Set Password (first-time user) */}
            {step === "set-password" && (
              <motion.form
                key="set-password-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleSignup}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-medium text-[#1b4332] mb-1">Crea il tuo account</h2>
                  <p className="text-sm text-[#888]">Imposta una password per <strong className="text-[#333]">{email}</strong></p>
                </div>

                <div className="relative">
                  <User className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#95d5b2]" />
                  <input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Il tuo nome (opzionale)"
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#95d5b2]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password (min. 6 caratteri)"
                    required
                    minLength={6}
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all"
                  />
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#95d5b2]" />
                  <input
                    type="password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Conferma password"
                    required
                    minLength={6}
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password || !confirmPassword}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <>
                      Registrati
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full text-sm text-[#888] hover:text-[#555] py-2 transition-colors cursor-pointer"
                >
                  Torna indietro
                </button>
              </motion.form>
            )}

            {/* STEP: Login (existing user) */}
            {step === "login" && (
              <motion.form
                key="login-step"
                initial={{ opacity: 0, x: 10 }}
                animate={{ opacity: 1, x: 0 }}
                onSubmit={handleLogin}
                className="space-y-4"
              >
                <div>
                  <h2 className="text-lg font-medium text-[#1b4332] mb-1">Bentornato!</h2>
                  <p className="text-sm text-[#888]">Inserisci la password per <strong className="text-[#333]">{email}</strong></p>
                </div>

                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-4.5 h-4.5 text-[#95d5b2]" />
                  <input
                    type="password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Password"
                    required
                    autoFocus
                    className="w-full pl-10 pr-4 py-3 rounded-xl border border-[#e0e0e0] bg-[#fafafa] text-[#333] placeholder:text-[#bbb] focus:outline-none focus:border-[#52b788] focus:bg-white transition-all"
                  />
                </div>

                <button
                  type="submit"
                  disabled={loading || !password}
                  className="w-full flex items-center justify-center gap-2 py-3 bg-[#40916c] hover:bg-[#2d6a4f] disabled:bg-[#c5d8ce] text-white rounded-xl font-medium transition-colors cursor-pointer disabled:cursor-not-allowed"
                >
                  {loading ? (
                    <Loader2 className="w-4.5 h-4.5 animate-spin" />
                  ) : (
                    <>
                      Accedi
                      <ArrowRight className="w-4.5 h-4.5" />
                    </>
                  )}
                </button>

                <button
                  type="button"
                  onClick={handleBack}
                  className="w-full text-sm text-[#888] hover:text-[#555] py-2 transition-colors cursor-pointer"
                >
                  Usa un'altra email
                </button>
              </motion.form>
            )}
          </div>
        </div>

        {/* Footer */}
        <p className="text-center text-xs text-[#95d5b2] mt-6">
          Accesso riservato agli utenti invitati
        </p>
      </motion.div>
    </div>
  );
}
