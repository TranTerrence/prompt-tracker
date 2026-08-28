// Client Supabase minimaliste (REST + Auth) sans dépendance : utilisable depuis
// le popup (balise script) et le service worker (importScripts).
// La clé publishable est publique par conception ; la sécurité repose sur RLS.

const CoachApi = (() => {
  const SUPABASE_URL = "https://ovbvwawzrciwpudnaysp.supabase.co";
  const SUPABASE_KEY = "sb_publishable_qWIkcDbQUoVqE9awpkyhKA_RdYnRUaa";

  const storage = {
    get: (keys) => new Promise((r) => chrome.storage.local.get(keys, r)),
    set: (obj) => new Promise((r) => chrome.storage.local.set(obj, r)),
    remove: (keys) => new Promise((r) => chrome.storage.local.remove(keys, r)),
  };

  async function authRequest(path, body) {
    const res = await fetch(`${SUPABASE_URL}/auth/v1/${path}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    const data = await res.json();
    if (!res.ok) {
      // Le STATUT compte : 400/401 est un refus définitif du jeton, un 5xx ou
      // une coupure réseau sont passagers. Sans lui, l'appelant ne peut pas
      // distinguer « reconnecte-toi » de « réessaie plus tard », et c'est
      // exactement ce qui a produit la boucle infinie corrigée plus bas.
      const err = new Error(data.msg || data.error_description || data.error || `HTTP ${res.status}`);
      err.status = res.status;
      err.code = data.error_code || data.error || null;
      throw err;
    }
    return data;
  }

  function saveSession(data) {
    const session = {
      access_token: data.access_token,
      refresh_token: data.refresh_token,
      expires_at: Date.now() + (data.expires_in || 3600) * 1000,
      user_id: data.user && data.user.id,
      email: data.user && data.user.email,
    };
    // Toute authentification réussie efface le marqueur d'expiration : c'est
    // le seul endroit où l'on redevient connecté, quel que soit le chemin
    // (mot de passe, inscription, appairage, rafraîchissement).
    return storage
      .set({ session })
      .then(() => storage.remove("sessionExpired"))
      .then(() => session);
  }

  async function login(email, password) {
    return saveSession(await authRequest("token?grant_type=password", { email, password }));
  }

  async function signup(email, password) {
    const data = await authRequest("signup", { email, password });
    if (data.access_token) return saveSession(data);
    return null; // confirmation email requise
  }

  // --- Appairage avec le web (device-code) --------------------------------
  // L'extension fabrique un secret et attend qu'une session AUTHENTIFIÉE, sur
  // le dashboard, l'approuve. Aucun mot de passe n'est saisi ici, et le sens
  // de circulation fait que connaître le code affiché ne suffit à rien.

  async function rpcAnon(fn, body) {
    const res = await fetch(`${SUPABASE_URL}/rest/v1/rpc/${fn}`, {
      method: "POST",
      headers: { apikey: SUPABASE_KEY, "Content-Type": "application/json" },
      body: JSON.stringify(body),
    });
    if (!res.ok) throw new Error(`rpc_${res.status}: ${await res.text()}`);
    return res.json();
  }

  // Indice d'appareil affiché à l'approbation : l'utilisateur doit reconnaître
  // SON navigateur. Grossier à dessein, il n'a pas vocation à identifier.
  function deviceHint() {
    const ua = (typeof navigator !== "undefined" && navigator.userAgent) || "";
    const browser = /Edg\//.test(ua) ? "Edge"
      : /OPR\//.test(ua) ? "Opera"
      : /Firefox\//.test(ua) ? "Firefox"
      : /Chrome\//.test(ua) ? "Chrome"
      : /Safari\//.test(ua) ? "Safari"
      : "Navigateur";
    const os = /Mac OS X/.test(ua) ? "macOS"
      : /Windows/.test(ua) ? "Windows"
      : /Linux/.test(ua) ? "Linux"
      : "";
    return os ? `${browser} sur ${os}` : browser;
  }

  async function startPairing() {
    const data = await rpcAnon("create_pairing_request", {
      p_hint: deviceHint(),
      // Le seau de limitation est calculé côté serveur à partir de l'IP pour
      // les routes web ; ici l'extension n'en a pas, on retombe sur un seau
      // global volontairement large.
      p_bucket: "extension",
    });
    await storage.set({ pairing: { deviceCode: data.device_code, userCode: data.user_code, expiresAt: data.expires_at } });
    return data;
  }

  // Interroge l'état, et si c'est approuvé, échange contre une vraie session.
  // Renvoie 'pending' | 'approved' | 'expired' | 'used'.
  async function pollPairing() {
    const { pairing } = await storage.get("pairing");
    if (!pairing) return "expired";
    const { status } = await rpcAnon("redeem_pairing", { p_device_code: pairing.deviceCode });
    if (status !== "approved") {
      if (status !== "pending") await storage.remove("pairing");
      return status;
    }

    // L'Edge Function détient la service_role : elle consomme la demande de
    // façon atomique et renvoie un token_hash à usage unique.
    // La clé publishable sert d'Authorization : c'est un JWT valide, ce qui
    // laisse la garde `verify_jwt` de la plateforme active devant la fonction.
    // Sans cet en-tête il faudrait la désactiver — on préfère garder le
    // filtrage au plus tôt. Le vrai contrôle d'accès reste le device_code,
    // qui n'a de valeur qu'associé à une approbation faite sur le web.
    const res = await fetch(`${SUPABASE_URL}/functions/v1/pair-extension`, {
      method: "POST",
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${SUPABASE_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ device_code: pairing.deviceCode }),
    });
    if (!res.ok) {
      await storage.remove("pairing");
      throw new Error("pairing_failed");
    }
    const { token_hash } = await res.json();

    // C'est l'extension qui échange le hash contre une session : le jeton
    // d'accès ne transite jamais par l'Edge Function.
    const session = await authRequest("verify", { type: "magiclink", token_hash });
    await saveSession(session);
    await storage.remove("pairing");
    await refreshOrgConfig();
    return "approved";
  }

  async function cancelPairing() {
    await storage.remove("pairing");
  }

  async function logout() {
    await storage.remove([
      "session", "orgConfig", "profile", "baselineConsent", "syncStatus", "pendingSignup", "pairing",
      "sessionExpired", "promptLibrary",
    ]);
  }

  // Attente croissante après un échec PASSAGER : 1 min, 5, 15, puis 1 h.
  // L'alarme de synchronisation bat toutes les minutes ; sans ce frein, une
  // coupure réseau d'une nuit produit des centaines de requêtes inutiles.
  const REFRESH_BACKOFF_MS = [60000, 300000, 900000, 3600000];

  // Un refus 400/401 sur un refresh token est DÉFINITIF : Supabase l'a révoqué
  // ou déjà consommé, le represénter ne le ressuscitera pas. Tout le reste —
  // coupure réseau (TypeError, sans statut), 5xx, 429 — est passager et ne doit
  // SURTOUT PAS déconnecter quelqu'un dont le wifi a hoqueté.
  function isDefinitiveAuthFailure(e) {
    return Boolean(e && (e.status === 400 || e.status === 401));
  }

  // Renvoie une session valide (rafraîchie si besoin) ou null.
  //
  // DÉFAUT CORRIGÉ, ne pas revenir en arrière : cette fonction retournait null
  // sans jamais purger la session morte. `expires_at` restait dans le passé,
  // donc chaque tick d'alarme retentait le même jeton révoqué, échouait, et
  // recommençait — indéfiniment. Mesuré en production le 25/08/2026 : 1134
  // requêtes `token?grant_type=refresh_token` en HTTP 400 sur 24 h, une par
  // minute, sans interruption, pour une installation qui ne synchronisait plus
  // rien. Purger est ce qui arrête la boucle ET ce qui rend le problème
  // visible : la bannière du popup propose alors la reconnexion.
  async function ensureSession() {
    const { session } = await storage.get("session");
    if (!session) return null;
    if (Date.now() < session.expires_at - 60000) return session;
    // Échec passager précédent : on attend l'échéance au lieu de marteler.
    if (session.retryAfter && Date.now() < session.retryAfter) return null;

    try {
      return await saveSession(
        await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token })
      );
    } catch (e) {
      if (isDefinitiveAuthFailure(e)) {
        // Le jeton est mort. On efface la session et on POSE un marqueur : sans
        // lui, le popup retomberait sur « pas connecté », qui est le mode
        // nominal d'un usage 100 % local et n'affiche donc aucune bannière.
        // Quelqu'un qui ÉTAIT connecté doit l'apprendre, pas glisser en silence.
        await storage.remove("session");
        await storage.set({ sessionExpired: { at: Date.now(), reason: e.code || "invalid_grant" } });
        return null;
      }
      const failures = (session.refreshFailures || 0) + 1;
      const wait = REFRESH_BACKOFF_MS[Math.min(failures - 1, REFRESH_BACKOFF_MS.length - 1)];
      await storage.set({
        session: { ...session, refreshFailures: failures, retryAfter: Date.now() + wait },
      });
      return null;
    }
  }

  async function rest(path, { method = "GET", body, headers = {} } = {}) {
    const session = await ensureSession();
    if (!session) throw new Error("not_authenticated");
    const res = await fetch(`${SUPABASE_URL}/rest/v1/${path}`, {
      method,
      headers: {
        apikey: SUPABASE_KEY,
        Authorization: `Bearer ${session.access_token}`,
        "Content-Type": "application/json",
        ...headers,
      },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) throw new Error(`rest_${res.status}: ${await res.text()}`);
    // Un succès sans corps n'est pas toujours un 204 : PostgREST répond 201
    // vide aux POST `Prefer: return=minimal` (sync, consentements). Décider
    // sur le corps, pas sur le statut.
    const text = await res.text();
    return text ? JSON.parse(text) : null;
  }

  // Miroir local du consentement socle porté par profiles.baseline_consent_at.
  // SEUL écrivain de la clé `baselineConsent` : la vérité est en base, ici on
  // ne fait que la recopier pour que la sync puisse décider hors-ligne.
  async function mirrorBaselineConsent(profile) {
    const serverAt = profile && profile.baseline_consent_at;
    if (serverAt) {
      await storage.set({ baselineConsent: { accepted: true, source: "server", acceptedAt: serverAt } });
      return serverAt;
    }
    // Reprise des versions antérieures au correctif : le drapeau local était
    // écrit par l'écran de divulgation du popup, c'est un accord réel. On le
    // remonte en base au lieu de le perdre (ce serait redemander à quelqu'un
    // qui a déjà dit oui). Une seule fois : ensuite source vaut "server".
    const { baselineConsent: local } = await storage.get("baselineConsent");
    if (local && local.accepted && local.source !== "server" && profile && profile.org_id) {
      try {
        const at = await rest("rpc/ack_baseline_consent", { method: "POST", body: { p_version: 1 } });
        await storage.set({ baselineConsent: { accepted: true, source: "server", acceptedAt: at } });
        return at;
      } catch {
        return local.acceptedAt || null; // hors-ligne : on retentera au prochain refresh
      }
    }
    await storage.set({ baselineConsent: null });
    return null;
  }

  // Accepte le socle a posteriori (compte rattaché par un admin, ou reprise
  // d'un compte antérieur au correctif). Appelé par la bannière du popup.
  async function ackBaselineConsent() {
    const at = await rest("rpc/ack_baseline_consent", { method: "POST", body: { p_version: 1 } });
    await storage.set({ baselineConsent: { accepted: true, source: "server", acceptedAt: at } });
    return at;
  }

  // Télécharge profil + config de l'organisation → cache chrome.storage.local.
  // content.js lit orgConfig et l'applique en priorité sur les réglages locaux.
  async function refreshOrgConfig() {
    const session = await ensureSession();
    if (!session) return null;
    const profiles = await rest(
      `profiles?id=eq.${session.user_id}&select=org_id,role,disabled,baseline_consent_at,organizations(name,brand_name,brand_color,logo_url,threshold,capture_mode,llm_enabled,intercept_enabled,show_score,library_url)`
    );
    const profile = profiles[0];
    // Le consentement socle est un fait d'organisation : il vient du serveur,
    // quel que soit le chemin de jonction (web, invitation, popup). C'est ce
    // miroir qui garantit qu'aucun chemin ne peut l'oublier ; rien d'autre
    // n'écrit baselineConsent.
    await mirrorBaselineConsent(profile);
    if (!profile || !profile.org_id || profile.disabled) {
      await storage.set({ profile: profile || null, orgConfig: null });
      return null;
    }
    const [templatesRows, requestRows, consentRows] = await Promise.all([
      rest("socratic_templates?select=key,question&active=is.true"),
      rest("org_data_requests?select=category,requested,purpose"),
      rest(`consents?user_id=eq.${session.user_id}&select=category,granted`),
    ]);
    const templates = {};
    for (const row of templatesRows) templates[row.key] = row.question;
    // Ce que l'org demande (catégorie → {requested, purpose}) et ce que
    // l'utilisateur a accordé (catégorie → bool). L'envoi d'un contenu exige
    // demandé ET consenti (voir syncEvents) ; le serveur re-vérifie (trigger).
    const dataRequests = {};
    for (const row of requestRows) dataRequests[row.category] = { requested: row.requested, purpose: row.purpose };
    const consents = {};
    for (const row of consentRows) consents[row.category] = row.granted;
    const org = profile.organizations;
    const orgConfig = {
      orgId: profile.org_id,
      role: profile.role,
      branding: { name: org.brand_name || org.name, color: org.brand_color, logoUrl: org.logo_url },
      threshold: org.threshold,
      captureMode: org.capture_mode,
      interceptEnabled: org.intercept_enabled,
      llmEnabled: org.llm_enabled,
      // Affichage du score : l'organisation peut le couper pour tous ses
      // membres. Rien ne change côté mesure ni côté API — c'est l'écran qui
      // se tait. Un serveur qui n'a pas encore la colonne renvoie undefined :
      // le défaut « on affiche » vaut alors, ce qui est le comportement
      // historique et le seul sûr pour les organisations existantes.
      showScore: org.show_score !== false,
      // URL de la bibliothèque de prompts publiée par l'organisation, ou null.
      libraryUrl: org.library_url || null,
      templates,
      dataRequests,
    };
    await storage.set({ profile: { org_id: profile.org_id, role: profile.role }, orgConfig, consents });
    return orgConfig;
  }

  // Enregistre les choix de consentement (upsert + journal côté serveur).
  async function setConsents(choices) {
    const session = await ensureSession();
    if (!session) throw new Error("not_authenticated");
    const rows = Object.entries(choices).map(([category, granted]) => ({
      user_id: session.user_id,
      category,
      granted: Boolean(granted),
    }));
    await rest("consents?on_conflict=user_id,category", {
      method: "POST",
      body: rows,
      headers: { Prefer: "resolution=merge-duplicates,return=minimal" },
    });
    await storage.set({ consents: choices });
    return choices;
  }

  // Droit à l'effacement : purge le contenu déjà partagé (jamais les indicateurs).
  async function purgeSharedContent() {
    return rest("rpc/purge_my_content", { method: "POST", body: {} });
  }

  // Rejoint une classe par son code : rattachement org + groupe, atomique
  // côté serveur (RPC security definer). L'écran de divulgation précède
  // toujours cet appel, d'où p_baseline_ack : l'accord est enregistré en base
  // dans la même transaction que le rattachement. Rafraîchit la config dans
  // la foulée (ce qui redescend baselineConsent depuis le serveur).
  async function joinGroup(code) {
    const data = await rest("rpc/join_group_with_code", {
      method: "POST",
      body: { p_code: code, p_baseline_ack: true },
    });
    await refreshOrgConfig();
    return data; // { org_id, group_id, group_name, org_name, baseline_consent_at }
  }

  // Pousse les événements non synchronisés (file offline). Idempotent grâce à
  // unique(user_id, client_event_id) + ignore-duplicates.
  // Minimisation à la source : un contenu (texte, dialogue, conversation) ne
  // QUITTE la machine que si l'org le demande ET que l'utilisateur a consenti.
  // Le trigger serveur enforce_consent re-vérifie (défense en profondeur).
  function buildSendAllowed(orgConfig, consents) {
    const requests = (orgConfig && orgConfig.dataRequests) || {};
    return (cat) => Boolean(requests[cat] && requests[cat].requested && consents && consents[cat]);
  }

  // Journal de synchronisation, écrit sur TOUS les chemins de sortie (y compris
  // les refus précoces et les erreurs réseau). C'est l'absence de ce journal
  // qui a laissé vivre le blocage `no_baseline_consent` : une sync qui ne part
  // pas doit être lisible, dans le popup et sur l'icône. Ne jamais ajouter un
  // `return` à syncEvents/syncPostEvents sans passer par ici.
  async function recordSync(patch) {
    const { events = [], postEvents = [], syncStatus: prev = {} } = await storage.get([
      "events",
      "postEvents",
      "syncStatus",
    ]);
    const waiting = [...events, ...postEvents].filter((e) => !e.synced);
    const blocked = Boolean(patch.reason || patch.error);
    const status = {
      at: Date.now(),
      pending: waiting.length,
      // Sert le message « N en attente depuis le … » : un blocage récent et un
      // blocage vieux de trois semaines n'appellent pas la même urgence.
      oldestPendingTs: waiting.reduce((min, e) => (!min || e.ts < min ? e.ts : min), null),
      reason: patch.reason || null,
      error: patch.error || null,
      pushed: patch.pushed || 0,
      lastOkAt: blocked ? prev.lastOkAt || null : Date.now(),
    };
    await storage.set({ syncStatus: status });
    return status;
  }

  async function syncEvents() {
    const session = await ensureSession();
    if (!session) {
      // « Jamais connecté » et « session expirée » appellent des messages
      // différents : le premier est le mode nominal d'un usage local, le
      // second est une régression que l'utilisateur doit voir.
      const { sessionExpired } = await storage.get("sessionExpired");
      const reason = sessionExpired ? "session_expired" : "not_authenticated";
      await recordSync({ reason });
      return { pushed: 0, reason };
    }
    const { events = [], profile, orgConfig, consents, baselineConsent } = await storage.get([
      "events",
      "profile",
      "orgConfig",
      "consents",
      "baselineConsent",
    ]);
    if (!profile || !profile.org_id) {
      await recordSync({ reason: "no_org" });
      return { pushed: 0, reason: "no_org" };
    }
    // Divulgation à la jonction : sans l'accord explicite « rejoindre et
    // partager ces indicateurs », rien ne quitte la machine, même le socle.
    // La vérité vient de profiles.baseline_consent_at, miroitée par
    // refreshOrgConfig ; l'alarme refresh-config la redescend en ≤ 15 min.
    if (!baselineConsent || !baselineConsent.accepted) {
      await recordSync({ reason: "no_baseline_consent" });
      return { pushed: 0, reason: "no_baseline_consent" };
    }
    // Une ligne poussée ne peut PLUS JAMAIS être corrigée (ignore-duplicates
    // plus bas). On retient donc les événements dont les mesures de réponse
    // peuvent encore arriver. Le verrou est une DATE portée par l'événement et
    // non un minuteur : il survit à la fermeture de l'onglet, à l'éviction du
    // service worker et au mode hors ligne, et c'est l'alarme suivante qui le
    // réévalue. Au pire la ligne part 150 s plus tard, sans ses mesures.
    const now = Date.now();
    const pending = events.filter(
      (e) => !e.synced && !(e.responsePending && now < (e.responseDeadline || 0))
    );
    if (!pending.length) {
      await recordSync({ pushed: 0 });
      return { pushed: 0 };
    }
    const sendAllowed = buildSendAllowed(orgConfig, consents);

    const rows = pending.map((e) => ({
      client_event_id: e.id,
      user_id: session.user_id,
      org_id: profile.org_id,
      ts: e.ts,
      site: e.site,
      category: e.category,
      words: e.words,
      scores: e.scores,
      intercepted: e.intercepted || false,
      outcome: e.outcome,
      score_before: e.scoreBefore,
      score_after: e.scoreAfter,
      mirror_shown: e.mirrorShown || false,
      mirror_feedback: e.mirrorFeedback,
      rounds: e.rounds || 0,
      answers_count: e.answersCount || 0,
      // Mesures post-réponse : des INDICATEURS, au même titre que les scores.
      // Le texte de la réponse n'est jamais lu au-delà de ces comptages, donc
      // aucune catégorie de consentement ne les conditionne.
      prompt_chars: e.promptChars ?? null,
      model: e.model ?? null,
      model_catalog_version: e.modelCatalogVersion ?? null,
      response_chars: e.responseChars ?? null,
      response_words: e.responseWords ?? null,
      latency_ms: e.latencyMs ?? null,
      response_ms: e.responseMs ?? null,
      turn_index: e.turnIndex ?? null,
      read_ms: e.readMs ?? null,
      response_outcome: e.responseOutcome ?? null,
      text: sendAllowed("prompt_text") ? (e.text ?? null) : null,
      dialogue: sendAllowed("socratic_dialogue") ? (e.dialogue ?? null) : null,
      conv_key: sendAllowed("conversation_history") ? (e.conv ?? null) : null,
    }));

    try {
      await rest("prompt_events?on_conflict=user_id,client_event_id", {
        method: "POST",
        body: rows,
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      });
    } catch (e) {
      // Hors-ligne, RLS, trigger de consentement : la file reste intacte et
      // sera repoussée à la prochaine alarme, mais l'échec devient lisible.
      await recordSync({ error: e.message });
      throw e;
    }

    // RELECTURE APRÈS LE POST, et non réutilisation du tableau lu avant :
    // le content script a pu écrire pendant l'aller-retour réseau (retour du
    // miroir, mesures de réponse). Réécrire l'ancien tableau effacerait ces
    // mutations — c'est le mécanisme par lequel des mirrorFeedback se
    // perdaient silencieusement.
    const pushedIds = new Set(pending.map((e) => e.id));
    const { events: fresh = [] } = await storage.get("events");
    await storage.set({ events: fresh.map((e) => (pushedIds.has(e.id) ? { ...e, synced: true } : e)) });
    await recordSync({ pushed: pending.length });
    return { pushed: pending.length };
  }

  // Pousse les réflexions du miroir d'après. Les indicateurs (répondu, nombre
  // de mots) sont le socle ; le texte n'est envoyé que si consenti.
  async function syncPostEvents() {
    const session = await ensureSession();
    if (!session) {
      // « Jamais connecté » et « session expirée » appellent des messages
      // différents : le premier est le mode nominal d'un usage local, le
      // second est une régression que l'utilisateur doit voir.
      const { sessionExpired } = await storage.get("sessionExpired");
      const reason = sessionExpired ? "session_expired" : "not_authenticated";
      await recordSync({ reason });
      return { pushed: 0, reason };
    }
    const { postEvents = [], profile, orgConfig, consents, baselineConsent } = await storage.get([
      "postEvents",
      "profile",
      "orgConfig",
      "consents",
      "baselineConsent",
    ]);
    if (!profile || !profile.org_id) {
      await recordSync({ reason: "no_org" });
      return { pushed: 0, reason: "no_org" };
    }
    if (!baselineConsent || !baselineConsent.accepted) {
      await recordSync({ reason: "no_baseline_consent" });
      return { pushed: 0, reason: "no_baseline_consent" };
    }
    const pending = postEvents.filter((e) => !e.synced);
    if (!pending.length) {
      await recordSync({ pushed: 0 });
      return { pushed: 0 };
    }
    const sendAllowed = buildSendAllowed(orgConfig, consents);

    const rows = pending.map((e) => ({
      client_event_id: e.id,
      user_id: session.user_id,
      org_id: profile.org_id,
      ts: e.ts,
      site: e.site,
      conv_key: sendAllowed("conversation_history") ? (e.conv ?? null) : null,
      post_key: e.postKey,
      category: e.category,
      answered: e.answered || false,
      answer_words: e.answerWords ?? null,
      answer: sendAllowed("post_reflection") ? (e.answer ?? null) : null,
    }));

    try {
      await rest("post_events?on_conflict=user_id,client_event_id", {
        method: "POST",
        body: rows,
        headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
      });
    } catch (e) {
      await recordSync({ error: e.message });
      throw e;
    }

    // Relecture après le POST, même raison que pour syncEvents : une réflexion
    // écrite pendant l'aller-retour réseau serait purement et simplement
    // effacée si on réécrivait le tableau lu avant l'appel.
    const pushedIds = new Set(pending.map((e) => e.id));
    const { postEvents: fresh = [] } = await storage.get("postEvents");
    await storage.set({ postEvents: fresh.map((e) => (pushedIds.has(e.id) ? { ...e, synced: true } : e)) });
    await recordSync({ pushed: pending.length });
    return { pushed: pending.length };
  }

  // Prochaine question socratique générée par LLM à partir de tout le dialogue
  // (Edge Function). Timeout court : l'itération n'attend jamais le réseau :
  // repli sur la banque locale géré par l'appelant.
  async function llmNextQuestion(prompt, dialogue = [], opts = {}, timeoutMs = 2000) {
    const session = await ensureSession();
    if (!session) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/socratic-llm`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        // opts : { lang, intent, rejected, askedQuestions, depth } : champs
        // additifs, l'edge function reste compatible avec les anciens clients.
        body: JSON.stringify({ prompt, dialogue, ...opts }),
        signal: controller.signal,
      });
      if (!res.ok) return null;
      const data = await res.json();
      return typeof data.question === "string" && data.question.trim() ? data.question : null;
    } catch {
      return null;
    } finally {
      clearTimeout(timer);
    }
  }

  return {
    login,
    signup,
    logout,
    ensureSession,
    startPairing,
    pollPairing,
    cancelPairing,
    refreshOrgConfig,
    ackBaselineConsent,
    joinGroup,
    setConsents,
    purgeSharedContent,
    syncEvents,
    syncPostEvents,
    llmNextQuestion,
    SUPABASE_URL,
  };
})();

if (typeof self !== "undefined") self.CoachApi = CoachApi;
