"use client";

// Les deux jeux de consignes sont rendus côté serveur et passés en children :
// ce composant ne porte que l'onglet actif, pré-réglé d'après le User-Agent
// (lib/browser.ts) et toujours basculable à la main — la détection est
// grossière à dessein, le visiteur a le dernier mot.

import { useState, type ReactNode } from "react";

const TABS = [
  { id: "chromium", label: "Chrome & navigateurs Chromium" },
  { id: "firefox", label: "Firefox" },
] as const;

type TabId = (typeof TABS)[number]["id"];

export default function BrowserTabs({
  defaultTab,
  chromium,
  firefox,
}: {
  defaultTab: TabId;
  chromium: ReactNode;
  firefox: ReactNode;
}) {
  const [active, setActive] = useState<TabId>(defaultTab);

  return (
    <div className="space-y-8">
      <div
        role="tablist"
        aria-label="Consignes selon votre navigateur"
        className="flex flex-wrap gap-2"
      >
        {TABS.map((tab) => (
          <button
            key={tab.id}
            role="tab"
            aria-selected={active === tab.id}
            onClick={() => setActive(tab.id)}
            className={
              active === tab.id
                ? "rounded-lg bg-accent px-4 py-2 text-sm font-medium text-white"
                : "rounded-lg border border-card-border px-4 py-2 text-sm text-muted transition-colors hover:bg-soft hover:text-foreground"
            }
          >
            {tab.label}
          </button>
        ))}
      </div>
      <div role="tabpanel">{active === "chromium" ? chromium : firefox}</div>
    </div>
  );
}
