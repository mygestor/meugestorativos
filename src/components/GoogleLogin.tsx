import { useEffect, useRef, useState } from "react";
import { TrendingUp } from "lucide-react";

const AUTH_KEY = "gestor-google-auth";

export interface GoogleUser {
  name: string;
  email: string;
  picture: string;
}

export function getStoredUser(): GoogleUser | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}

export function logout() {
  localStorage.removeItem(AUTH_KEY);
  window.location.reload();
}

interface Props {
  clientId: string;
  onLogin: (user: GoogleUser) => void;
}

export function GoogleLogin({ clientId, onLogin }: Props) {
  const buttonRef = useRef<HTMLDivElement>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!buttonRef.current) return;

    const script = document.createElement("script");
    script.src = "https://accounts.google.com/gsi/client";
    script.async = true;
    script.onload = () => {
      if (window.google) {
        window.google.accounts.id.initialize({
          client_id: clientId,
          callback: (response: any) => {
            try {
              const payload = JSON.parse(atob(response.credential.split(".")[1]));
              const user: GoogleUser = {
                name: payload.name,
                email: payload.email,
                picture: payload.picture,
              };
              localStorage.setItem(AUTH_KEY, JSON.stringify(user));
              onLogin(user);
            } catch {
              alert("Erro ao autenticar com Google");
            }
          },
        });
        window.google.accounts.id.renderButton(buttonRef.current!, {
          theme: "outline",
          size: "large",
          width: 300,
          text: "signin_with",
          locale: "pt_BR",
        });
      }
      setLoading(false);
    };
    document.body.appendChild(script);

    return () => { document.body.removeChild(script); };
  }, [clientId, onLogin]);

  return (
    <div className="min-h-screen bg-surface flex items-center justify-center">
      <div className="bg-card border border-border rounded-2xl p-8 w-full max-w-sm text-center space-y-6">
        <div className="flex items-center justify-center gap-2">
          <TrendingUp className="size-8 text-primary" />
        </div>
        <div>
          <h1 className="text-xl font-bold">Gestor de Ativos</h1>
          <p className="text-sm text-muted mt-1">Portfólio de Investimentos</p>
        </div>
        <p className="text-xs text-muted">Faça login para acessar seu portfólio</p>
        <div className="flex justify-center">
          <div ref={buttonRef} />
        </div>
        {loading && <p className="text-xs text-muted">Carregando...</p>}
      </div>
    </div>
  );
}

declare global {
  interface Window {
    google?: {
      accounts: {
        id: {
          initialize: (config: any) => void;
          renderButton: (element: HTMLElement, config: any) => void;
        };
      };
    };
  }
}
