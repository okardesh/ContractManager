// ===========================
//  ClauseAI — app.js
// ===========================

// Ollama local endpoint — make sure `ollama serve` is running
const OLLAMA_BASE  = "http://localhost:11434/v1";
const OLLAMA_MODEL = "llama3";
const OLLAMA_CTX   = 8192; // context window tokens

// ===========================
//  App State
// ===========================

// Initial values reflect the 4 demo contracts already shown in the sidebar:
//   Vendor Agreement (3 issues) + Employment Contract (5 issues) = 8 issues
const INITIAL_STATE = {
  _v: 1,
  analyzed: 4,
  issuesFound: 8,
  suggestionsApplied: 0,
  archived: 0,
  sessionUploads: 0,
};

let AppState = (() => {
  try {
    const saved = JSON.parse(localStorage.getItem('clauseai-state'));
    return (saved && saved._v === 1) ? saved : { ...INITIAL_STATE };
  } catch { return { ...INITIAL_STATE }; }
})();
AppState.sessionUploads = 0; // reset on every page load

function saveState() {
  localStorage.setItem('clauseai-state', JSON.stringify(AppState));
}

// ===========================
//  Demo contract list
// ===========================

const DEMO_CONTRACTS = [
  { name: "Vendor Agreement — Acme Corp",  issues: 3, status: "warn", date: "Apr 28" },
  { name: "NDA — Horizon Partners",        issues: 0, status: "ok",   date: "Apr 21" },
  { name: "Employment Contract — J. Lee",  issues: 5, status: "risk", date: "Apr 15" },
  { name: "SaaS License — TechStack Inc",  issues: 0, status: "ok",   date: "Apr 10" },
];

// ===========================
//  Analysis prompt (structured JSON output)
// ===========================

const ANALYSIS_SYSTEM_PROMPT = `You are a contract analysis AI. Analyze the provided contract text and respond with ONLY a valid JSON object — no markdown fences, no preamble, nothing outside the JSON — in exactly this format:
{
  "summary": "One-sentence summary of what this contract is about",
  "issues": [
    {
      "severity": "high",
      "text": "Description of the issue",
      "location": "Section or clause reference",
      "tag": "Inaccuracy"
    }
  ],
  "suggestions": [
    {
      "title": "Short action-oriented suggestion title",
      "body": "Detailed explanation of what to change and why"
    }
  ],
  "initialMessage": "Brief 1-2 sentence message summarizing what you found"
}

Rules:
- severity must be: high, medium, or low
- tag must be: Inaccuracy, Missing, Risk, or Contradiction
- Be thorough: look for missing clauses, contradictions, risky terms, vague language, missing dates/amounts, unlimited liability, jurisdiction issues, unilateral termination rights
- If the document is not a valid contract or is unreadable, return empty arrays and explain in summary/initialMessage`;

// Current contract context for the chat
let currentContractText = "";
let currentAnalysis = null;

function buildChatSystemPrompt() {
  if (currentContractText) {
    const issues = currentAnalysis?.issues?.map(i => `- ${i.text}`).join('\n') || 'none';
    const suggestions = currentAnalysis?.suggestions?.map(s => `- ${s.title}`).join('\n') || 'none';
    return `You are ClauseAI, a contract analysis assistant. You have already analyzed the contract below.
Answer follow-up questions about it concisely and professionally. Keep responses under 150 words.

Contract excerpt:
${currentContractText.slice(0, 3000)}

Analysis summary: ${currentAnalysis?.summary || ''}
Issues found:
${issues}
Suggestions:
${suggestions}`;
  }
  return `You are ClauseAI, a contract analysis assistant. The user is viewing a Vendor Services Agreement between Acme Corp and ClientCo LLC with 3 known issues: IP ownership contradiction (§2 vs §5), missing payment amount (§1), and a 2-year confidentiality period below the 5-year industry standard. Answer questions concisely and professionally. Keep responses under 150 words.`;
}

// ===========================
//  i18n
// ===========================

const TRANSLATIONS = {
  en: {
    'btn.archive': 'Archive',
    'btn.newContract': '+ New Contract',
    'nav.workspace': 'Workspace',
    'nav.dashboard': 'Dashboard',
    'nav.analyze': 'Analyze',
    'nav.archive': 'Archive',
    'nav.suggestions': 'Suggestions',
    'nav.recentContracts': 'Recent Contracts',
    'meta.vendor': '3 issues · Apr 28',
    'meta.nda': 'Clean · Apr 21',
    'meta.employment': '5 issues · Apr 15',
    'meta.saas': 'Clean · Apr 10',
    'upload.title': 'Drop a contract to analyze',
    'upload.sub': 'PDF, DOCX, or TXT · AI analyzes in seconds',
    'upload.btn': '↑ Upload Contract',
    'section.overview': 'Overview',
    'stat.analyzed': 'Contracts Analyzed',
    'stat.issues': 'Issues Found',
    'stat.suggestions': 'Suggestions Applied',
    'stat.archived': 'Archived',
    'section.contract': 'Current Contract — Vendor Agreement, Acme Corp',
    'section.analysis': 'Analysis Results',
    'panel.risks': 'Inaccuracies & Risks',
    'panel.risksFound': '3 found',
    'panel.aiSuggestions': 'AI Suggestions',
    'panel.sugCount': '3 suggestions',
    'panel.chat': 'Ask about this contract',
    'panel.aiReady': 'AI Ready',
    'chat.placeholder': 'Ask about a clause, risk, or suggestion...',
    'chat.analyzing': 'Analyzing...',
    'chat.initial': 'I\'ve analyzed the Vendor Agreement. I found <strong>3 issues</strong>: an IP ownership contradiction, a missing payment amount, and a below-standard confidentiality period. Ask me anything about this contract.',
    'msg.analyzing': 'Analyzing: ',
    'msg.archive': 'Archive contains {n} contract{s}. All are indexed and searchable.',
    'msg.avatar.ai': 'AI',
    'msg.avatar.you': 'You',
    'msg.apiError': 'Unable to reach Ollama. Make sure `ollama serve` is running at localhost:11434.',
    'msg.noResponse': 'I could not generate a response.',
    'msg.fileError': 'Could not read this file. For best results use a .txt file.',
    'msg.reading': 'Reading "{name}"…',
    'msg.analyzed': 'Analysis complete for "{name}". Found {n} issue{s}. Panels updated.',
    'apply.btn': 'Apply',
    'apply.done': '✓ Applied',
    'issues.none': '✓ No issues found',
    'suggestions.none': 'No suggestions at this time.',
  },
  tr: {
    'btn.archive': 'Arşiv',
    'btn.newContract': '+ Yeni Sözleşme',
    'nav.workspace': 'Çalışma Alanı',
    'nav.dashboard': 'Gösterge Paneli',
    'nav.analyze': 'Analiz Et',
    'nav.archive': 'Arşiv',
    'nav.suggestions': 'Öneriler',
    'nav.recentContracts': 'Son Sözleşmeler',
    'meta.vendor': '3 sorun · 28 Nis',
    'meta.nda': 'Temiz · 21 Nis',
    'meta.employment': '5 sorun · 15 Nis',
    'meta.saas': 'Temiz · 10 Nis',
    'upload.title': 'Analiz için bir sözleşme bırakın',
    'upload.sub': 'PDF, DOCX veya TXT · Yapay zeka saniyeler içinde analiz eder',
    'upload.btn': '↑ Sözleşme Yükle',
    'section.overview': 'Genel Bakış',
    'stat.analyzed': 'Analiz Edilen Sözleşmeler',
    'stat.issues': 'Bulunan Sorunlar',
    'stat.suggestions': 'Uygulanan Öneriler',
    'stat.archived': 'Arşivlendi',
    'section.contract': 'Mevcut Sözleşme — Satıcı Anlaşması, Acme Corp',
    'section.analysis': 'Analiz Sonuçları',
    'panel.risks': 'Hatalar ve Riskler',
    'panel.risksFound': '3 bulundu',
    'panel.aiSuggestions': 'Yapay Zeka Önerileri',
    'panel.sugCount': '3 öneri',
    'panel.chat': 'Bu sözleşme hakkında soru sorun',
    'panel.aiReady': 'Yapay Zeka Hazır',
    'chat.placeholder': 'Bir madde, risk veya öneri hakkında sorun...',
    'chat.analyzing': 'Analiz ediliyor...',
    'chat.initial': 'Satıcı Anlaşmasını analiz ettim. <strong>3 sorun</strong> tespit ettim: bir fikri mülkiyet çelişkisi, belirtilmemiş bir ödeme tutarı ve standart altı bir gizlilik süresi. Bu sözleşme hakkında her şeyi sorabilirsiniz.',
    'msg.analyzing': 'Analiz ediliyor: ',
    'msg.archive': 'Arşivde {n} sözleşme{s} bulunuyor. Tümü indekslenmiş ve aranabilir.',
    'msg.avatar.ai': 'YZ',
    'msg.avatar.you': 'Siz',
    'msg.apiError': 'Ollama\'a ulaşılamıyor. `ollama serve` komutunun çalıştığından emin olun (localhost:11434).',
    'msg.noResponse': 'Yanıt oluşturulamadı.',
    'msg.fileError': 'Dosya okunamadı. En iyi sonuç için .txt dosyası deneyin.',
    'msg.reading': '"{name}" okunuyor…',
    'msg.analyzed': '"{name}" analizi tamamlandı. {n} sorun bulundu{s}. Paneller güncellendi.',
    'apply.btn': 'Uygula',
    'apply.done': '✓ Uygulandı',
    'issues.none': '✓ Sorun bulunamadı',
    'suggestions.none': 'Şu an için öneri yok.',
  }
};

let currentLang = 'en';

function t(key) {
  return TRANSLATIONS[currentLang][key] ?? TRANSLATIONS['en'][key] ?? key;
}

function setLang(lang) {
  currentLang = lang;
  document.documentElement.lang = lang;
  document.querySelectorAll('[data-i18n]').forEach(el => {
    el.textContent = t(el.getAttribute('data-i18n'));
  });
  document.querySelectorAll('[data-i18n-placeholder]').forEach(el => {
    el.placeholder = t(el.getAttribute('data-i18n-placeholder'));
  });
  const initialMsg = document.getElementById('initial-ai-msg');
  if (initialMsg) initialMsg.innerHTML = t('chat.initial');
  document.getElementById('lang-en').classList.toggle('active', lang === 'en');
  document.getElementById('lang-tr').classList.toggle('active', lang === 'tr');
}

let chatHistory = [];

// ===========================
//  File Reading
// ===========================

async function readFileAsText(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'txt') return file.text();
  if (ext === 'pdf')  return readPdfAsText(file);
  if (ext === 'docx') return readDocxAsText(file);
  return file.text(); // fallback
}

async function readPdfAsText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;
  let text = '';
  for (let i = 1; i <= pdf.numPages; i++) {
    const page = await pdf.getPage(i);
    const content = await page.getTextContent();
    text += content.items.map(item => item.str).join(' ') + '\n';
  }
  return text;
}

async function readDocxAsText(file) {
  const arrayBuffer = await file.arrayBuffer();
  const result = await mammoth.extractRawText({ arrayBuffer });
  return result.value;
}

// ===========================
//  LLM Contract Analysis
// ===========================

// ===========================
//  Ollama API helper
// ===========================

async function ollamaChat(systemPrompt, messages, maxTokens = 1024) {
  const res = await fetch(`${OLLAMA_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      options: { num_ctx: OLLAMA_CTX },
      max_tokens: maxTokens,
      messages: [
        { role: "system", content: systemPrompt },
        ...messages,
      ],
    }),
  });
  if (!res.ok) {
    const errText = await res.text();
    throw new Error(`Ollama HTTP ${res.status}: ${errText}`);
  }
  const data = await res.json();
  if (data.error) throw new Error(typeof data.error === 'string' ? data.error : JSON.stringify(data.error));
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error('Empty response from Ollama');
  return content;
}

function parseAnalysisJson(rawText) {
  const stripped = rawText
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();

  const start = stripped.indexOf('{');
  if (start === -1) throw new Error('No JSON object start found in AI response.');

  let candidate = stripped.slice(start);

  // If response is truncated (common with local models), recover by balancing braces.
  let depth = 0;
  let inString = false;
  let escaped = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) {
      escaped = false;
      continue;
    }
    if (ch === '\\') {
      escaped = true;
      continue;
    }
    if (ch === '"') {
      inString = !inString;
      continue;
    }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
  }
  if (depth > 0) candidate += '}'.repeat(depth);

  // Remove trailing commas that some models emit in JSON-like output.
  const normalized = candidate.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(normalized);
}

async function analyzeContractWithLLM(text, filename) {
  // Keep text within context budget: ~4000 chars ≈ 1000 tokens, leave room for system prompt + response
  const contractSnippet = text.slice(0, 5000);
  const rawText = await ollamaChat(
    ANALYSIS_SYSTEM_PROMPT,
    [{ role: "user", content: `Analyze this contract:\n\nFilename: ${filename}\n\n${contractSnippet}` }],
    1200
  );

  try {
    return parseAnalysisJson(rawText);
  } catch (err) {
    console.error('Raw Ollama analysis response:', rawText);
    throw new Error(`Could not parse JSON from AI response: ${err.message}`);
  }
}

// ===========================
//  Render Analysis into DOM
// ===========================

function escapeHtml(str) {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function renderAnalysis(filename, analysis) {
  const issueCount  = analysis.issues?.length      || 0;
  const sugCount    = analysis.suggestions?.length  || 0;

  // -- Contract section title --
  const titleEl = document.querySelector('[data-i18n="section.contract"]');
  if (titleEl) { titleEl.removeAttribute('data-i18n'); titleEl.textContent = `Current Contract — ${filename}`; }

  // -- Contract doc preview --
  const docEl = document.getElementById('contract-doc');
  if (docEl && currentContractText) {
    const preview = escapeHtml(currentContractText.slice(0, 1400));
    docEl.innerHTML = `<strong>${escapeHtml(filename.toUpperCase())}</strong><br><br>${preview}${currentContractText.length > 1400 ? '<span style="color:#aaa"> …</span>' : ''}`;
  }

  // -- Issues badge --
  const issuesBadge = document.querySelector('[data-i18n="panel.risksFound"]');
  if (issuesBadge) { issuesBadge.removeAttribute('data-i18n'); issuesBadge.textContent = `${issueCount} found`; }

  // -- Issues list --
  const issuesBody = document.getElementById('issues-panel-body');
  if (issuesBody) {
    if (issueCount === 0) {
      issuesBody.innerHTML = `<div class="panel-empty">${t('issues.none')}</div>`;
    } else {
      const tagClass = { Inaccuracy: 'tag-inaccuracy', Missing: 'tag-missing', Contradiction: 'tag-inaccuracy', Risk: 'tag-risk' };
      issuesBody.innerHTML = analysis.issues.map(issue => `
        <div class="issue-item">
          <span class="issue-severity ${issue.severity === 'high' ? 'sev-high' : issue.severity === 'medium' ? 'sev-med' : 'sev-low'}"></span>
          <div>
            <div class="issue-text">${escapeHtml(issue.text)}</div>
            <div class="issue-loc">${escapeHtml(issue.location || '')}</div>
          </div>
          <span class="issue-tag ${tagClass[issue.tag] || 'tag-risk'}">${escapeHtml(issue.tag || 'Risk')}</span>
        </div>`).join('');
    }
  }

  // -- Suggestions badge --
  const sugBadge = document.querySelector('[data-i18n="panel.sugCount"]');
  if (sugBadge) { sugBadge.removeAttribute('data-i18n'); sugBadge.textContent = `${sugCount} suggestion${sugCount !== 1 ? 's' : ''}`; }

  // -- Suggestions list --
  const sugBody = document.getElementById('suggestions-panel-body');
  if (sugBody) {
    if (sugCount === 0) {
      sugBody.innerHTML = `<div class="panel-empty">${t('suggestions.none')}</div>`;
    } else {
      sugBody.innerHTML = analysis.suggestions.map(sug => `
        <div class="suggestion-item">
          <div class="sug-title">
            <span class="sug-icon">→</span>
            <span>${escapeHtml(sug.title)}</span>
            <button class="apply-btn" onclick="applySuggestion(this)">${t('apply.btn')}</button>
          </div>
          <div class="sug-body">${escapeHtml(sug.body)}</div>
        </div>`).join('');
    }
  }

  // -- Initial chat message --
  const chatMsg = document.getElementById('initial-ai-msg');
  if (chatMsg && analysis.initialMessage) chatMsg.innerHTML = escapeHtml(analysis.initialMessage);

  // -- Stats --
  AppState.analyzed++;
  AppState.issuesFound += issueCount;
  AppState.sessionUploads++;
  saveState();
  updateStatCards();

  // -- Sidebar --
  addContractToSidebar(filename, issueCount);
}

function addContractToSidebar(name, issueCount) {
  const list = document.getElementById('contract-list');
  const status = issueCount === 0 ? 'ok' : issueCount <= 3 ? 'warn' : 'risk';
  const today = new Date().toLocaleDateString('en-US', { month: 'short', day: 'numeric' });
  const div = document.createElement('div');
  div.className = 'contract-item';
  div.onclick = function () {
    document.querySelectorAll('.contract-item').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    currentContractText = ''; currentAnalysis = null; chatHistory = [];
  };
  div.innerHTML = `
    <div class="contract-name">${escapeHtml(name)}</div>
    <div class="contract-meta">
      <span class="status-dot status-${status}"></span>
      <span>${issueCount === 0 ? 'Clean' : issueCount + ' issue' + (issueCount !== 1 ? 's' : '')} · ${today}</span>
    </div>`;
  list.insertBefore(div, list.firstChild);
  document.querySelectorAll('.contract-item').forEach(c => c.classList.remove('active'));
  div.classList.add('active');
}

function updateStatCards() {
  const s = AppState;
  document.getElementById('stat-analyzed-val').textContent   = s.analyzed;
  document.getElementById('stat-issues-val').textContent     = s.issuesFound;
  document.getElementById('stat-suggestions-val').textContent = s.suggestionsApplied;
  document.getElementById('stat-archived-val').textContent   = s.archived;

  document.getElementById('stat-analyzed-sub').textContent =
    s.sessionUploads > 0 ? `↑ ${s.sessionUploads} uploaded this session` : '4 demo contracts loaded';
  document.getElementById('stat-issues-sub').textContent =
    s.issuesFound > 0 ? `across ${s.analyzed} contract${s.analyzed !== 1 ? 's' : ''}` : '—';
  document.getElementById('stat-suggestions-sub').textContent =
    s.suggestionsApplied > 0 ? `↑ ${s.suggestionsApplied} applied` : 'none applied yet';
  document.getElementById('stat-archived-sub').textContent =
    s.archived > 0 ? 'All indexed' : 'none archived yet';
}

function applySuggestion(btn) {
  if (btn.disabled) return;
  btn.textContent = t('apply.done');
  btn.disabled = true;
  btn.classList.add('applied');
  AppState.suggestionsApplied++;
  saveState();
  updateStatCards();
}

// ===========================
//  Upload
// ===========================

function triggerUpload() {
  document.getElementById("file-input").click();
}

async function handleFileUpload(event) {
  const file = event.target.files[0];
  if (!file) return;
  event.target.value = ''; // allow re-uploading the same file

  const name = file.name.replace(/\.[^.]+$/, "");
  addMessage("user", t('msg.reading').replace('{name}', file.name));
  setLoading(true);

  try {
    const text = await readFileAsText(file);
    if (!text || text.trim().length < 30) throw new Error("empty");

    currentContractText = text;
    chatHistory = [];

    const analysis = await analyzeContractWithLLM(text, file.name);
    currentAnalysis = analysis;

    renderAnalysis(name, analysis);

    const n = analysis.issues?.length || 0;
    addMessage("ai", analysis.initialMessage ||
      t('msg.analyzed').replace('{name}', name).replace('{n}', n).replace('{s}', n !== 1 ? 's' : ''));
  } catch (err) {
    console.error("Analysis error:", err);
    if (err.message === "empty") {
      addMessage("ai", t('msg.fileError'));
    } else {
      addMessage("ai", `${t('msg.apiError')}<br><small style="opacity:.6">${err.message}</small>`);
    }
  }

  setLoading(false);
}

function setView(view, el) {
  document.querySelectorAll(".nav-item").forEach((n) => n.classList.remove("active"));
  el.classList.add("active");
}

function selectContract(idx, el) {
  document.querySelectorAll(".contract-item").forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  const c = DEMO_CONTRACTS[idx];
  // Reset context — demo contracts use the static analysis panels
  currentContractText = ""; currentAnalysis = null; chatHistory = [];
  const n = c.issues;
  const msg = n === 0
    ? `Switched to "${c.name}". This contract looks clean — no critical issues detected.`
    : `Switched to "${c.name}". Found ${n} issue${n > 1 ? 's' : ''} in this contract. Ask me for details.`;
  addMessage("ai", msg);
}

function showArchive() {
  const n = AppState.archived;
  addMessage("ai", t('msg.archive').replace('{n}', n).replace('{s}', n !== 1 ? 's' : ''));
}

// ===========================
//  Chat
// ===========================

function handleEnter(e) {
  if (e.key === "Enter") sendMessage();
}

async function sendMessage() {
  const input = document.getElementById("chat-input");
  const text = input.value.trim();
  if (!text) return;
  input.value = "";

  addMessage("user", text);
  chatHistory.push({ role: "user", content: text });

  setLoading(true);

  try {
    const reply = await ollamaChat(buildChatSystemPrompt(), chatHistory.slice(-10), 1024);
    chatHistory.push({ role: "assistant", content: reply });
    addMessage("ai", reply || t('msg.noResponse'));
  } catch (err) {
    console.error("Ollama error:", err);
    addMessage("ai", t('msg.apiError'));
  }

  setLoading(false);
}

function addMessage(role, text) {
  const container = document.getElementById("chat-messages");
  const div = document.createElement("div");
  div.className = `msg${role === "user" ? " msg-user-row" : ""}`;
  const avatarLabel = role === "ai" ? t('msg.avatar.ai') : t('msg.avatar.you');
  div.innerHTML = `
    <div class="msg-avatar ${role === "ai" ? "msg-ai" : "msg-user"}">${avatarLabel}</div>
    <div class="msg-text">${text}</div>
  `;
  container.appendChild(div);
  container.scrollTop = container.scrollHeight;
}

function setLoading(on) {
  document.getElementById("ai-loading").classList.toggle("visible", on);
  document.getElementById("chat-spinner").classList.toggle("visible", on);
}

// ===========================
//  Init
// ===========================
document.addEventListener('DOMContentLoaded', () => {
  setLang('en');
  updateStatCards();
});
