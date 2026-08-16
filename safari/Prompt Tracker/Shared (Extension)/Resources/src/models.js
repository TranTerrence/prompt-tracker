// Normalisation du modèle affiché par le site.
//
// LE PIÈGE QUE CE MODULE EXISTE POUR ÉVITER : le libellé lu dans la page peut
// contenir du texte écrit par un utilisateur. Un GPT personnalisé porte le nom
// que son auteur lui a donné — parfois un nom de client, parfois un sujet de
// thèse, parfois une adresse mail. Persister ce libellé brut réintroduirait du
// contenu par la porte de service, alors que la politique de confidentialité
// promet « jamais aucun contenu ».
//
// D'où la règle unique : normalize() ne renvoie JAMAIS ce qu'elle a lu. Elle
// renvoie soit un identifiant du catalogue, soit "autre", soit null. Aucun
// texte libre de la page ne peut sortir d'ici, ni vers le stockage local, ni
// vers la base, ni vers un journal.
//
// Module pur (aucune dépendance chrome) : testable en node.

const CoachModels = (() => {
  // Version du catalogue. À incrémenter à CHAQUE modification de CATALOG.
  // Elle est stockée avec la mesure : un pic de "autre" qui disparaît au bump
  // suivant était du retard de catalogue ; un pic qui persiste est du vrai
  // usage d'agent personnalisé. Même esprit que scoringVersion.
  const VERSION = 1;

  // Ordre = priorité, du plus spécifique au plus général : « gpt-5.1 » doit
  // être testé avant « gpt-5 », sinon il ne sera jamais atteint.
  //
  // ⚠️ Catalogue à compléter par sonde manuelle des sélecteurs de modèle de
  // chaque site (cf. probeSelectors() plus bas). Les éditeurs publient vite :
  // un modèle absent d'ici n'est pas perdu, il est compté "autre".
  const CATALOG = {
    chatgpt: [
      ["gpt-5.1", /\bgpt[\s._-]?5\.1\b/i],
      ["gpt-5-pro", /\bgpt[\s._-]?5\s*pro\b/i],
      ["gpt-5-thinking", /\bgpt[\s._-]?5\s*(thinking|reasoning)\b/i],
      ["gpt-5", /\bgpt[\s._-]?5\b/i],
      ["gpt-4.5", /\bgpt[\s._-]?4\.5\b/i],
      ["gpt-4.1", /\bgpt[\s._-]?4\.1\b/i],
      ["gpt-4o", /\bgpt[\s._-]?4o\b/i],
      ["o4-mini", /\bo4[\s._-]?mini\b/i],
      ["o3", /\bo3\b/i],
    ],
    claude: [
      ["opus-4.5", /\bopus\s*4\.5\b/i],
      ["opus-4.1", /\bopus\s*4\.1\b/i],
      ["opus-4", /\bopus\s*4\b/i],
      ["sonnet-4.5", /\bsonnet\s*4\.5\b/i],
      ["sonnet-4", /\bsonnet\s*4\b/i],
      ["sonnet-3.7", /\bsonnet\s*3\.7\b|\b3\.7\s*sonnet\b/i],
      ["haiku-4.5", /\bhaiku\s*4\.5\b/i],
      ["haiku", /\bhaiku\b/i],
      ["opus", /\bopus\b/i],
      ["sonnet", /\bsonnet\b/i],
    ],
    gemini: [
      ["gemini-3-pro", /\b(gemini\s*)?3\s*pro\b/i],
      ["gemini-3-flash", /\b(gemini\s*)?3\s*flash\b/i],
      ["gemini-2.5-pro", /\b2\.5\s*pro\b/i],
      ["gemini-2.5-flash", /\b2\.5\s*flash\b/i],
      ["deep-research", /\bdeep\s*research\b/i],
    ],
    mistral: [
      ["magistral", /\bmagistral\b/i],
      ["mistral-large", /\blarge\b/i],
      ["mistral-medium", /\bmedium\b/i],
      ["mistral-small", /\bsmall\b/i],
    ],
    grok: [
      ["grok-4.1", /\bgrok[\s._-]?4\.1\b/i],
      ["grok-4-heavy", /\bgrok[\s._-]?4\s*heavy\b/i],
      ["grok-4", /\bgrok[\s._-]?4\b/i],
      ["grok-3", /\bgrok[\s._-]?3\b/i],
    ],
  };

  // Forme imposée aux identifiants : la base porte le même CHECK en défense en
  // profondeur (migration 0018). Un identifiant qui ne la respecte pas serait
  // rejeté à l'insertion — le test unitaire vérifie donc tout le catalogue.
  const ID_SHAPE = /^[a-z0-9][a-z0-9._-]{0,39}$/;

  // Longueur maximale lue. Au-delà, on ne cherche même pas : un libellé de
  // sélecteur de modèle est court ; un texte long est forcément autre chose.
  const MAX_RAW = 120;

  /**
   * @param {string} site  clé d'adaptateur (chatgpt, claude, …)
   * @param {string} raw   libellé brut lu dans la page
   * @returns {string|null} identifiant du catalogue, "autre", ou null
   *
   * null  : rien de lisible (pas de sélecteur, nœud vide) → non mesurable.
   * "autre" : un libellé a été lu mais n'est pas au catalogue → soit un modèle
   *           trop récent, soit un agent personnalisé. Les deux cas se
   *           départagent après coup grâce à VERSION.
   */
  function normalize(site, raw) {
    if (typeof raw !== "string") return null;
    const text = raw.trim().slice(0, MAX_RAW);
    if (!text) return null;
    for (const [id, re] of CATALOG[site] || []) {
      if (re.test(text)) return id;
    }
    return "autre";
  }

  return { normalize, VERSION, CATALOG, ID_SHAPE };
})();

if (typeof self !== "undefined") self.CoachModels = CoachModels;
