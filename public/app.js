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
const welcomeTemplate = conversation.innerHTML;
let corpus;
let activePolicyId = null;

const escapeHtml = (value = "") => value.replace(/[&<>'"]/g, (char) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", "'": "&#39;", '"': "&quot;" })[char]);

function policyById(id) {
  return corpus?.policies.find((policy) => policy.id === id);
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
  addUserMessage(cleaned);
  addThinking();
  question.value = "";
  question.style.height = "auto";
  sendButton.disabled = true;
  scrollToLatest();
  await new Promise((resolve) => setTimeout(resolve, 260));
  const controls = activePolicyId ? corpus.controls.filter((control) => control.policyId === activePolicyId) : corpus.controls;
  addAssistantMessage(answerQuestion(cleaned, controls, { policyId: activePolicyId }));
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
  conversation.innerHTML = welcomeTemplate;
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
