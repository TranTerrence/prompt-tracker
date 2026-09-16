// Logique de la bibliothèque de prompts, PURE : ni DOM, ni chrome.*, ni
// réseau. Elle est partagée par quatre consommateurs qui ne se voient pas :
// le sélecteur dans la page (src/picker.js), le panneau du popup
// (popup/popup.js), le worker (src/background.js, pour la liste des récents)
// et les tests Node. Avant la 1.0.3, la recherche et le tri vivaient dans le
// popup et une copie du tri dans la modale : deux endroits qui pouvaient
// diverger sans que rien ne le dise. Ils vivent ici, une fois.
//
// Ce fichier décide ce que l'étudiant VOIT (groupes, ordre, filtre) et ce qui
// est ÉCRIT dans son composeur (fusion avec le brouillon). Il ne décide jamais
// d'envoyer : aucun appelant n'y trouvera de quoi le faire.

const CoachLibrary = (() => {
  // Dix récents : assez pour retrouver le prompt d'hier, pas assez pour que
  // le groupe « Récents » avale la liste. Même plafond que l'app.
  const RECENT_MAX = 10;

  // Ordre d'affichage des groupes. Un prompt n'apparaît qu'UNE fois, dans le
  // premier groupe qui le prend : un favori récemment inséré reste un favori,
  // il ne se dédouble pas dans « Récents ».
  const GROUPS = ["starred", "recent", "official", "peer"];

  // Recherche insensible aux accents et à la casse : « redaction » doit
  // trouver « rédaction », et « Eleve » « élève ». NFD sépare la lettre de
  // son diacritique, la plage U+0300-036F retire le diacritique.
  function normSearch(s) {
    return String(s || "").toLowerCase().normalize("NFD").replace(/[̀-ͯ]/g, "");
  }

  function tokens(query) {
    return normSearch(query).split(/\s+/).filter(Boolean);
  }

  // Chaque jeton de la requête doit se trouver quelque part dans le titre, le
  // corps, la catégorie ou l'auteur (ET, pas OU) : « dissertation plan »
  // cible, il n'élargit pas. Une requête vide laisse tout passer.
  function matches(p, query) {
    const q = tokens(query);
    if (!q.length) return true;
    const hay = normSearch(`${p.title || ""} ${p.body || ""} ${p.category || ""} ${p.author || ""}`);
    return q.every((tok) => hay.includes(tok));
  }

  // Même tri que la modale et le popup avaient chacun de leur côté : les
  // pré-prompts officiels devant, puis les plus repris. Copie, jamais en
  // place : la liste en mémoire du content script est partagée.
  function sortLibrary(prompts) {
    return (Array.isArray(prompts) ? [...prompts] : []).sort((a, b) => {
      if (a.kind !== b.kind) return a.kind === "official" ? -1 : 1;
      return (b.copies || 0) - (a.copies || 0);
    });
  }

  function toSet(ids) {
    if (ids instanceof Set) return ids;
    return new Set(Array.isArray(ids) ? ids.filter((id) => typeof id === "string") : []);
  }

  // { prompts, starred (ids), recent (ids, le plus récent en tête), query }
  //   → [{ key, items }], groupes vides omis.
  // Les ids inconnus (favori d'un prompt retiré, récent d'un autre flux) sont
  // ignorés sans bruit : les favoris viennent de la base, les récents du
  // storage, la bibliothèque du réseau — rien ne garantit qu'ils se
  // recouvrent, et ce n'est pas à l'étudiant de le voir.
  function groupLibrary({ prompts, starred, recent, query } = {}) {
    const all = sortLibrary(prompts);
    if (!all.length) return [];
    const byId = new Map(all.map((p) => [p.id, p]));
    const taken = new Set();
    const take = (p) => {
      if (!p || taken.has(p.id)) return null;
      taken.add(p.id);
      return p;
    };

    const starredSet = toSet(starred);
    const buckets = {
      starred: all.filter((p) => starredSet.has(p.id)).map(take).filter(Boolean),
      recent: (Array.isArray(recent) ? recent : []).map((id) => take(byId.get(id))).filter(Boolean),
      official: all.filter((p) => p.kind !== "peer").map(take).filter(Boolean),
      peer: all.filter((p) => p.kind === "peer").map(take).filter(Boolean),
    };

    const out = [];
    for (const key of GROUPS) {
      const items = buckets[key].filter((p) => matches(p, query));
      if (items.length) out.push({ key, items });
    }
    return out;
  }

  // L'ordre clavier (↑/↓) est l'ordre d'affichage, groupes confondus.
  function flatten(groups) {
    return (Array.isArray(groups) ? groups : []).flatMap((g) => g.items || []);
  }

  // Ce qui sera écrit dans le composeur. Un composeur vide reçoit le corps
  // seul ; un brouillon est GARDÉ et le corps vient après une ligne vide.
  // Écraser un brouillon sans annulation possible est la seule chose que ce
  // sélecteur ne doit jamais faire. Les blancs de fin sont retirés des deux
  // côtés ; ceux de tête du corps restent (un prompt peut être indenté).
  function mergeInsert(current, body) {
    const draft = String(current || "").replace(/\s+$/, "");
    const text = String(body || "").replace(/\s+$/, "");
    if (!draft.trim()) return text;
    return `${draft}\n\n${text}`;
  }

  // « // » tapé dans un composeur vide, et rien d'autre. Le texte est celui
  // du composeur APRÈS l'événement `input` ; inputType absent (Event
  // générique d'un textarea) ou "insertText" (frappe) sont les seuls
  // déclencheurs : collage, annulation, autocorrection et composition IME
  // portent un autre inputType et ne doivent jamais ouvrir. Un seul slash est
  // le menu du site, pas le nôtre.
  function slashTrigger(ev) {
    if (!ev || typeof ev.text !== "string") return false;
    if (ev.isComposing) return false;
    if (ev.inputType !== undefined && ev.inputType !== null && ev.inputType !== "insertText") return false;
    return ev.text.trim() === "//";
  }

  // Nouvelle liste : l'id en tête, une seule fois, plafonnée. Ne mute pas.
  function pushRecent(list, id) {
    const base = (Array.isArray(list) ? list : []).filter((x) => typeof x === "string");
    if (typeof id !== "string" || !id) return base.slice(0, RECENT_MAX);
    return [id, ...base.filter((x) => x !== id)].slice(0, RECENT_MAX);
  }

  // Seuls les ids Postgres appellent la RPC de comptage : un flux publié par
  // une organisation peut porter des slugs (ou les « p0 » fabriqués par
  // normalizeLibrary), que la base ne connaît pas.
  function isUuid(id) {
    return typeof id === "string" && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(id);
  }

  // Corde affichée dans l'infobulle de la pastille. Un content script ne peut
  // pas lire chrome.commands : on montre la corde SUGGÉRÉE par le manifest,
  // selon la plateforme ; l'utilisateur peut l'avoir changée dans
  // chrome://extensions/shortcuts, et c'est là qu'on l'envoie s'il la cherche.
  function shortcutLabel(platform) {
    return /Mac|iPhone|iPad|iPod/.test(String(platform || "")) ? "⌘⇧." : "Ctrl+Shift+.";
  }

  return {
    normSearch,
    matches,
    sortLibrary,
    groupLibrary,
    flatten,
    mergeInsert,
    slashTrigger,
    pushRecent,
    isUuid,
    shortcutLabel,
    RECENT_MAX,
    GROUPS,
  };
})();

if (typeof self !== "undefined") self.CoachLibrary = CoachLibrary;
