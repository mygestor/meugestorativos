import { useState } from "react";
import { TrendingUp, Mail, Lock, UserPlus, LogIn } from "lucide-react";
import { loginWithGoogle, loginWithEmail, registerWithEmail } from "../firebase";

interface Props {
  onLogin: () => void;
}

export function FirebaseLogin({ onLogin }: Props) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [isRegister, setIsRegister] = useState(false);
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  async function handleGoogle() {
    setLoading(true);
    setError("");
    try {
      await loginWithGoogle();
      onLogin();
    } catch (e: any) {
      setError(e.message || "Erro ao fazer login com Google");
    }
    setLoading(false);
  }

  async function handleEmail(e: React.FormEvent) {
    e.preventDefault();
    setLoading(true);
    setError("");
    try {
      if (isRegister) {
        await registerWithEmail(email, password);
      } else {
        await loginWithEmail(email, password);
      }
      onLogin();
    } catch (e: any) {
      const msg = e.code?.includes("auth/email-already-in-use") ? "Email já cadastrado"
        : e.code?.includes("auth/invalid-email") ? "Email inválido"
        : e.code?.includes("auth/wrong-password") || e.code?.includes("auth/user-not-found") ? "Email ou senha incorretos"
        : e.code?.includes("auth/weak-password") ? "Senha fraca (mínimo 6 caracteres)"
        : e.message || "Erro ao fazer login";
      setError(msg);
    }
    setLoading(false);
  }

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center p-4">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm space-y-6">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="size-8 text-primary" />
        </div>
        <div className="text-center">
          <h1 className="text-xl font-bold">Gestor de Ativos</h1>
          <p className="text-sm text-muted mt-1">Portfólio de Investimentos</p>
        </div>

        <button
          onClick={handleGoogle}
          disabled={loading}
          className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl border border-border bg-surface hover:bg-card-hover text-sm font-medium transition-colors disabled:opacity-50"
        >
          <svg className="size-5" viewBox="0 0 24 24"><path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z"/><path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"/><path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"/><path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"/></svg>
          Entrar com Google
        </button>

        <div className="relative">
          <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-border" /></div>
          <div className="relative flex justify-center"><span className="bg-card px-3 text-xs text-muted">ou</span></div>
        </div>

        <form onSubmit={handleEmail} className="space-y-3">
          <div className="relative">
            <Mail className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface border border-border text-sm"
            />
          </div>
          <div className="relative">
            <Lock className="size-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted" />
            <input
              type="password" placeholder="Senha" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6}
              className="w-full pl-9 pr-3 py-2.5 rounded-xl bg-surface border border-border text-sm"
            />
          </div>
          {error && <p className="text-xs text-red-500">{error}</p>}
          <button type="submit" disabled={loading} className="w-full flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl bg-primary text-white text-sm font-medium hover:bg-primary-dark disabled:opacity-50 transition-colors">
            {isRegister ? <UserPlus className="size-4" /> : <LogIn className="size-4" />}
            {loading ? "Carregando..." : isRegister ? "Criar Conta" : "Entrar"}
          </button>
        </form>

        <div className="text-center">
          <button onClick={() => { setIsRegister(!isRegister); setError(""); }} className="text-xs text-primary hover:underline">
            {isRegister ? "Já tenho conta" : "Criar conta nova"}
          </button>
        </div>
      </div>
    </div>
  );
}
