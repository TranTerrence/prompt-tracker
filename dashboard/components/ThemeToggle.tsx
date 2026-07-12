"use client";

import { useEffect, useSyncExternalStore } from "react";

type Pref = "light" | "dark" | "system";

const ORDER: Pref[] = ["light", "dark", "system"];

const LABELS: Record<Pref, string> = {
  light: "clair",
  dark: "sombre",
  system: "système",
};

function resolve(pref: Pref): "light" | "dark" {
  if (pref === "system") {
    return window.matchMedia("(prefers-color-scheme: dark)").matches
      ? "dark"
      : "light";
  }
  return pref;
}

function readPref(): Pref {
  const m = document.cookie.match(/(?:^|; )theme=([^;]+)/);
  let v: string | null = m ? decodeURIComponent(m[1]) : null;
  if (!v) {
    try {
      v = localStorage.getItem("theme-pref");
    } catch {
      v = null;
    }
  }
  return v === "dark" || v === "system" ? v : "light";
}

// Petit store externe : la préférence vit dans le cookie/localStorage,
// useSyncExternalStore la lit sans décalage d'hydratation (le serveur
// affiche « light », le client se resynchronise juste après).
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function writePref(next: Pref) {
  document.documentElement.dataset.theme = resolve(next);
  document.cookie = `theme=${next}; path=/; max-age=31536000; SameSite=Lax`;
  try {
    localStorage.setItem("theme-pref", next);
  } catch {
    // stockage indisponible : le cookie suffit
  }
  listeners.forEach((l) => l());
}

function SunIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" className="h-4 w-4" aria-hidden>
      <circle cx="12" cy="12" r="4" />
      <path d="M12 3v2M12 19v2M4.6 4.6l1.4 1.4M18 18l1.4 1.4M3 12h2M19 12h2M4.6 19.4L6 18M18 6l1.4-1.4" />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <path d="M20.6 14.4A8.6 8.6 0 0 1 9.6 3.4a8.6 8.6 0 1 0 11 11Z" />
    </svg>
  );
}

function SystemIcon() {
  return (
    <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" className="h-4 w-4" aria-hidden>
      <rect x="3" y="4.5" width="18" height="13" rx="2" />
      <path d="M9 20.5h6" />
    </svg>
  );
}

/**
 * Bouton de thème : clair → sombre → système.
 * Persiste la préférence dans un cookie (lu par le layout serveur)
 * et dans localStorage, et applique le thème résolu sur <html>.
 */
export default function ThemeToggle() {
  const pref = useSyncExternalStore(subscribe, readPref, () => "light" as Pref);

  // En mode « système », suit les changements de préférence de l'OS.
  useEffect(() => {
    if (pref !== "system") return;
    const mq = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => {
      document.documentElement.dataset.theme = resolve("system");
    };
    mq.addEventListener("change", onChange);
    return () => mq.removeEventListener("change", onChange);
  }, [pref]);

  const next = ORDER[(ORDER.indexOf(pref) + 1) % ORDER.length];

  return (
    <button
      type="button"
      onClick={() => writePref(next)}
      title={`Thème : ${LABELS[pref]} : cliquer pour passer en ${LABELS[next]}`}
      aria-label={`Thème : ${LABELS[pref]} : passer en ${LABELS[next]}`}
      className="flex h-8 w-8 items-center justify-center rounded-lg border border-card-border text-muted transition-colors hover:bg-soft hover:text-foreground"
    >
      {pref === "light" ? <SunIcon /> : pref === "dark" ? <MoonIcon /> : <SystemIcon />}
    </button>
  );
}
