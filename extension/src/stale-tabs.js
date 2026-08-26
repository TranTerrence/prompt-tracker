// Onglets IA ouverts AVANT l'installation (ou avant une mise à jour) : Chrome
// n'y injecte pas les content_scripts. L'utilisateur tape son prompt, rien ne
// se passe, et il conclut que l'extension est cassée. Un F5 suffit — encore
// faut-il le lui dire.
//
// Il n'existe aucun moyen de connaître l'heure de chargement d'un onglet. On
// interroge donc chaque onglet, et L'ABSENCE DE RÉPONSE EST LE DIAGNOSTIC :
// content.js répond « coach-ping », un onglet périmé n'a personne pour le
// faire. C'est la vérité terrain, pas un drapeau posé en storage qu'il
// faudrait ensuite périmer, réparer et resynchroniser.
//
// AUCUNE PERMISSION NOUVELLE. Les `matches` des content_scripts accordent déjà
// les permissions d'hôte sur les cinq sites : le filtre `url` de tabs.query et
// tabs.sendMessage en découlent, et tabs.reload n'en demande aucune.

const CoachStaleTabs = (() => {
  // La liste des sites vient du manifest, jamais d'une constante recopiée ici :
  // ajouter un adaptateur ne doit pas obliger à penser à ce fichier.
  function matchPatterns() {
    try {
      const manifest = chrome.runtime.getManifest();
      return (manifest.content_scripts || []).flatMap((cs) => cs.matches || []);
    } catch {
      return [];
    }
  }

  // Un onglet qui ne répond pas est périmé. Un onglet qui répond est vivant.
  // Toute autre issue (erreur inattendue, API absente) est traitée comme
  // « vivant » : on préfère taire la bannière que la montrer à tort.
  function ping(tabId, cb) {
    try {
      chrome.tabs.sendMessage(tabId, { type: "coach-ping" }, (res) => {
        // Lire lastError est obligatoire, sinon Chrome journalise une erreur
        // non capturée à chaque onglet sans content script — c'est-à-dire dans
        // le cas NORMAL de cette fonction.
        const err = chrome.runtime.lastError;
        cb(!err && Boolean(res && res.ok));
      });
    } catch {
      cb(true);
    }
  }

  // cb(tabIds) : les onglets IA ouverts où le content script est absent.
  // Renvoie [] plutôt que de lever, dans tous les environnements dégradés :
  // Firefox avant l'octroi des permissions d'hôte, Safari, harnais de test.
  function list(cb) {
    const patterns = matchPatterns();
    if (!patterns.length || typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.query) {
      cb([]);
      return;
    }
    try {
      chrome.tabs.query({ url: patterns }, (found) => {
        if (chrome.runtime.lastError || !Array.isArray(found) || !found.length) {
          cb([]);
          return;
        }
        const stale = [];
        let pending = found.length;
        for (const tab of found) {
          ping(tab.id, (alive) => {
            if (!alive) stale.push(tab.id);
            if (--pending === 0) cb(stale);
          });
        }
      });
    } catch {
      cb([]);
    }
  }

  // Rechargement explicite, jamais automatique : recharger l'onglet de
  // quelqu'un sans le lui demander peut lui faire perdre un brouillon en cours.
  function reload(tabIds, cb) {
    const ids = Array.isArray(tabIds) ? tabIds : [];
    if (!ids.length || typeof chrome === "undefined" || !chrome.tabs || !chrome.tabs.reload) {
      if (cb) cb();
      return;
    }
    let pending = ids.length;
    for (const id of ids) {
      try {
        chrome.tabs.reload(id, {}, () => {
          void chrome.runtime.lastError; // onglet fermé entre-temps : sans effet
          if (--pending === 0 && cb) cb();
        });
      } catch {
        if (--pending === 0 && cb) cb();
      }
    }
  }

  return { list, reload, matchPatterns };
})();

if (typeof self !== "undefined") self.CoachStaleTabs = CoachStaleTabs;
