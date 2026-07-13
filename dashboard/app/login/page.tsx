"use client";

import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [info, setInfo] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setInfo(null);
    setLoading(true);
    const supabase = createClient();

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });
        if (error) {
          setError(error.message);
          return;
        }
        if (!data.session) {
          setInfo(
            "Compte créé. Vérifie ta boîte mail pour confirmer ton adresse, puis connecte-toi."
          );
          setMode("signin");
          return;
        }
      } else {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        });
        if (error) {
          setError(
            error.message === "Invalid login credentials"
              ? "Identifiants invalides."
              : error.message
          );
          return;
        }
      }

      // Redirection selon le rôle du profil.
      const {
        data: { user },
      } = await supabase.auth.getUser();
      if (!user) {
        setError("Connexion impossible, réessaie.");
        return;
      }
      const { data: profile } = await supabase
        .from("profiles")
        .select("role, org_id")
        .eq("id", user.id)
        .maybeSingle();

      if (!profile || !profile.org_id) {
        router.replace("/pending");
      } else if (profile.role === "admin") {
        router.replace("/admin");
      } else {
        router.replace("/me");
      }
      router.refresh();
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="flex flex-1 flex-col items-center justify-center gap-6 p-6">
      <div className="w-full max-w-sm rounded-2xl border border-card-border bg-card p-8 shadow-card">
        <div className="mb-8 text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-accent font-display text-lg font-semibold text-white">
            PT
          </div>
          <h1 className="font-display text-2xl font-semibold tracking-tight">
            Prompt Tracker
          </h1>
          <p className="mt-2 text-sm text-muted">
            {mode === "signin"
              ? "Connecte-toi à ton tableau de bord"
              : "Crée ton compte"}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm text-muted">
              Adresse e-mail
            </label>
            <input
              id="email"
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              placeholder="toi@entreprise.com"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="mb-1.5 block text-sm text-muted"
            >
              Mot de passe
            </label>
            <input
              id="password"
              type="password"
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-lg border border-card-border bg-background px-3 py-2 text-sm outline-none transition-colors focus:border-accent"
              placeholder="••••••••"
            />
          </div>

          {error && <p className="text-sm text-danger">{error}</p>}
          {info && <p className="text-sm text-success">{info}</p>}

          <button
            type="submit"
            disabled={loading}
            className="w-full rounded-lg bg-accent px-4 py-2.5 text-sm font-medium text-white transition hover:opacity-90 disabled:opacity-50"
          >
            {loading
              ? "Patiente…"
              : mode === "signin"
                ? "Se connecter"
                : "Créer le compte"}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-muted">
          {mode === "signin" ? (
            <>
              Pas encore de compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                }}
                className="font-medium text-accent hover:underline"
              >
                Inscris-toi
              </button>
            </>
          ) : (
            <>
              Déjà un compte ?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                }}
                className="font-medium text-accent hover:underline"
              >
                Connecte-toi
              </button>
            </>
          )}
        </p>
      </div>

      <p className="text-center text-xs text-muted">
        Le garde-fou de votre prompting ·{" "}
        <Link
          href="/install"
          className="font-medium text-accent hover:underline"
        >
          Installer l&apos;extension
        </Link>{" "}
        ·{" "}
        <Link href="/privacy" className="hover:text-foreground hover:underline">
          Politique de confidentialité
        </Link>
      </p>
    </main>
  );
}
