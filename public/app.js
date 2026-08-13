import { answerQuestion } from "./retrieval.js";

const conversation = document.querySelector("#conversation");
const form = document.querySelector("#questionForm");
const question = document.querySelector("#question");
const sendButton = document.querySelector("#sendButton");
const clearButton = document.querySelector("#clearChat");
const evidencePanel = document.querySelector("#evidencePanel");
const evidenceContent = document.querySelector("#evidenceContent");
const mobileSources = document.querySelector("#mobileSources");
const closeSources = document.querySelector("#closeSources");
const policyList = document.querySelector("#policyList");
const scopeTitle = document.querySelector("#scopeTitle");
const scopeNote = document.querySelector("#scopeNote");
let corpus;
let activePolicyId = null;
let conversationVersion = 0;

const ALL_POLICY_SUGGESTIONS = [
  "What is the minimum password length?",
  "How quickly must a security incident be reported?",
  "What are the rules for remote access?",
  "How often should critical backups be tested?"
];

const POLICY_SUGGESTIONS = {
  ISMSP01: ["What is the minimum password length for standard users?", "Can users share passwords?", "What should I do if a credential is compromised?"],
  ISMSP02: ["Can I install software on a Rockland device?", "Is limited personal use of company systems allowed?", "What should I do if a Rockland device is lost?"],
  ISMSP03: ["Can emails be forwarded to a personal account?", "What should I do with a suspected phishing email?", "When can a shared email account be created?"],
  ISMSP04: ["Can servers access the internet?", "Which internet activities are prohibited?", "What should I do if I visit a malicious website?"],
  ISMSP05: ["Can I use my personal USB drive?", "What should I do if removable media is lost?", "Can company media be taken off-site?"],
  ISMSP06: ["What malware protection must be active?", "How are malware protection updates handled?", "What should happen when malware is detected?"],
  ISMSP07: ["What approval is needed for remote access?", "Is multi-factor authentication required for remote access?", "Which remote access protocols are allowed?"],
  ISMSP08: ["When may Rockland collect personal data?", "How long may personal information be retained?", "How must a privacy incident be reported?"],
  ISMSP09: ["Who must complete security awareness training?", "What topics must awareness training cover?", "How is the awareness program reviewed?"],
  ISMSP10: ["How should equipment be protected from environmental threats?", "Can company equipment be taken off-site?", "What must happen before equipment is reused or disposed of?"],
  ISMSP11: ["How must encryption keys be protected?", "How should passwords be stored in databases?", "Which information must be encrypted in transit?"],
  ISMSP12: ["Who must approve a change request?", "How are emergency changes handled?", "What testing and rollback planning is required for changes?"],
  ISMSP13: ["How should sensitive data be transmitted?", "What are data owners responsible for?", "How must sensitive data be disposed of?"],
  ISMSP14: ["How is administrative network access controlled?", "How should network traffic be segregated?", "When must high-risk network patches be applied?"],
  ISMSP15: ["What is the minimum server password length?", "Can servers access the internet?", "When must critical server patches be applied?"],
  ISMSP16: ["What security testing is required before deployment?", "Can production data be used for application testing?", "Which security checks belong in the DevSecOps lifecycle?"],
  ISMSP17: ["What must be done before engaging a cloud service provider?", "How must cloud data be encrypted?", "What cloud compliance evidence is required?"],
  ISMSP18: ["What security testing is required for digital payments?", "How must payment data be encrypted?", "How should high or medium payment vulnerabilities be remediated?"],
  ISMSP19: ["How often must vulnerability scans be conducted?", "When is VAPT required before commissioning a system?", "How are vulnerabilities prioritized and remediated?"],
  ISMSP20: ["How should storage media be sanitized before disposal?", "What records are required for asset disposal?", "How long must disposal records be retained?"],
  ISMSP21: ["How quickly must a security incident be reported?", "Can users test a suspected vulnerability?", "How must investigation evidence be collected and preserved?"],
  ISMSP22: ["What are the consequences of non-compliance?", "How is policy compliance verified?", "Which legal and regulatory requirements must be followed?"],
  ISMSP23: ["How often should critical backup restoration be tested?", "Where must critical backups be stored?", "Who defines recovery time and recovery point objectives?"],
  ISMSP24: ["What must happen before an IT asset is disposed of?", "How are cloud and virtual assets securely disposed of?", "How long must asset disposal records be retained?"]
};

const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function policyById(id) {
  return corpus?.policies.find((policy) => policy.id === id);
}

function renderWelcome() {
  conversationVersion += 1;
  const selected = activePolicyId ? policyById(activePolicyId) : null;
  const suggestions = selected ? POLICY_SUGGESTIONS[selected.id] : ALL_POLICY_SUGGESTIONS;
  const introduction = selected
    ? `I’m focused on <strong>${escapeHtml(selected.id)} — ${escapeHtml(selected.title)}</strong>. Ask a question and I’ll answer only from this policy, with the supporting page and section.`
    : `I’m ready. I search <strong>${corpus.policies.length} Rockland ISMS draft policies</strong> and show the exact policy, page, and section behind every answer.`;

  conversation.innerHTML = `
    <div class="message assistant-message welcome-message">
      <div class="assistant-avatar">P</div>
      <div class="message-content">
        <div class="message-meta">ISMS ChatBot <span>Just now</span></div>
        <div class="bubble">
          <p>${introduction}</p>
          <p class="muted">Try one of these:</p>
          <div class="suggestions" aria-label="Suggested questions for ${selected ? escapeHtml(selected.title) : "all policies"}">
            ${suggestions.map((suggestion) => `<button type="button">${escapeHtml(suggestion)}</button>`).join("")}
          </div>
        </div>
      </div>
    </div>`;
  conversation.scrollTop = 0;
}

function renderPolicyLibrary() {
  const allActive = activePolicyId === null ? " active" : "";
  policyList.innerHTML = `
    <button class="policy-card all-policies${allActive}" type="button" data-policy="">
      <span class="policy-icon">ALL</span>
      <span><strong>All ISMS policies</strong><small>${corpus.policies.length} draft policies · ${corpus.document.pages} pages</small></span>
      <span class="verified" aria-label="Indexed">✓</span>
    </button>
    ${corpus.policies.map((policy) => `
      <button class="policy-card${activePolicyId === policy.id ? " active" : ""}" type="button" data-policy="${policy.id}">
        <span class="policy-icon">${policy.id.replace("ISMSP", "P")}</span>
        <span><strong>${escapeHtml(policy.title)}</strong><small>${policy.id} · pp. ${policy.pageStart}–${policy.pageEnd}</small></span>
        <span class="verified" aria-label="Draft indexed">D</span>
      </button>`).join("")}`;
}

function selectPolicy(id) {
  activePolicyId = id || null;
  const selected = activePolicyId ? policyById(activePolicyId) : null;
  scopeTitle.textContent = selected ? `Ask about ${selected.title.replace(/ Policy$/i, "")}` : "Ask across all ISMS policies";
  scopeNote.textContent = selected ? `${selected.id} · pages ${selected.pageStart}–${selected.pageEnd} · Draft` : `${corpus.policies.length} policies · ${corpus.document.pages} pages · Draft corpus`;
  question.placeholder = selected ? `Ask about ${selected.title.toLowerCase()}…` : "Ask a question about any ISMS policy…";
  renderPolicyLibrary();
  renderWelcome();
  renderEvidence([]);
  evidencePanel.classList.remove("open");
  question.focus();
}

async function loadCorpus() {
  const response = await fetch("./policy.json");
  if (!response.ok) throw new Error("Policy index unavailable");
  corpus = await response.json();
  document.querySelector("#controlCount").textContent = corpus.controls.length.toLocaleString();
  document.querySelector("#policyCount").textContent = corpus.policies.length;
  document.querySelector("#pageCount").textContent = `${corpus.document.indexedPages} / ${corpus.document.pages}`;
  renderPolicyLibrary();
  renderWelcome();
}

function timeLabel() {
  return new Intl.DateTimeFormat([], { hour: "numeric", minute: "2-digit" }).format(new Date());
}

function scrollToLatest() {
  requestAnimationFrame(() => conversation.scrollTo({ top: conversation.scrollHeight, behavior: "smooth" }));
}

function addUserMessage(text) {
  conversation.insertAdjacentHTML("beforeend", `
    <div class="message user-message">
      <div class="message-content">
        <div class="message-meta">You <span>${timeLabel()}</span></div>
        <div class="bubble"><p>${escapeHtml(text)}</p></div>
      </div>
    </div>`);
}

function addThinking() {
  conversation.insertAdjacentHTML("beforeend", `
    <div class="message assistant-message thinking" id="thinking">
      <div class="assistant-avatar">P</div>
      <div class="message-content"><div class="message-meta">ISMS ChatBot <span>Searching 1,202 controls</span></div><div class="bubble"><i></i><i></i><i></i></div></div>
    </div>`);
}

function sourceLabel(source) {
  return `${source.policyId} · p. ${source.page} · §${source.section}`;
}

function addAssistantMessage(result) {
  document.querySelector("#thinking")?.remove();
  const citations = result.sources.map((source) => `
    <button class="citation" type="button" data-source="${source.id}">${sourceLabel(source)}</button>`).join("");
  conversation.insertAdjacentHTML("beforeend", `
    <div class="message assistant-message">
      <div class="assistant-avatar">P</div>
      <div class="message-content">
        <div class="message-meta">ISMS ChatBot <span>${timeLabel()}</span></div>
        <div class="bubble">
          <p>${escapeHtml(result.answer)}</p>
          ${citations ? `<div class="citation-row">${citations}</div><span class="confidence">Grounded in ${result.sources.length} cited control${result.sources.length === 1 ? "" : "s"}</span>` : `<span class="confidence caution">No supporting control found</span>`}
        </div>
      </div>
    </div>`);
  renderEvidence(result.sources);
  scrollToLatest();
}

function renderEvidence(sources) {
  mobileSources.querySelector("span").textContent = sources.length;
  if (!sources.length) {
    evidenceContent.className = "empty-evidence";
    evidenceContent.innerHTML = `<div class="document-stack" aria-hidden="true"><span></span><span></span><span></span></div><h3>No supporting control selected</h3><p>Ask a policy question to see the exact draft clauses used.</p>`;
    return;
  }
  const policyNames = [...new Set(sources.map((source) => `${source.policyId} — ${source.policyTitle}`))];
  evidenceContent.className = "";
  evidenceContent.innerHTML = `
    <div class="source-summary"><strong>${escapeHtml(policyNames.join(" · "))}</strong><span>${sources.length} cited control${sources.length === 1 ? "" : "s"} from the draft corpus</span></div>
    ${sources.map((source, index) => `
      <article class="source-card${index === 0 ? " active" : ""}" id="source-${source.id}">
        <div class="source-top"><span class="source-page">${sourceLabel(source).toUpperCase()}</span><span class="match">${index === 0 ? "Best match" : "Supporting"}</span></div>
        <h3>${escapeHtml(source.heading)}</h3>
        <blockquote>“${escapeHtml(source.text)}”</blockquote>
        <button type="button" data-copy="${source.id}">Copy citation</button>
      </article>`).join("")}`;
}

async function ask(text) {
  const cleaned = text.trim();
  if (!cleaned || !corpus) return;
  const requestVersion = conversationVersion;
  const requestPolicyId = activePolicyId;
  const controls = requestPolicyId ? corpus.controls.filter((control) => control.policyId === requestPolicyId) : corpus.controls;
  addUserMessage(cleaned);
  addThinking();
  question.value = "";
  question.style.height = "auto";
  sendButton.disabled = true;
  scrollToLatest();
  await new Promise((resolve) => setTimeout(resolve, 260));
  if (requestVersion !== conversationVersion) {
    sendButton.disabled = false;
    return;
  }
  addAssistantMessage(answerQuestion(cleaned, controls, { policyId: requestPolicyId }));
  sendButton.disabled = false;
  question.focus();
}

form.addEventListener("submit", (event) => {
  event.preventDefault();
  ask(question.value);
});

question.addEventListener("keydown", (event) => {
  if (event.key === "Enter" && !event.shiftKey) {
    event.preventDefault();
    form.requestSubmit();
  }
});

question.addEventListener("input", () => {
  question.style.height = "auto";
  question.style.height = `${Math.min(question.scrollHeight, 120)}px`;
});

policyList.addEventListener("click", (event) => {
  const button = event.target.closest("[data-policy]");
  if (button) selectPolicy(button.dataset.policy);
});

conversation.addEventListener("click", (event) => {
  const suggestion = event.target.closest(".suggestions button");
  if (suggestion) ask(suggestion.textContent);
  const citation = event.target.closest("[data-source]");
  if (citation) {
    evidencePanel.classList.add("open");
    document.querySelector(`#source-${citation.dataset.source}`)?.scrollIntoView({ behavior: "smooth", block: "center" });
    document.querySelectorAll(".source-card").forEach((card) => card.classList.toggle("active", card.id === `source-${citation.dataset.source}`));
  }
});

evidenceContent.addEventListener("click", async (event) => {
  const button = event.target.closest("[data-copy]");
  if (!button) return;
  const source = corpus.controls.find((control) => control.id === button.dataset.copy);
  await navigator.clipboard.writeText(`${source.policyId} — ${source.policyTitle}, draft p. ${source.page}, §${source.section}: ${source.text}`);
  button.textContent = "Copied";
  setTimeout(() => { button.textContent = "Copy citation"; }, 1400);
});

clearButton.addEventListener("click", () => {
  renderWelcome();
  renderEvidence([]);
  question.focus();
});
mobileSources.addEventListener("click", () => evidencePanel.classList.add("open"));
closeSources.addEventListener("click", () => evidencePanel.classList.remove("open"));

loadCorpus().catch(() => {
  document.querySelector("#controlCount").textContent = "Offline";
  sendButton.disabled = true;
  question.placeholder = "The policy index could not be loaded";
});
