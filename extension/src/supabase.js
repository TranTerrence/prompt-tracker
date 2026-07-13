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
    if (!res.ok) throw new Error(data.msg || data.error_description || data.error || `HTTP ${res.status}`);
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
    return storage.set({ session }).then(() => session);
  }

  async function login(email, password) {
    return saveSession(await authRequest("token?grant_type=password", { email, password }));
  }

  async function signup(email, password) {
    const data = await authRequest("signup", { email, password });
    if (data.access_token) return saveSession(data);
    return null; // confirmation email requise
  }

  async function logout() {
    await storage.remove(["session", "orgConfig", "profile"]);
  }

  // Renvoie une session valide (rafraîchie si besoin) ou null.
  async function ensureSession() {
    const { session } = await storage.get("session");
    if (!session) return null;
    if (Date.now() < session.expires_at - 60000) return session;
    try {
      return await saveSession(await authRequest("token?grant_type=refresh_token", { refresh_token: session.refresh_token }));
    } catch {
      return null; // refresh token invalide → reconnexion nécessaire
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
    return res.status === 204 ? null : res.json();
  }

  // Télécharge profil + config de l'organisation → cache chrome.storage.local.
  // content.js lit orgConfig et l'applique en priorité sur les réglages locaux.
  async function refreshOrgConfig() {
    const session = await ensureSession();
    if (!session) return null;
    const profiles = await rest(
      `profiles?id=eq.${session.user_id}&select=org_id,role,disabled,organizations(name,brand_name,brand_color,logo_url,threshold,capture_mode,llm_enabled,intercept_enabled)`
    );
    const profile = profiles[0];
    if (!profile || !profile.org_id || profile.disabled) {
      await storage.set({ profile: profile || null, orgConfig: null });
      return null;
    }
    const templatesRows = await rest("socratic_templates?select=key,question&active=is.true");
    const templates = {};
    for (const row of templatesRows) templates[row.key] = row.question;
    const org = profile.organizations;
    const orgConfig = {
      orgId: profile.org_id,
      role: profile.role,
      branding: { name: org.brand_name || org.name, color: org.brand_color, logoUrl: org.logo_url },
      threshold: org.threshold,
      captureMode: org.capture_mode,
      interceptEnabled: org.intercept_enabled,
      llmEnabled: org.llm_enabled,
      templates,
    };
    await storage.set({ profile: { org_id: profile.org_id, role: profile.role }, orgConfig });
    return orgConfig;
  }

  // Rejoint une classe par son code : rattachement org + groupe, atomique
  // côté serveur (RPC security definer). Rafraîchit la config dans la foulée.
  async function joinGroup(code) {
    const data = await rest("rpc/join_group_with_code", { method: "POST", body: { p_code: code } });
    await refreshOrgConfig();
    return data; // { org_id, group_id, group_name, org_name }
  }

  // Pousse les événements non synchronisés (file offline). Idempotent grâce à
  // unique(user_id, client_event_id) + ignore-duplicates.
  async function syncEvents() {
    const session = await ensureSession();
    if (!session) return { pushed: 0, reason: "not_authenticated" };
    const { events = [], profile } = await storage.get(["events", "profile"]);
    if (!profile || !profile.org_id) return { pushed: 0, reason: "no_org" };
    const pending = events.filter((e) => !e.synced);
    if (!pending.length) return { pushed: 0 };

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
      text: e.text ?? null, // le trigger serveur l'efface si l'org est en mode metadata
    }));

    await rest("prompt_events?on_conflict=user_id,client_event_id", {
      method: "POST",
      body: rows,
      headers: { Prefer: "resolution=ignore-duplicates,return=minimal" },
    });

    const pushedIds = new Set(pending.map((e) => e.id));
    const updated = events.map((e) => (pushedIds.has(e.id) ? { ...e, synced: true } : e));
    await storage.set({ events: updated });
    return { pushed: pending.length };
  }

  // Prochaine question socratique générée par LLM à partir de tout le dialogue
  // (Edge Function). Timeout court : l'itération n'attend jamais le réseau :
  // repli sur la banque locale géré par l'appelant.
  async function llmNextQuestion(prompt, dialogue = [], timeoutMs = 2000) {
    const session = await ensureSession();
    if (!session) return null;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), timeoutMs);
    try {
      const res = await fetch(`${SUPABASE_URL}/functions/v1/socratic-llm`, {
        method: "POST",
        headers: { apikey: SUPABASE_KEY, Authorization: `Bearer ${session.access_token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ prompt, dialogue }),
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

  return { login, signup, logout, ensureSession, refreshOrgConfig, joinGroup, syncEvents, llmNextQuestion, SUPABASE_URL };
})();

if (typeof self !== "undefined") self.CoachApi = CoachApi;
