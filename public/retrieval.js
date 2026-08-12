const STOP_WORDS = new Set([
  "a", "an", "and", "are", "as", "at", "be", "can", "could", "do", "does", "for", "from",
  "how", "i", "if", "in", "is", "it", "me", "my", "of", "on", "or", "our", "please", "should",
  "tell", "the", "this", "to", "us", "we", "what", "when", "where", "which", "who", "with", "would"
]);

const EXPANSIONS = {
  "2fa": ["multi factor authentication", "mfa"],
  antivirus: ["malware protection", "anti malware", "endpoint protection"],
  backup: ["recovery", "restore", "retention", "offsite copy"],
  breach: ["incident", "compromise", "disclosure"],
  change: ["change control", "change request", "approval", "rollback"],
  cloud: ["cloud service provider", "csp", "cloud security"],
  crypto: ["cryptography", "encryption", "key management"],
  delete: ["erase", "sanitize", "destruction", "disposal"],
  developer: ["application development", "secure coding", "sdlc"],
  dispose: ["disposal", "destruction", "sanitization", "retirement"],
  email: ["mailbox", "message", "phishing", "forwarding"],
  encrypt: ["encryption", "cryptographic", "key management"],
  internet: ["web", "website", "browsing", "online"],
  laptop: ["equipment", "device", "asset"],
  lost: ["loss", "theft", "incident", "report"],
  password: ["passphrase", "credential", "authentication"],
  payment: ["digital payment", "transaction", "payment gateway"],
  personal: ["own", "private", "unapproved"],
  privacy: ["personal data", "personal information", "pii", "data protection"],
  remote: ["remote access", "teleworking", "vpn", "offsite"],
  restore: ["recovery", "backup", "rto", "rpo"],
  server: ["server configuration", "hardening", "patching"],
  stolen: ["theft", "loss", "incident", "report"],
  usb: ["removable media", "flash drive", "portable storage"],
  virus: ["malware", "malicious software", "scan"],
  vulnerability: ["vulnerability management", "scan", "vapt", "patch"],
  wifi: ["wireless", "network", "internet"]
};

export function normalize(value = "") {
  return value
    .toLowerCase()
    .replace(/isms\s*p\s*0*(\d+)/g, (_, number) => `ismsp${String(Number(number)).padStart(2, "0")}`)
    .replace(/[^a-z0-9\s-]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

function variants(token) {
  const values = [token];
  if (token.length > 5 && token.endsWith("ies")) values.push(`${token.slice(0, -3)}y`);
  if (token.length > 5 && token.endsWith("ing")) values.push(token.slice(0, -3));
  if (token.length > 4 && token.endsWith("ed")) values.push(token.slice(0, -2));
  if (token.length > 4 && token.endsWith("s")) values.push(token.slice(0, -1));
  return values;
}

function queryTerms(question) {
  const normalized = normalize(question);
  const tokens = normalized.split(" ").filter((token) => token.length > 1 && !STOP_WORDS.has(token));
  const terms = [];
  for (const token of tokens) {
    terms.push(...variants(token));
    if (EXPANSIONS[token]) terms.push(...EXPANSIONS[token]);
  }
  for (let index = 0; index < tokens.length - 1; index += 1) {
    if (tokens[index].length > 2 && tokens[index + 1].length > 2) terms.push(`${tokens[index]} ${tokens[index + 1]}`);
  }
  return [...new Set(terms.map(normalize).filter(Boolean))];
}

function controlText(control) {
  return normalize([
    control.policyId,
    control.policyTitle,
    control.heading,
    control.topic,
    control.text,
    control.contextText,
    ...(control.keywords || [])
  ].join(" "));
}

function explicitPolicyIds(question) {
  return [...normalize(question).matchAll(/\bismsp\d{2}\b/g)].map((match) => match[0].toUpperCase());
}

function scoreControl(control, terms, normalizedQuestion, requestedPolicyId) {
  const text = controlText(control);
  const title = normalize(control.policyTitle.replace(/\bpolicy\b/gi, ""));
  let score = 0;
  let matched = 0;

  for (const term of terms) {
    if (!term) continue;
    const occurrences = text.split(term).length - 1;
    if (!occurrences) continue;
    matched += 1;
    score += term.includes(" ") ? 4.2 : 1.55;
    score += Math.min(occurrences - 1, 2) * 0.35;
    if (normalize(control.heading).includes(term)) score += 2.1;
    if (normalize(control.topic).includes(term)) score += 1.6;
    if ((control.keywords || []).some((keyword) => normalize(keyword) === term)) score += 1.2;
  }

  const significant = terms.filter((term) => term.length > 3 && !term.includes(" "));
  if (significant.length) score += (matched / terms.length) * 4.5;
  if (title.length > 5 && normalizedQuestion.includes(title)) score += 13;
  if (normalizedQuestion.includes(normalize(control.policyId))) score += 18;
  if (requestedPolicyId && control.policyId === requestedPolicyId) score += 8;

  const queryNumbers = normalizedQuestion.match(/\b\d+(?:\.\d+)?\b/g) || [];
  for (const number of queryNumbers) if (text.includes(number)) score += 2.4;

  return { score, matched };
}

export function searchPolicy(question, controls, limit = 4, options = {}) {
  const normalizedQuestion = normalize(question);
  const ids = explicitPolicyIds(question);
  const requestedPolicyId = options.policyId || ids[0] || null;
  const terms = queryTerms(question);
  const pool = requestedPolicyId ? controls.filter((control) => control.policyId === requestedPolicyId) : controls;

  return pool
    .map((control) => ({ ...control, ...scoreControl(control, terms, normalizedQuestion, requestedPolicyId) }))
    .filter((control) => control.score >= 2.2)
    .sort((a, b) => b.score - a.score || b.matched - a.matched || a.page - b.page)
    .slice(0, limit);
}

function cleanExcerpt(value) {
  return value.replace(/^((?:[a-z]|[ivx]+|\d+)\.|[•])\s*/i, "").replace(/\s*[•]\s*/g, "; ").trim();
}

function failMessage(policyId) {
  const scope = policyId ? policyId : "the 24 indexed ISMS policies";
  return {
    answer: `I couldn't find enough policy evidence to answer that reliably from ${scope}. Try naming a policy, system, action, role, approval, time limit, or incident type.`,
    sources: [],
    grounded: false,
    confidence: "none"
  };
}

export function answerQuestion(question, controls, options = {}) {
  const q = normalize(question);
  const ids = explicitPolicyIds(question);
  const policyId = options.policyId || ids[0] || null;

  if (!q) return failMessage(policyId);
  if (/^(hi|hello|hey|help|good morning|good afternoon)\b/.test(q)) {
    return {
      answer: "Hello. Ask me about any indexed Rockland ISMS policy—for example passwords, email, remote access, privacy, encryption, cloud security, incidents, backups, or asset disposal.",
      sources: [],
      grounded: true,
      confidence: "informational"
    };
  }
  if (/\b(annual leave|vacation balance|salary|payroll|parking|expense claim|medical benefit|lunch menu)\b/.test(q)) return failMessage(policyId);

  const results = searchPolicy(question, controls, 5, { policyId });
  if (!results.length || results[0].score < 3.4) return failMessage(policyId);

  const best = results[0];
  const selected = [];
  const seen = new Set();
  for (const result of results) {
    const key = normalize(result.contextText || result.text);
    if (seen.has(key)) continue;
    if (selected.length && result.score < best.score * 0.55) continue;
    selected.push(result);
    seen.add(key);
    if (selected.length === 3) break;
  }

  const excerpts = selected.map((source) => cleanExcerpt(source.contextText || source.text));
  const uniquePolicies = [...new Set(selected.map((source) => source.policyId))];
  const prefix = uniquePolicies.length === 1 ? `${uniquePolicies[0]} says: ` : "The relevant policies say: ";
  let answer = `${prefix}${excerpts.join(" ")}`;

  if (/\b(can i|may i|is it allowed|are we allowed)\b/.test(q)) {
    if (excerpts.some((text) => /\b(prohibited|must not|shall not|not permitted)\b/i.test(text))) answer = `No, unless an approved exception applies. ${answer}`;
    else if (excerpts.some((text) => /\b(only|approval|authorized|required|shall|must)\b/i.test(text))) answer = `Only under the stated policy conditions. ${answer}`;
  }

  return {
    answer,
    sources: selected,
    grounded: true,
    confidence: best.score >= 11 ? "high" : "supported"
  };
}
