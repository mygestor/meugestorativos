import { useState } from "react";
import { Lock, X } from "lucide-react";

const CORRECT_PASSWORD = "Castro14";

interface Props {
  action: string;
  onConfirm: () => void;
  onCancel: () => void;
}

export function PasswordConfirm({ action, onConfirm, onCancel }: Props) {
  const [password, setPassword] = useState("");
  const [error, setError] = useState(false);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (password === CORRECT_PASSWORD) {
      onConfirm();
    } else {
      setError(true);
      setPassword("");
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center bg-black/60 backdrop-blur-sm">
      <div className="dialog-enter bg-card border border-border rounded-t-2xl sm:rounded-2xl w-full sm:max-w-sm sm:mx-4 mx-0 p-5">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 bg-yellow-500/10 rounded-xl">
            <Lock className="size-4 text-yellow-500" />
          </div>
          <div className="flex-1">
            <h3 className="font-semibold text-sm">Confirmação de Segurança</h3>
            <p className="text-xs text-muted">{action}</p>
          </div>
          <button onClick={onCancel} className="p-1.5 rounded-lg hover:bg-surface text-muted transition-colors">
            <X className="size-4" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="password"
            value={password}
            onChange={(e) => { setPassword(e.target.value); setError(false); }}
            placeholder="Digite a senha"
            autoFocus
            className="w-full px-3 py-2 bg-surface border border-border rounded-xl text-sm focus:outline-none focus:border-primary transition-colors"
          />
          {error && <p className="text-xs text-red-500">Senha incorreta</p>}
          <div className="flex gap-2">
            <button type="button" onClick={onCancel} className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-surface text-muted hover:text-foreground transition-colors">
              Cancelar
            </button>
            <button type="submit" className="flex-1 px-4 py-2.5 rounded-xl text-sm font-medium bg-primary text-white hover:bg-primary-dark transition-colors">
              Confirmar
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
