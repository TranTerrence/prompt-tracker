// Design system « éditorial calme » de Prompt Tracker, partagé par toutes les
// surfaces injectées (modale, toast, badge). Light par défaut ; l'utilisateur
// choisit light / dark / système dans le popup (settings.theme).
// L'accent reste 100 % white-label : injecté par l'organisation, sinon sauge.

const CoachTheme = (() => {
  const PALETTES = {
    light: {
      bg: "#FAF7F0",
      surface: "#FFFFFF",
      soft: "#F1EBE0",
      ink: "#1B1815",
      muted: "#6E655A",
      border: "#E5DED2",
      overlay: "rgba(27, 24, 21, .38)",
      shadow: "0 10px 30px rgba(27, 24, 21, .14)",
      shadowSoft: "0 4px 14px rgba(27, 24, 21, .10)",
    },
    dark: {
      bg: "#161311",
      surface: "#211D19",
      soft: "#2A251F",
      ink: "#F3EEE6",
      muted: "#9A9084",
      border: "#3A342C",
      overlay: "rgba(10, 8, 6, .55)",
      shadow: "0 10px 30px rgba(0, 0, 0, .5)",
      shadowSoft: "0 4px 14px rgba(0, 0, 0, .4)",
    },
  };

  const DEFAULT_ACCENT = "#3E5C50"; // vert sauge : remplacé par la marque de l'org

  // Typographie côté pages hôtes : piles système raffinées, aucun chargement
  // de fonte dans ChatGPT/Claude/Gemini (fiabilité + perfs). Les fontes
  // bundlées (Fraunces/Plex) sont réservées au popup et à l'onboarding.
  const DISPLAY_FONT = `"Iowan Old Style", "Palatino", "Palatino Linotype", Georgia, serif`;
  const TEXT_FONT = `"Avenir Next", "Avenir", "Segoe UI", "Helvetica Neue", sans-serif`;

  let setting = "light"; // 'light' | 'dark' | 'system'

  function set(themeSetting) {
    setting = themeSetting || "light";
  }

  function current() {
    if (setting === "dark") return "dark";
    if (setting === "system") {
      return window.matchMedia && window.matchMedia("(prefers-color-scheme: dark)").matches ? "dark" : "light";
    }
    return "light";
  }

  // Variables CSS à injecter en tête des <style> de chaque Shadow DOM.
  function vars(accent) {
    const p = PALETTES[current()];
    return `
      --bg: ${p.bg}; --surface: ${p.surface}; --soft: ${p.soft};
      --ink: ${p.ink}; --muted: ${p.muted}; --border: ${p.border};
      --overlay: ${p.overlay}; --shadow: ${p.shadow}; --shadow-soft: ${p.shadowSoft};
      --accent: ${accent || DEFAULT_ACCENT};
      --font-display: ${DISPLAY_FONT}; --font-text: ${TEXT_FONT};
    `;
  }

  return { set, current, vars, DEFAULT_ACCENT, DISPLAY_FONT, TEXT_FONT };
})();
