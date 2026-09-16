// Présence : l'extension se déclare à l'app, et à elle seule.
//
// POURQUOI. L'app (companion.mines.paris) doit pouvoir dire « ton extension
// est installée et liée » sans attendre la première synchronisation, et sans
// jamais mentir dans l'autre sens : une page ne peut pas deviner qu'une
// extension est là. Le battement de présence (supabase.js) répond à la même
// question côté serveur, pour le tuteur ; celui-ci y répond côté navigateur,
// tout de suite, pour l'étudiant qui regarde sa page.
//
// CE QUI EST ANNONCÉ, et rien d'autre : la version, si l'extension est armée,
// si un compte est lié, l'identifiant de ce compte, l'identifiant d'appareil,
// l'heure de la dernière sync réussie, le nombre d'événements en attente et la
// raison d'un blocage. Ni adresse e-mail, ni jeton, ni contenu de prompt — la
// page qui lit ces valeurs est certes la nôtre, mais tout ce qui est posé dans
// le DOM est lisible par n'importe quel script de la page.
//
// PORTÉE. Ce script n'est injecté que sur l'origine de l'app (manifest,
// `host_permissions` + une entrée `content_scripts`). Les cinq sites d'IA ne
// le chargent pas : rien n'y est annoncé, l'extension y reste indétectable.
// En dev on ajoute `http://localhost:3200/*` à la main aux deux endroits —
// scripts/package.sh refuse alors d'empaqueter.

const CoachPresence = (() => {
  // Les seules clés lues, et les seules dont un changement redéclenche une
  // annonce. `session` en fait partie : c'est `user_id` qu'on en tire, jamais
  // les jetons qui l'accompagnent.
  const KEYS = ["session", "sessionExpired", "syncStatus", "deviceId", "disclosure"];

  // Fonction pure : c'est ELLE le contrat avec l'app (v: 1). Testée telle
  // quelle, sans DOM. Tout ce qui sort de l'extension passe par ici — une
  // clé ajoutée ici est une donnée de plus exposée à la page, à traiter
  // comme telle.
  function buildAnnouncement(data, version) {
    const d = data || {};
    const session = d.session || null;
    const sync = d.syncStatus || {};
    const disclosure = d.disclosure || null;
    return {
      v: 1,
      version: version || "0.0.0",
      // « Armée » : la divulgation a été acceptée. Une extension installée mais
      // restée en veille ne capture rien, et l'app doit pouvoir le dire.
      active: Boolean(disclosure && disclosure.accepted),
      paired: Boolean(session && session.user_id),
      userId: (session && session.user_id) || null,
      deviceId: d.deviceId || null,
      lastSyncAt: sync.lastOkAt ? new Date(sync.lastOkAt).toISOString() : null,
      pending: typeof sync.pending === "number" ? sync.pending : 0,
      // Une session expirée n'est pas un blocage de sync comme un autre : sans
      // ce repli, l'app afficherait « rien à signaler » à quelqu'un qui doit
      // relier son compte.
      syncReason: sync.reason || (d.sessionExpired ? "session_expired" : null),
    };
  }

  function manifestVersion() {
    try {
      return chrome.runtime.getManifest().version || "0.0.0";
    } catch {
      return "0.0.0";
    }
  }

  // Trois canaux, parce qu'aucun ne suffit seul :
  //  * l'attribut, pour une page qui se charge APRÈS nous (elle lit, point) ;
  //  * l'événement, pour une page déjà chargée (React qui s'abonne) ;
  //  * postMessage, pour le cas où la page interroge sans savoir si on est là.
  // `detail` est la CHAÎNE JSON, jamais un objet : un objet fabriqué dans le
  // monde isolé du content script arrive en `null` côté page.
  function announce(json) {
    const root = typeof document !== "undefined" && document.documentElement;
    if (root) root.setAttribute("data-ibe3-extension", json);
    document.dispatchEvent(new CustomEvent("ibe3:extension", { detail: json }));
    post(json);
  }

  function post(json) {
    // Origine explicite : jamais "*". Ce message ne doit voyager que dans
    // l'onglet de l'app.
    window.postMessage({ source: "ibe3-extension", type: "status", payload: json }, location.origin);
  }

  function install() {
    try {
      let last = null;

      const read = () => {
        chrome.storage.local.get(KEYS, (data) => {
          try {
            last = JSON.stringify(buildAnnouncement(data, manifestVersion()));
            announce(last);
          } catch (e) {
            /* page en train de disparaître, contexte invalidé : rien à faire */
          }
        });
      };

      chrome.storage.onChanged.addListener((changes, area) => {
        if (area && area !== "local") return;
        if (!KEYS.some((k) => k in changes)) return;
        read();
      });

      window.addEventListener("message", (event) => {
        // Les deux gardes, dans cet ordre : un message venu d'une iframe ou
        // d'une autre origine n'a rien à faire ici.
        if (event.source !== window || event.origin !== location.origin) return;
        const msg = event.data;
        if (!msg || msg.source !== "ibe3-companion" || msg.type !== "status?") return;
        if (last) post(last);
        else read();
      });

      // Le popup et l'onboarding pingent TOUS les onglets couverts par un
      // content script pour détecter ceux ouverts avant l'installation
      // (src/stale-tabs.js). Sans cette réponse, l'onglet de l'app ferait
      // afficher « recharge tes onglets IA » à tort.
      chrome.runtime.onMessage.addListener((msg, _sender, sendResponse) => {
        if (msg && msg.type === "coach-ping") {
          sendResponse({ ok: true });
          return true;
        }
      });

      read();

      // À `document_start`, `documentElement` peut ne pas encore exister : la
      // première annonce serait alors muette côté attribut.
      if (!document.documentElement) {
        document.addEventListener("DOMContentLoaded", () => last && announce(last), { once: true });
      }
    } catch (e) {
      // « Extension context invalidated » après une mise à jour : l'onglet
      // survit, notre contexte non. Se taire est la seule conduite utile.
    }
  }

  return { buildAnnouncement, install };
})();

// Dans une page : on s'installe. Sous node (tests) : le module est juste lu.
if (typeof document !== "undefined" && typeof chrome !== "undefined") CoachPresence.install();
