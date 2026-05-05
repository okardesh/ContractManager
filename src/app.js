// ===========================
//  ClauseAI — app.js
// ===========================

// Ollama local endpoint — make sure `ollama serve` is running
const OLLAMA_BASE  = "http://localhost:11434/v1";
let   OLLAMA_MODEL = "qwen2.5:3b";
const OLLAMA_CTX   = 4096; // context window — reduced for faster inference
const OLLAMA_CTX_ANALYSIS = 3072; // tighter window used during contract analysis

function setOllamaModel(model) {
  OLLAMA_MODEL = model;
  localStorage.setItem('clauseai-model', model);
}

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

function getDemoContractPayload(idx) {
  const tr = currentLang === 'tr';

  if (idx === 0) {
    return {
      text: tr
        ? `TEDARİKÇİ HİZMET SÖZLEŞMESİ\n\n1. Hizmetler: Tedarikçi yazılım geliştirme hizmeti sunacaktır. Ödeme tutarı [BELİRTİLMEMİŞTİR].\n2. Fikri Mülkiyet: Tüm çıktılar Tedarikçiye aittir.\n3. Gizlilik: Taraflar gizliliği fesih sonrası 2 yıl korur.\n5. IP Devri: Tüm teslimatlar Müşteriye aittir.`
        : `VENDOR SERVICES AGREEMENT\n\n1. Services: Vendor provides software development services. Payment amount is [NOT SPECIFIED].\n2. Intellectual Property: All deliverables are owned by Vendor.\n3. Confidentiality: Confidentiality survives for 2 years after termination.\n5. IP Assignment: All deliverables are owned by Client.`,
      analysis: {
        summary: tr
          ? 'Satıcı hizmet sözleşmesinde ödeme, fikri mülkiyet ve gizlilik maddelerinde önemli riskler var.'
          : 'Vendor services agreement contains material risks in payment, IP ownership, and confidentiality clauses.',
        issues: tr ? [
          { severity: 'high', text: 'IP sahipliği 2. ve 5. maddeler arasında çelişiyor.', location: 'Madde 2 vs Madde 5', tag: 'Contradiction' },
          { severity: 'high', text: 'Ödeme tutarı belirtilmemiş; uygulanabilirlik riski oluşturuyor.', location: 'Madde 1', tag: 'Missing' },
          { severity: 'medium', text: '2 yıllık gizlilik süresi sektör pratiğinin altında.', location: 'Madde 3', tag: 'Risk' },
        ] : [
          { severity: 'high', text: 'IP ownership conflicts between clauses 2 and 5.', location: 'Clause 2 vs Clause 5', tag: 'Contradiction' },
          { severity: 'high', text: 'Payment amount is missing, creating enforceability risk.', location: 'Clause 1', tag: 'Missing' },
          { severity: 'medium', text: '2-year confidentiality period is below market standard.', location: 'Clause 3', tag: 'Risk' },
        ],
        suggestions: tr ? [
          { title: 'IP sahipliğini tek maddede netleştirin', body: '2. veya 5. maddeyi revize ederek tek bir sahiplik kuralı bırakın.' },
          { title: 'Ödeme tutarı ve takvimi ekleyin', body: 'Sabit bedel veya ek-ücret tablosu ile ödeme koşullarını açıkça yazın.' },
          { title: 'Gizlilik süresini uzatın', body: 'Süreyi en az 5 yıla çıkararak ticari sır korumasını güçlendirin.' },
        ] : [
          { title: 'Unify IP ownership clause', body: 'Revise clause 2 or 5 so only one ownership rule applies.' },
          { title: 'Add payment amount and schedule', body: 'Define fixed fee or pricing exhibit with payment terms.' },
          { title: 'Extend confidentiality term', body: 'Increase confidentiality survival to at least 5 years.' },
        ],
        initialMessage: tr
          ? '**Satıcı sözleşmesi** yüklendi. 3 kritik alan var: IP çelişkisi, eksik ödeme tutarı ve düşük gizlilik süresi.'
          : '**Vendor agreement** loaded. I found 3 key issues: IP conflict, missing payment amount, and short confidentiality period.',
      }
    };
  }

  if (idx === 1) {
    return {
      text: tr
        ? `GİZLİLİK SÖZLEŞMESİ (NDA)\n\nTaraflar gizli bilgileri yalnızca proje amacıyla kullanır.\nGizlilik süresi 5 yıldır.\nYetki ve fesih hükümleri karşılıklıdır.`
        : `NON-DISCLOSURE AGREEMENT (NDA)\n\nParties use confidential information only for project purposes.\nConfidentiality term is 5 years.\nJurisdiction and termination terms are mutual.`,
      analysis: {
        summary: tr ? 'NDA dengeli ve uygulanabilir görünüyor; kritik açık bulunmadı.' : 'NDA appears balanced and enforceable with no critical gaps.',
        issues: [],
        suggestions: [],
        initialMessage: tr
          ? '**NDA temiz görünüyor.** Kritik risk veya çelişki tespit edilmedi.'
          : '**NDA looks clean.** No critical risks or contradictions detected.',
      }
    };
  }

  if (idx === 2) {
    return {
      text: tr
        ? `İŞ SÖZLEŞMESİ\n\nDeneme süresi 9 ay olarak belirlenmiştir.\nFazla mesai ücreti düzenlenmemiştir.\nRekabet yasağı tüm dünyada 5 yıl süreyle geçerlidir.\nFesih bildirimi sadece işveren için 30 gündür.`
        : `EMPLOYMENT AGREEMENT\n\nProbation period is set to 9 months.\nOvertime compensation is not defined.\nNon-compete applies worldwide for 5 years.\nTermination notice is 30 days for employer only.`,
      analysis: {
        summary: tr
          ? 'İş sözleşmesi çalışan aleyhine ağır hükümler içeriyor ve birden fazla uyum riski barındırıyor.'
          : 'Employment contract contains employee-unfriendly terms and multiple compliance risks.',
        issues: tr ? [
          { severity: 'high', text: 'Deneme süresi orantısız derecede uzun.', location: 'Madde 2', tag: 'Risk' },
          { severity: 'high', text: 'Fazla mesai ücreti düzenlenmemiş.', location: 'Madde 4', tag: 'Missing' },
          { severity: 'medium', text: 'Rekabet yasağı kapsamı aşırı geniş.', location: 'Madde 7', tag: 'Risk' },
          { severity: 'medium', text: 'Fesih bildirim süresi tek taraflı yazılmış.', location: 'Madde 9', tag: 'Inaccuracy' },
          { severity: 'low', text: 'Yıllık izin hesap yöntemi açık değil.', location: 'Madde 5', tag: 'Missing' },
        ] : [
          { severity: 'high', text: 'Probation period is disproportionately long.', location: 'Clause 2', tag: 'Risk' },
          { severity: 'high', text: 'Overtime compensation is missing.', location: 'Clause 4', tag: 'Missing' },
          { severity: 'medium', text: 'Non-compete scope is overly broad.', location: 'Clause 7', tag: 'Risk' },
          { severity: 'medium', text: 'Termination notice is one-sided.', location: 'Clause 9', tag: 'Inaccuracy' },
          { severity: 'low', text: 'Annual leave accrual method is unclear.', location: 'Clause 5', tag: 'Missing' },
        ],
        suggestions: tr ? [
          { title: 'Deneme süresini yasal/makul seviyeye çekin', body: 'Deneme süresini 2–3 ay aralığında yeniden düzenleyin.' },
          { title: 'Fazla mesai ücret kuralı ekleyin', body: 'Saatlik çarpan ve onay mekanizmasını açıkça tanımlayın.' },
          { title: 'Rekabet yasağını daraltın', body: 'Süre, coğrafya ve faaliyet kapsamını ölçülü hale getirin.' },
        ] : [
          { title: 'Reduce probation period', body: 'Revise probation to a legally safer 2–3 month range.' },
          { title: 'Add overtime compensation rule', body: 'Define overtime multiplier and approval workflow.' },
          { title: 'Narrow non-compete clause', body: 'Limit duration, geography, and activity scope.' },
        ],
        initialMessage: tr
          ? '**İş sözleşmesi** için 5 risk tespit ettim. Özellikle deneme süresi, fazla mesai ve rekabet yasağı maddeleri gözden geçirilmeli.'
          : '**Employment contract** loaded with 5 risks. Probation, overtime, and non-compete terms need revision first.',
      }
    };
  }

  return {
    text: tr
      ? `SAAS LİSANS SÖZLEŞMESİ\n\nLisans kapsamı, destek seviyesi ve sorumluluk sınırları dengeli şekilde tanımlanmıştır.`
      : `SAAS LICENSE AGREEMENT\n\nLicense scope, support level, and liability limits are defined in a balanced way.`,
    analysis: {
      summary: tr ? 'SaaS lisans metni dengeli görünüyor; kritik uyumsuzluk bulunmadı.' : 'SaaS license appears balanced with no critical inconsistencies.',
      issues: [],
      suggestions: [],
      initialMessage: tr
        ? '**SaaS lisansı temiz.** Kritik risk, eksik madde veya çelişki görünmüyor.'
        : '**SaaS license looks clean.** No critical risk, missing clause, or contradiction found.',
    }
  };
}

// ===========================
//  Analysis prompt (structured JSON output)
// ===========================

function getResponseLanguageLabel() {
  return currentLang === 'tr' ? 'Turkish (Türkçe)' : 'English';
}

function buildAnalysisSystemPrompt() {
  return `You are a contract analysis AI. Analyze the provided contract text and respond with ONLY a valid JSON object — no markdown fences, no preamble, nothing outside the JSON — in exactly this format:
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
- If the document is not a valid contract or is unreadable, return empty arrays and explain in summary/initialMessage
- IMPORTANT: Write all text fields (summary, issues[].text, issues[].location, suggestions[].title, suggestions[].body, initialMessage) in ${getResponseLanguageLabel()}
- initialMessage should be readable and well-formatted, using markdown emphasis where useful (for example: **bold**, *italic*)`;
}

// Current contract context for the chat
let currentContractText = "";
let currentContractHtml = "";
let currentContractDocxBuffer = null;
let currentAnalysis = null;
let currentContractName = "";
let contractViewerExpanded = false;
let savedContractSeq = 1;
const savedContracts = new Map();
let originalDocHtml = null;      // snapshot before first suggestion applied
let originalContractText = null; // plain-text snapshot for diff
let compareModeActive = false;

function buildChatSystemPrompt() {
  const responseLanguage = getResponseLanguageLabel();
  if (currentContractText) {
    const issues = currentAnalysis?.issues?.map(i => `- ${i.text}`).join('\n') || 'none';
    const suggestions = currentAnalysis?.suggestions?.map(s => `- ${s.title}`).join('\n') || 'none';
    return `You are ClauseAI, a contract analysis assistant. You have already analyzed the contract below.
Answer follow-up questions about it concisely and professionally. Keep responses under 150 words.
Always respond in ${responseLanguage}, matching the page language.
Format responses with short paragraphs, bullet points where useful, and markdown emphasis like **bold** and *italic*.

Contract excerpt:
${currentContractText.slice(0, 3000)}

Analysis summary: ${currentAnalysis?.summary || ''}
Issues found:
${issues}
Suggestions:
${suggestions}`;
  }
  return `You are ClauseAI, a contract analysis assistant. The user is viewing a Vendor Services Agreement between Acme Corp and ClientCo LLC with 3 known issues: IP ownership contradiction (§2 vs §5), missing payment amount (§1), and a 2-year confidentiality period below the 5-year industry standard. Answer questions concisely and professionally. Keep responses under 150 words. Always respond in ${responseLanguage}, matching the page language. Use markdown emphasis and bullets where useful.`;
}

// ===========================
//  i18n
// ===========================

const TRANSLATIONS = {
  en: {
    'model.label': 'Model',
    'btn.archive': 'Archive',
    'btn.newContract': '+ New Contract',
    'theme.dark': 'Dark Mode',
    'theme.light': 'Light Mode',
    'theme.system': 'System Theme',
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
    'meta.cleanDynamic': 'Clean',
    'meta.issuesDynamic': '{n} issue{s}',
    'upload.title': 'Drop a contract to analyze',
    'upload.sub': 'PDF, DOCX, or TXT · AI analyzes in seconds',
    'upload.btn': '↑ Upload Contract',
    'section.overview': 'Overview',
    'stat.analyzed': 'Contracts Analyzed',
    'stat.issues': 'Issues Found',
    'stat.suggestions': 'Suggestions Applied',
    'stat.archived': 'Archived',
    'section.contract': 'Current Contract — Vendor Agreement, Acme Corp',
    'section.contractDynamic': 'Current Contract — {name}',
    'viewer.expand': 'Expand',
    'viewer.collapse': 'Collapse',
    'section.analysis': 'Analysis Results',
    'panel.risks': 'Inaccuracies & Risks',
    'panel.risksFound': '3 found',
    'panel.risksFoundDynamic': '{n} found',
    'panel.aiSuggestions': 'AI Suggestions',
    'panel.sugCount': '3 suggestions',
    'panel.sugCountDynamic': '{n} suggestion{s}',
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
    'msg.switch.clean': 'Switched to "{name}". This contract looks clean — no critical issues detected.',
    'msg.switch.issues': 'Switched to "{name}". Found {n} issue{s} in this contract. Ask me for details.',
    'sev.high': 'High',
    'sev.medium': 'Medium',
    'sev.low': 'Low',
    'view.analyze.title': 'Contract Analysis',
    'view.analyze.subtitle': 'Load a contract to see detailed issues',
    'view.analyze.archive': 'Archive Contract',
    'view.analyze.archived': 'Archived!',
    'view.analyze.download': '↓ Download',
    'view.analyze.editDoc': 'Edit Document',
    'view.analyze.editable': 'Editable',
    'view.analyze.empty': 'No contract loaded',
    'view.analyze.emptySub': 'Upload a contract or select one from the sidebar to view detailed analysis.',
    'view.archive.title': 'Archive',
    'view.archive.subtitle': 'Archived contracts with full document viewer',
    'view.archive.empty': 'No archived contracts yet',
    'view.archive.emptySub': 'Archive contracts from the Analyze view to find them here.',
    'view.archive.archivedOn': 'Archived {date}',
    'view.archive.download': '↓ Download',
    'view.archive.close': '✕',
    'view.suggestions.title': 'Recommendations',
    'view.suggestions.subtitle': 'Detailed AI recommendations for the current contract',
    'view.suggestions.empty': 'No recommendations yet',
    'view.suggestions.emptySub': 'Upload a contract to get AI-powered recommendations.',
    'view.suggestions.applyAll': 'Apply All',
    'view.suggestions.download': '↓ Download Modified',
    'view.suggestions.compareTitle': 'Before / After',
    'view.suggestions.before': 'Original',
    'view.suggestions.after': 'Modified',
  },
  tr: {
    'model.label': 'Model',
    'btn.archive': 'Arşiv',
    'btn.newContract': '+ Yeni Sözleşme',
    'theme.dark': 'Karanlık Mod',
    'theme.light': 'Aydınlık Mod',
    'theme.system': 'Sistem Teması',
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
    'meta.cleanDynamic': 'Temiz',
    'meta.issuesDynamic': '{n} sorun',
    'upload.title': 'Analiz için bir sözleşme bırakın',
    'upload.sub': 'PDF, DOCX veya TXT · Yapay zeka saniyeler içinde analiz eder',
    'upload.btn': '↑ Sözleşme Yükle',
    'section.overview': 'Genel Bakış',
    'stat.analyzed': 'Analiz Edilen Sözleşmeler',
    'stat.issues': 'Bulunan Sorunlar',
    'stat.suggestions': 'Uygulanan Öneriler',
    'stat.archived': 'Arşivlendi',
    'section.contract': 'Mevcut Sözleşme — Satıcı Anlaşması, Acme Corp',
    'section.contractDynamic': 'Mevcut Sözleşme — {name}',
    'viewer.expand': 'Genişlet',
    'viewer.collapse': 'Daralt',
    'section.analysis': 'Analiz Sonuçları',
    'panel.risks': 'Hatalar ve Riskler',
    'panel.risksFound': '3 bulundu',
    'panel.risksFoundDynamic': '{n} bulundu',
    'panel.aiSuggestions': 'Yapay Zeka Önerileri',
    'panel.sugCount': '3 öneri',
    'panel.sugCountDynamic': '{n} öneri',
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
    'msg.switch.clean': '"{name}" sözleşmesine geçildi. Bu sözleşme temiz görünüyor — kritik sorun tespit edilmedi.',
    'msg.switch.issues': '"{name}" sözleşmesine geçildi. Bu sözleşmede {n} sorun bulundu{s}. Detayları sorabilirsiniz.',
    'sev.high': 'Yüksek',
    'sev.medium': 'Orta',
    'sev.low': 'Düşük',
    'view.analyze.title': 'Sözleşme Analizi',
    'view.analyze.subtitle': 'Ayrıntılı sorunları görmek için bir sözleşme yükleyin',
    'view.analyze.archive': 'Arşivle',
    'view.analyze.archived': 'Arşivlendi!',
    'view.analyze.download': '↓ İndir',
    'view.analyze.editDoc': 'Belgeyi Düzenle',
    'view.analyze.editable': 'Düzenlenebilir',
    'view.analyze.empty': 'Sözleşme yüklenmedi',
    'view.analyze.emptySub': 'Ayrıntılı analiz için bir sözleşme yükleyin veya kenar çubuğundan seçin.',
    'view.archive.title': 'Arşiv',
    'view.archive.subtitle': 'Arşivlenmiş sözleşmeler ve belge görüntüleyici',
    'view.archive.empty': 'Henüz arşivlenmiş sözleşme yok',
    'view.archive.emptySub': 'Sözleşmeleri Analiz görünümünden arşivleyerek buraya ekleyebilirsiniz.',
    'view.archive.archivedOn': '{date} tarihinde arşivlendi',
    'view.archive.download': '↓ İndir',
    'view.archive.close': '✕',
    'view.suggestions.title': 'Öneriler',
    'view.suggestions.subtitle': 'Mevcut sözleşme için ayrıntılı yapay zeka önerileri',
    'view.suggestions.empty': 'Henüz öneri yok',
    'view.suggestions.emptySub': 'Yapay zeka önerileri almak için bir sözleşme yükleyin.',
    'view.suggestions.applyAll': 'Tümünü Uygula',
    'view.suggestions.download': '↓ Değiştirilmiş Sözleşmeyi İndir',
    'view.suggestions.compareTitle': 'Önce / Sonra',
    'view.suggestions.before': 'Orijinal',
    'view.suggestions.after': 'Değiştirilmiş',
  }
};

let currentLang = 'tr';
let currentTheme = 'system';

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
  refreshDynamicLocalizedSections();
  updateContractViewerToggleLabel();
  updateThemeSwitchUI();
}

function pluralSuffix(n) {
  return currentLang === 'en' && n !== 1 ? 's' : '';
}

function currentLocale() {
  return currentLang === 'tr' ? 'tr-TR' : 'en-US';
}

function formatDynamicContractTitle(name) {
  return t('section.contractDynamic').replace('{name}', name);
}

function formatDynamicRisksFound(n) {
  return t('panel.risksFoundDynamic').replace('{n}', n);
}

function formatDynamicSuggestionCount(n) {
  return t('panel.sugCountDynamic').replace('{n}', n).replace('{s}', pluralSuffix(n));
}

function formatDynamicMeta(issueCount, dateText) {
  const base = issueCount === 0
    ? t('meta.cleanDynamic')
    : t('meta.issuesDynamic').replace('{n}', issueCount).replace('{s}', pluralSuffix(issueCount));
  return `${base} · ${dateText}`;
}

function refreshDynamicLocalizedSections() {
  if (currentContractName) {
    const titleEl = document.querySelector('[data-i18n="section.contract"]');
    if (titleEl) titleEl.textContent = formatDynamicContractTitle(currentContractName);
  }

  if (currentAnalysis) {
    const issueCount = currentAnalysis.issues?.length || 0;
    const sugCount = currentAnalysis.suggestions?.length || 0;

    const issuesBadge = document.querySelector('[data-i18n="panel.risksFound"]');
    if (issuesBadge) issuesBadge.textContent = formatDynamicRisksFound(issueCount);

    const sugBadge = document.querySelector('[data-i18n="panel.sugCount"]');
    if (sugBadge) sugBadge.textContent = formatDynamicSuggestionCount(sugCount);

    const issuesEmpty = document.querySelector('#issues-panel-body .panel-empty');
    if (issuesEmpty) issuesEmpty.textContent = t('issues.none');

    const sugEmpty = document.querySelector('#suggestions-panel-body .panel-empty');
    if (sugEmpty) sugEmpty.textContent = t('suggestions.none');
  }

  document.querySelectorAll('#suggestions-panel-body .apply-btn').forEach(btn => {
    btn.textContent = btn.classList.contains('applied') || btn.disabled ? t('apply.done') : t('apply.btn');
  });

  document.querySelectorAll('.contract-item[data-dynamic="1"]').forEach(item => {
    const issueCount = Number(item.dataset.issueCount || '0');
    const dateIso = item.dataset.dateIso;
    const date = dateIso
      ? new Date(dateIso).toLocaleDateString(currentLocale(), { month: 'short', day: 'numeric' })
      : '';
    const metaText = item.querySelector('.contract-meta span:last-child');
    if (metaText) metaText.textContent = formatDynamicMeta(issueCount, date);
  });
}

function updateContractViewerToggleLabel() {
  const btn = document.getElementById('contract-expand-btn');
  const modalCloseBtn = document.getElementById('contract-modal-close');
  if (btn) {
    btn.title = contractViewerExpanded ? t('viewer.collapse') : t('viewer.expand');
    btn.innerHTML = contractViewerExpanded
      ? `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="4 14 10 14 10 20"/><polyline points="20 10 14 10 14 4"/><line x1="10" y1="14" x2="3" y2="21"/><line x1="21" y1="3" x2="14" y2="10"/></svg>`
      : `<svg xmlns="http://www.w3.org/2000/svg" width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><polyline points="15 3 21 3 21 9"/><polyline points="9 21 3 21 3 15"/><line x1="21" y1="3" x2="14" y2="10"/><line x1="3" y1="21" x2="10" y2="14"/></svg>`;
  }
  if (modalCloseBtn) modalCloseBtn.textContent = t('viewer.collapse');
}

function toggleContractViewer() {
  if (contractViewerExpanded) {
    closeContractViewerModal();
    return;
  }
  openContractViewerModal();
}

function syncContractViewerModal() {
  if (!contractViewerExpanded) return;
  const src = document.getElementById('contract-doc');
  const dst = document.getElementById('contract-modal-doc');
  const title = document.querySelector('[data-i18n="section.contract"]');
  const modalTitle = document.querySelector('.contract-modal-title');
  if (!src || !dst) return;
  dst.className = src.className;
  dst.id = 'contract-modal-doc';
  dst.innerHTML = src.innerHTML;
  if (title && modalTitle) modalTitle.textContent = title.textContent;

  // Show compare button if original was snapshotted
  const compareBtn = document.getElementById('compare-toggle-btn');
  if (compareBtn) compareBtn.style.display = originalDocHtml ? 'inline-flex' : 'none';

  // If compare mode is active, refresh both columns too
  if (compareModeActive) refreshCompareColumns();
}

function openContractViewerModal() {
  const modal = document.getElementById('contract-modal');
  if (!modal) return;
  contractViewerExpanded = true;
  modal.classList.add('open');
  document.body.classList.add('no-scroll');
  syncContractViewerModal();
  // Show compare button if applicable
  const compareBtn = document.getElementById('compare-toggle-btn');
  if (compareBtn) compareBtn.style.display = originalDocHtml ? 'inline-flex' : 'none';
  const modalDoc = document.getElementById('contract-modal-doc');
  if (modalDoc) modalDoc.scrollTop = 0;
  updateContractViewerToggleLabel();
}

function closeContractViewerModal() {
  const modal = document.getElementById('contract-modal');
  contractViewerExpanded = false;
  if (modal) modal.classList.remove('open');
  document.body.classList.remove('no-scroll');
  updateContractViewerToggleLabel();
  // Exit compare mode when closing
  if (compareModeActive) {
    compareModeActive = false;
    const compareView = document.getElementById('contract-modal-compare');
    const mainDoc = document.getElementById('contract-modal-doc');
    if (compareView) compareView.style.display = 'none';
    if (mainDoc) mainDoc.style.display = '';
    const compareBtn = document.getElementById('compare-toggle-btn');
    if (compareBtn) compareBtn.textContent = '\u21d4 Kar\u015f\u0131la\u015ft\u0131r';
  }
}

function toggleCompareMode() {
  compareModeActive = !compareModeActive;
  const compareView = document.getElementById('contract-modal-compare');
  const mainDoc = document.getElementById('contract-modal-doc');
  const compareBtn = document.getElementById('compare-toggle-btn');
  if (compareModeActive) {
    refreshCompareColumns();
    if (compareView) compareView.style.display = 'flex';
    if (mainDoc) mainDoc.style.display = 'none';
    if (compareBtn) compareBtn.textContent = '\u2715 Tek G\u00f6r\u00fcn\u00fcm';
  } else {
    if (compareView) compareView.style.display = 'none';
    if (mainDoc) mainDoc.style.display = '';
    if (compareBtn) compareBtn.textContent = '\u21d4 Kar\u015f\u0131la\u015ft\u0131r';
  }
}

function refreshCompareColumns() {
  const beforeEl = document.getElementById('compare-doc-before');
  const afterEl  = document.getElementById('compare-doc-after');
  const currentSrc = document.getElementById('contract-doc');
  if (beforeEl && originalDocHtml !== null) beforeEl.innerHTML = originalDocHtml;
  if (afterEl) {
    if (originalContractText && currentContractText) {
      afterEl.innerHTML = buildTrackChangesHtml(originalContractText, currentContractText);
    } else if (currentSrc) {
      afterEl.innerHTML = currentSrc.innerHTML;
    }
  }
}

// ── Track-changes diff engine ────────────────────────────────────────────────

function lcsDiff(a, b) {
  const m = a.length, n = b.length;
  if (m === 0 && n === 0) return [];
  const dp = new Array(m + 1);
  for (let i = 0; i <= m; i++) { dp[i] = new Int32Array(n + 1); }
  for (let i = 1; i <= m; i++)
    for (let j = 1; j <= n; j++)
      dp[i][j] = a[i-1] === b[j-1]
        ? dp[i-1][j-1] + 1
        : Math.max(dp[i-1][j], dp[i][j-1]);
  const ops = [];
  let i = m, j = n;
  while (i > 0 || j > 0) {
    if (i > 0 && j > 0 && a[i-1] === b[j-1]) {
      ops.push({ type: 'equal', value: a[i-1] }); i--; j--;
    } else if (j > 0 && (i === 0 || dp[i][j-1] >= dp[i-1][j])) {
      ops.push({ type: 'insert', value: b[j-1] }); j--;
    } else {
      ops.push({ type: 'delete', value: a[i-1] }); i--;
    }
  }
  return ops.reverse();
}

function tokenizeText(text) {
  return (text.match(/[^\s]+|\s+/g) || []);
}

function buildTrackChangesHtml(oldText, newText) {
  if (!oldText || !newText) {
    return `<div class="word-doc-body track-changes-doc">${escapeHtml(newText || '')}</div>`;
  }

  const oldLines = oldText.split('\n');
  const newLines = newText.split('\n');
  const lineOps = lcsDiff(oldLines, newLines);

  let html = '<div class="word-doc-body track-changes-doc">';
  let i = 0;
  while (i < lineOps.length) {
    const op = lineOps[i];
    if (op.type === 'equal') {
      html += escapeHtml(op.value) + '\n';
      i++;
    } else {
      // Collect a run of del/ins lines
      const delLines = [];
      const insLines = [];
      while (i < lineOps.length && lineOps[i].type === 'delete') { delLines.push(lineOps[i].value); i++; }
      while (i < lineOps.length && lineOps[i].type === 'insert') { insLines.push(lineOps[i].value); i++; }

      if (delLines.length > 0 && insLines.length > 0) {
        // Replaced block — do word-level diff
        const oldWords = tokenizeText(delLines.join('\n'));
        const newWords = tokenizeText(insLines.join('\n'));
        const wordOps = (oldWords.length * newWords.length > 150000)
          ? [{ type: 'delete', value: delLines.join('\n') }, { type: 'insert', value: insLines.join('\n') }]
          : lcsDiff(oldWords, newWords);
        for (const wop of wordOps) {
          const v = escapeHtml(wop.value);
          if (wop.type === 'equal')  html += v;
          else if (wop.type === 'delete') html += `<del class="tc-del">${v}</del>`;
          else                            html += `<ins class="tc-ins">${v}</ins>`;
        }
        html += '\n';
      } else if (delLines.length > 0) {
        html += `<del class="tc-del">${escapeHtml(delLines.join('\n'))}</del>\n`;
      } else {
        html += `<ins class="tc-ins">${escapeHtml(insLines.join('\n'))}</ins>\n`;
      }
    }
  }
  html += '</div>';
  return html;
}

function getSystemTheme() {
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
}

function updateThemeSwitchUI() {
  const mapping = ['light', 'dark', 'system'];
  mapping.forEach(mode => {
    const el = document.getElementById(`theme-${mode}`);
    if (!el) return;
    el.classList.toggle('active', currentTheme === mode);
  });

  const lightBtn = document.getElementById('theme-light');
  const darkBtn = document.getElementById('theme-dark');
  const systemBtn = document.getElementById('theme-system');

  if (lightBtn) {
    lightBtn.title = t('theme.light');
    lightBtn.setAttribute('aria-label', t('theme.light'));
  }
  if (darkBtn) {
    darkBtn.title = t('theme.dark');
    darkBtn.setAttribute('aria-label', t('theme.dark'));
  }
  if (systemBtn) {
    systemBtn.title = t('theme.system');
    systemBtn.setAttribute('aria-label', t('theme.system'));
  }
}

function applyTheme(theme, persist = true) {
  currentTheme = ['light', 'dark', 'system'].includes(theme) ? theme : 'system';
  const resolved = currentTheme === 'system' ? getSystemTheme() : currentTheme;
  document.body.classList.toggle('theme-dark', resolved === 'dark');
  if (persist) localStorage.setItem('clauseai-theme', currentTheme);
  updateThemeSwitchUI();
}

function toggleTheme() {
  const order = ['light', 'dark', 'system'];
  const idx = order.indexOf(currentTheme);
  applyTheme(order[(idx + 1) % order.length]);
}

function setThemePreference(theme) {
  applyTheme(theme);
}

function getInitialTheme() {
  try {
    const saved = localStorage.getItem('clauseai-theme');
    if (saved === 'dark' || saved === 'light' || saved === 'system') return saved;
  } catch {}
  return 'system';
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

function sanitizeDocHtml(html) {
  return String(html || '')
    .replace(/<script[\s\S]*?>[\s\S]*?<\/script>/gi, '')
    .replace(/on\w+\s*=\s*"[^"]*"/gi, '')
    .replace(/on\w+\s*=\s*'[^']*'/gi, '');
}

async function readContractFileContent(file) {
  const ext = file.name.split('.').pop().toLowerCase();
  if (ext === 'docx') {
    const arrayBuffer = await file.arrayBuffer();
    const [textResult, htmlResult] = await Promise.all([
      mammoth.extractRawText({ arrayBuffer }),
      mammoth.convertToHtml({ arrayBuffer }),
    ]);
    return {
      text: textResult.value || '',
      html: sanitizeDocHtml(htmlResult.value || ''),
      docxBuffer: arrayBuffer,
      isRichDoc: true,
    };
  }

  const text = await readFileAsText(file);
  return { text, html: '', docxBuffer: null, isRichDoc: false };
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

async function ollamaChat(systemPrompt, messages, maxTokens = 1024, ctx = OLLAMA_CTX) {
  const res = await fetch(`${OLLAMA_BASE}/chat/completions`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: OLLAMA_MODEL,
      stream: false,
      options: { num_ctx: ctx },
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

  // If response includes extra trailing text, keep only the first full top-level JSON object.
  let depth = 0;
  let inString = false;
  let escaped = false;
  let endIndex = -1;
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
    if (ch === '}') {
      depth = Math.max(0, depth - 1);
      if (depth === 0) {
        endIndex = i;
        break;
      }
    }
  }

  if (endIndex !== -1) candidate = candidate.slice(0, endIndex + 1);

  // If response is truncated (common with local models), recover by balancing braces.
  depth = 0;
  inString = false;
  escaped = false;
  for (let i = 0; i < candidate.length; i++) {
    const ch = candidate[i];
    if (escaped) { escaped = false; continue; }
    if (ch === '\\') { escaped = true; continue; }
    if (ch === '"') { inString = !inString; continue; }
    if (inString) continue;
    if (ch === '{') depth++;
    if (ch === '}') depth = Math.max(0, depth - 1);
  }
  if (depth > 0) candidate += '}'.repeat(depth);

  // Normalize a few common malformed model patterns.
  candidate = candidate
    .replace(/[“”]/g, '"')
    .replace(/[‘’]/g, "'")
    // Fix accidental quote before markdown close: ...!"**"
    .replace(/"\*\*(?=")/g, '**');

  // Remove trailing commas that some models emit in JSON-like output.
  const normalized = candidate.replace(/,\s*([}\]])/g, '$1');

  return JSON.parse(normalized);
}

async function repairAnalysisJsonWithLLM(rawText) {
  const repairedRaw = await ollamaChat(
    `You repair malformed JSON for a contract analysis tool.
Return ONLY valid JSON in this exact schema:
{
  "summary": "...",
  "issues": [{"severity":"high|medium|low","text":"...","location":"...","tag":"Inaccuracy|Missing|Risk|Contradiction"}],
  "suggestions": [{"title":"...","body":"..."}],
  "initialMessage": "..."
}
Rules:
- Keep original meaning
- Fix escaping and invalid quotes
- Do not output markdown or explanations`,
    [{ role: 'user', content: String(rawText || '') }],
    1500
  );
  return parseAnalysisJson(repairedRaw);
}

function languageTargetCode() {
  return currentLang === 'tr' ? 'tr' : 'en';
}

function normalizeAiText(text) {
  let s = String(text || '')
    .normalize('NFC')
    .replace(/[\u200B-\u200D\uFEFF]/g, '')
    .replace(/\u00A0/g, ' ');

  if (currentLang === 'tr') {
    const charMap = {
      'ä': 'a', 'Ä': 'A', 'á': 'a', 'Á': 'A', 'à': 'a', 'À': 'A', 'â': 'a', 'Â': 'A',
      'ã': 'a', 'Ã': 'A', 'å': 'a', 'Å': 'A',
      'é': 'e', 'É': 'E', 'è': 'e', 'È': 'E', 'ê': 'e', 'Ê': 'E', 'ë': 'e', 'Ë': 'E',
      'í': 'i', 'Í': 'I', 'ì': 'i', 'Ì': 'I', 'î': 'i', 'Î': 'I', 'ï': 'i', 'Ï': 'I',
      'ó': 'o', 'Ó': 'O', 'ò': 'o', 'Ò': 'O', 'ô': 'o', 'Ô': 'O', 'õ': 'o', 'Õ': 'O',
      'ú': 'u', 'Ú': 'U', 'ù': 'u', 'Ù': 'U', 'û': 'u', 'Û': 'U', 'ü': 'ü', 'Ü': 'Ü',
      'ñ': 'n', 'Ñ': 'N'
    };
    s = s.replace(/[äÄáÁàÀâÂãÃåÅéÉèÈêÊëËíÍìÌîÎïÏóÓòÒôÔõÕúÚùÙûÛüÜñÑ]/g, (ch) => charMap[ch] || ch);
    s = s.replace(/i̇/g, 'i').replace(/İ/g, 'İ');
    s = s.replace(/\b(recommend|recommended|recommendation)\b/gi, 'önerilir');
    s = s.replace(/\b(obligation|obligations)\b/gi, 'yükümlülük');
    s = s.replace(/\b(clarify|clarification)\b/gi, 'netleştirme');
  }

  return s;
}

function normalizeAnalysisTextFields(analysis) {
  if (!analysis || typeof analysis !== 'object') return analysis;
  return {
    ...analysis,
    summary: normalizeAiText(analysis.summary || ''),
    initialMessage: normalizeAiText(analysis.initialMessage || ''),
    issues: Array.isArray(analysis.issues)
      ? analysis.issues.map(i => ({
          ...i,
          text: normalizeAiText(i?.text || ''),
          location: normalizeAiText(i?.location || ''),
        }))
      : [],
    suggestions: Array.isArray(analysis.suggestions)
      ? analysis.suggestions.map(s => ({
          ...s,
          title: normalizeAiText(s?.title || ''),
          body: normalizeAiText(s?.body || ''),
        }))
      : [],
  };
}

function isLikelyTurkish(text) {
  const s = String(text || '').toLowerCase();
  if (!s.trim()) return currentLang === 'tr';
  const trChars = (s.match(/[çğıöşü]/g) || []).length;
  const trWords = (s.match(/\b(ve|ile|için|bu|sözleşme|madde|risk|öneri|analiz|tespit|bulundu)\b/g) || []).length;
  return trChars >= 2 || trWords >= 2;
}

function analysisTextBlob(analysis) {
  const issues = (analysis?.issues || []).map(i => `${i.text || ''} ${i.location || ''}`).join(' ');
  const sugs = (analysis?.suggestions || []).map(s => `${s.title || ''} ${s.body || ''}`).join(' ');
  return `${analysis?.summary || ''} ${analysis?.initialMessage || ''} ${issues} ${sugs}`.trim();
}

function shouldTranslateToCurrentLang(text) {
  if (!String(text || '').trim()) return false;
  if (languageTargetCode() === 'tr') return !isLikelyTurkish(text);
  return isLikelyTurkish(text);
}

function looksForeignForTurkish(text) {
  const s = String(text || '').toLowerCase();
  if (!s.trim()) return false;
  return /\b(the|and|with|for|from|should|must|recommend|recommended|risk|clause|section|missing|inaccuracy|contradiction|definition|obligation|obligations|von|und|mit|der|die|das|verpflichtungen|klare|definition\b)/i.test(s);
}

async function translateTextToCurrentLang(text, force = false) {
  if (!force && !shouldTranslateToCurrentLang(text)) return text;
  const target = languageTargetCode() === 'tr' ? 'Turkish (Türkçe)' : 'English';
  const translated = await ollamaChat(
    `You are a translator. Translate the text into ${target}.
Rules:
- Preserve markdown emphasis and list structure
- Do not add commentary
- Return only translated text`,
    [{ role: 'user', content: String(text || '') }],
    900
  );
  return normalizeAiText(translated?.trim() || text);
}

async function translateAnalysisToCurrentLang(analysis, force = false) {
  const blob = analysisTextBlob(analysis);
  if (!force && !shouldTranslateToCurrentLang(blob)) return analysis;
  const target = languageTargetCode() === 'tr' ? 'Turkish (Türkçe)' : 'English';
  try {
    const translatedRaw = await ollamaChat(
      `You translate JSON field values only. Return ONLY valid JSON with this exact schema:
{
  "summary": "...",
  "issues": [{"severity":"high|medium|low","text":"...","location":"...","tag":"Inaccuracy|Missing|Risk|Contradiction"}],
  "suggestions": [{"title":"...","body":"..."}],
  "initialMessage": "..."
}

async function enforceStrictTurkishAnalysisLanguage(analysis) {
  if (currentLang !== 'tr' || !analysis) return analysis;

  const out = {
    ...analysis,
    summary: String(analysis.summary || ''),
    initialMessage: String(analysis.initialMessage || ''),
    issues: Array.isArray(analysis.issues) ? [...analysis.issues] : [],
    suggestions: Array.isArray(analysis.suggestions) ? [...analysis.suggestions] : [],
  };

  if (looksForeignForTurkish(out.summary)) {
    out.summary = await translateTextToCurrentLang(out.summary, true);
  }
  if (looksForeignForTurkish(out.initialMessage)) {
    out.initialMessage = await translateTextToCurrentLang(out.initialMessage, true);
  }

  out.issues = await Promise.all(out.issues.map(async (i) => {
    const issue = { ...i };
    if (looksForeignForTurkish(issue.text)) issue.text = await translateTextToCurrentLang(issue.text || '', true);
    if (looksForeignForTurkish(issue.location)) issue.location = await translateTextToCurrentLang(issue.location || '', true);
    return issue;
  }));

  out.suggestions = await Promise.all(out.suggestions.map(async (s) => {
    const sug = { ...s };
    if (looksForeignForTurkish(sug.title)) sug.title = await translateTextToCurrentLang(sug.title || '', true);
    if (looksForeignForTurkish(sug.body)) sug.body = await translateTextToCurrentLang(sug.body || '', true);
    return sug;
  }));

  return normalizeAnalysisTextFields(out);
}
Rules:
- Translate all user-facing text values into ${target}
- Keep severity and tag values unchanged
- Do not add/remove items
- Return JSON only`,
      [{ role: 'user', content: JSON.stringify(analysis) }],
      1400
    );
    return normalizeAnalysisTextFields(parseAnalysisJson(translatedRaw));
  } catch {
    const translated = {
      ...analysis,
      summary: await translateTextToCurrentLang(analysis.summary || '', true),
      initialMessage: await translateTextToCurrentLang(analysis.initialMessage || '', true),
      issues: await Promise.all((analysis.issues || []).map(async (i) => ({
        ...i,
        text: await translateTextToCurrentLang(i.text || '', true),
        location: await translateTextToCurrentLang(i.location || '', true),
      }))),
      suggestions: await Promise.all((analysis.suggestions || []).map(async (s) => ({
        ...s,
        title: await translateTextToCurrentLang(s.title || '', true),
        body: await translateTextToCurrentLang(s.body || '', true),
      }))),
    };
    return normalizeAnalysisTextFields(translated);
  }
}

async function fallbackAnalyzeContract(text, filename) {
  const raw = await ollamaChat(
    `You are a contract analysis AI. Return ONLY valid JSON in this exact schema:
{
  "summary": "...",
  "issues": [{"severity":"high|medium|low","text":"...","location":"...","tag":"Inaccuracy|Missing|Risk|Contradiction"}],
  "suggestions": [{"title":"...","body":"..."}],
  "initialMessage": "..."
}
Rules:
- Find at least 1 issue and 1 suggestion when possible
- If no issue is found, return empty arrays
- No markdown fences, no commentary`,
    [{ role: 'user', content: `Filename: ${filename}\n\nContract:\n${text.slice(0, 5000)}` }],
    1400
  );
  try {
    return parseAnalysisJson(raw);
  } catch {
    return repairAnalysisJsonWithLLM(raw);
  }
}

function buildDeterministicFallbackAnalysis(text, filename) {
  const tr = currentLang === 'tr';
  const src = String(text || '');
  const lower = src.toLowerCase();
  const findings = [];
  const suggestions = [];

  const contractType = (() => {
    if (/(nda|gizlilik|non-disclosure|confidentiality)/i.test(lower)) return 'nda';
    if (/(employment|iş sözleşmesi|employee|çalışan|personel)/i.test(lower)) return 'employment';
    if (/(saas|license|lisans|subscription|abonelik)/i.test(lower)) return 'saas';
    if (/(service|hizmet|vendor|tedarikçi|bakım|development|geliştirme)/i.test(lower)) return 'service';
    return 'generic';
  })();

  if (contractType === 'nda') {
    if (!/(5\s*(yıl|year)|36\s*(ay|month)|60\s*(ay|month))/i.test(lower)) {
      findings.push({
        severity: 'medium',
        text: tr
          ? 'Gizlilik süresi açık veya yeterli düzeyde tanımlanmamış görünüyor.'
          : 'Confidentiality duration is unclear or not sufficiently defined.',
        location: tr ? 'Gizlilik süresi maddesi' : 'Confidentiality term clause',
        tag: 'Missing',
      });
      suggestions.push({
        title: tr ? 'Gizlilik süresini netleştirin' : 'Define confidentiality term clearly',
        body: tr
          ? 'Gizlilik yükümlülüğünü yıl/ay bazında açık bir süre ile belirtin (ör. 5 yıl).'
          : 'Specify a concrete confidentiality duration (for example, 5 years).',
      });
    }
  }

  if (contractType === 'employment') {
    if (!/(fazla mesai|overtime)/i.test(lower)) {
      findings.push({
        severity: 'high',
        text: tr
          ? 'Fazla mesaiye ilişkin ücretlendirme veya yöntem belirtilmemiş olabilir.'
          : 'Overtime compensation terms may be missing.',
        location: tr ? 'Ücret / çalışma saatleri maddesi' : 'Compensation / working-hours clause',
        tag: 'Missing',
      });
      suggestions.push({
        title: tr ? 'Fazla mesai kuralı ekleyin' : 'Add overtime compensation rule',
        body: tr
          ? 'Fazla mesai onayı, hesap yöntemi ve ücret çarpanı açıkça düzenlenmelidir.'
          : 'Define overtime approval, calculation method, and compensation multiplier.',
      });
    }
  }

  if (contractType === 'saas') {
    if (!/(uptime|sla|erişilebilirlik|kesinti)/i.test(lower)) {
      findings.push({
        severity: 'medium',
        text: tr
          ? 'SLA / erişilebilirlik taahhütleri net görünmüyor.'
          : 'SLA / availability commitments are not clear.',
        location: tr ? 'Hizmet seviyesi maddeleri' : 'Service level clauses',
        tag: 'Missing',
      });
      suggestions.push({
        title: tr ? 'SLA hedefleri ekleyin' : 'Add SLA targets',
        body: tr
          ? 'Uptime oranı, destek yanıt süreleri ve ihlal halinde telafi mekanizması ekleyin.'
          : 'Include uptime target, support response times, and service credit terms.',
      });
    }
  }

  if (contractType === 'service') {
    if (!/(teslim|milestone|takvim|deadline|süre)/i.test(lower)) {
      findings.push({
        severity: 'medium',
        text: tr
          ? 'Teslim takvimi veya kilometre taşları yeterince açık olmayabilir.'
          : 'Delivery timeline or milestones may be insufficiently defined.',
        location: tr ? 'Teslim / zaman planı maddeleri' : 'Delivery / timeline clauses',
        tag: 'Inaccuracy',
      });
      suggestions.push({
        title: tr ? 'Teslim planını somutlaştırın' : 'Specify delivery milestones',
        body: tr
          ? 'Tarih bazlı kilometre taşları ve kabul kriterleri sözleşmeye eklenmelidir.'
          : 'Add date-based milestones and acceptance criteria to the contract.',
      });
    }
  }

  if (/(ödeme|payment|ücret|fee)/i.test(src) && /(belirtilmemiş|not specified|missing|\[.*\])/i.test(src)) {
    findings.push({
      severity: 'high',
      text: tr
        ? 'Ödeme tutarı veya ödeme koşulları açık değil; uygulanabilirlik riski oluşturabilir.'
        : 'Payment amount or payment terms are unclear, creating enforceability risk.',
      location: tr ? 'Ödeme maddesi' : 'Payment clause',
      tag: 'Missing',
    });
    suggestions.push({
      title: tr ? 'Ödeme maddesini netleştirin' : 'Clarify payment terms',
      body: tr
        ? 'Sabit tutar, para birimi, vade ve gecikme faizi gibi temel unsurları açıkça ekleyin.'
        : 'Add clear amount, currency, due date, and late-payment terms to the agreement.',
    });
  }

  if (/(sorumluluk|liability|sınırsız|unlimited)/i.test(src)) {
    findings.push({
      severity: 'medium',
      text: tr
        ? 'Sorumluluk sınırları belirsiz veya geniş görünüyor; taraflar için yüksek risk oluşturabilir.'
        : 'Liability limits appear broad or unclear and may create elevated risk for parties.',
      location: tr ? 'Sorumluluk maddeleri' : 'Liability clauses',
      tag: 'Risk',
    });
    suggestions.push({
      title: tr ? 'Sorumluluk sınırı ekleyin' : 'Add liability caps',
      body: tr
        ? 'Dolaylı zarar istisnaları ve toplam sorumluluk tavanı belirleyin.'
        : 'Define indirect-damage exclusions and a total liability cap.',
    });
  }

  if (findings.length === 0) {
    findings.push({
      severity: 'medium',
      text: tr
        ? 'Bazı hükümler yoruma açık görünüyor; ileride uyuşmazlık riski doğurabilir.'
        : 'Some clauses appear open to interpretation and may lead to disputes later.',
      location: tr ? 'Çeşitli bölümler' : 'Various sections',
      tag: 'Inaccuracy',
    });
  }

  if (suggestions.length === 0) {
    suggestions.push({
      title: tr ? 'Belirsiz ifadeleri somutlaştırın' : 'Clarify ambiguous language',
      body: tr
        ? 'Kritik maddelerde tanım, kapsam ve sorumlulukları örneklerle netleştirin.'
        : 'Clarify definitions, scope, and responsibilities with specific wording.',
    });
  }

  return {
    summary: tr
      ? `${filename} için otomatik yedek analiz üretildi. ${findings.length} risk alanı tespit edildi.`
      : `Generated deterministic fallback analysis for ${filename}. Detected ${findings.length} risk areas.`,
    issues: findings,
    suggestions,
    initialMessage: tr
      ? `**Analiz tamamlandı.** En az bir kritik/orta seviye risk ve uygulanabilir öneri üretildi.`
      : `**Analysis complete.** Produced at least one material risk and one actionable suggestion.`,
  };
}

function ensureAnalysisCompleteness(analysis, text, filename) {
  const validSeverity = new Set(['high', 'medium', 'low']);
  const validTag = new Set(['Inaccuracy', 'Missing', 'Risk', 'Contradiction']);

  const normalized = {
    summary: String(analysis?.summary || '').trim(),
    initialMessage: String(analysis?.initialMessage || '').trim(),
    issues: Array.isArray(analysis?.issues) ? analysis.issues.map(i => ({
      severity: validSeverity.has(i?.severity) ? i.severity : 'medium',
      text: String(i?.text || '').trim(),
      location: String(i?.location || '').trim(),
      tag: validTag.has(i?.tag) ? i.tag : 'Risk',
    })).filter(i => i.text) : [],
    suggestions: Array.isArray(analysis?.suggestions) ? analysis.suggestions.map(s => ({
      title: String(s?.title || '').trim(),
      body: String(s?.body || '').trim(),
    })).filter(s => s.title || s.body) : [],
  };

  const fallback = buildDeterministicFallbackAnalysis(text, filename);
  const target = targetCountsForText(text);
  const expanded = buildExpandedDeterministicFallback(text, filename);

  if (normalized.issues.length === 0) {
    normalized.issues = fallback.issues.slice(0, 1);
  }
  if (normalized.suggestions.length === 0) {
    normalized.suggestions = fallback.suggestions.slice(0, 1);
  }
  if (!normalized.summary) normalized.summary = fallback.summary;
  if (!normalized.initialMessage) normalized.initialMessage = fallback.initialMessage;

  const issueKeys = new Set(normalized.issues.map(i => i.text.toLowerCase().replace(/\W+/g, ' ').trim()));
  for (const issue of expanded.issues) {
    if (normalized.issues.length >= target.issues) break;
    const key = String(issue.text || '').toLowerCase().replace(/\W+/g, ' ').trim();
    if (!key || issueKeys.has(key)) continue;
    issueKeys.add(key);
    normalized.issues.push(issue);
  }

  const sugKeys = new Set(normalized.suggestions.map(s => `${s.title} ${s.body}`.toLowerCase().replace(/\W+/g, ' ').trim()));
  for (const sug of expanded.suggestions) {
    if (normalized.suggestions.length >= target.suggestions) break;
    const key = `${sug.title} ${sug.body}`.toLowerCase().replace(/\W+/g, ' ').trim();
    if (!key || sugKeys.has(key)) continue;
    sugKeys.add(key);
    normalized.suggestions.push(sug);
  }

  return normalizeAnalysisTextFields(normalized);
}

function targetCountsForText(text) {
  const n = String(text || '').length;
  if (n > 120000) return { issues: 14, suggestions: 10 };
  if (n > 70000) return { issues: 10, suggestions: 8 };
  if (n > 30000) return { issues: 8, suggestions: 6 };
  if (n > 15000) return { issues: 6, suggestions: 4 };
  return { issues: 4, suggestions: 3 };
}

function buildExpandedDeterministicFallback(text, filename) {
  const base = buildDeterministicFallbackAnalysis(text, filename);
  const tr = currentLang === 'tr';
  const src = String(text || '').toLowerCase();

  const candidates = {
    issues: [
      {
        severity: 'medium',
        text: tr ? 'Yetkili mahkeme ve uygulanacak hukuk açık değil olabilir.' : 'Governing law and jurisdiction may not be clearly defined.',
        location: tr ? 'Uyuşmazlık çözümü maddesi' : 'Dispute resolution clause',
        tag: 'Missing',
      },
      {
        severity: 'medium',
        text: tr ? 'Fesih koşulları ve bildirim süreleri dengesiz veya belirsiz olabilir.' : 'Termination conditions and notice periods may be imbalanced or unclear.',
        location: tr ? 'Fesih maddeleri' : 'Termination clauses',
        tag: 'Risk',
      },
      {
        severity: 'low',
        text: tr ? 'Değişiklik yönetimi ve versiyonlama süreci net tanımlanmamış olabilir.' : 'Change management and versioning process may be under-defined.',
        location: tr ? 'Değişiklik / kapsam maddeleri' : 'Change/scope clauses',
        tag: 'Inaccuracy',
      },
      {
        severity: 'medium',
        text: tr ? 'Veri koruma ve gizlilik yükümlülükleri teknik/operasyonel detay açısından yetersiz olabilir.' : 'Data protection and confidentiality obligations may lack operational detail.',
        location: tr ? 'Veri koruma maddeleri' : 'Data protection clauses',
        tag: 'Risk',
      },
      {
        severity: 'medium',
        text: tr ? 'Kabul kriterleri ve teslim koşulları ölçülebilir şekilde tanımlanmamış olabilir.' : 'Acceptance criteria and delivery conditions may not be measurable enough.',
        location: tr ? 'Teslim / kabul maddeleri' : 'Delivery/acceptance clauses',
        tag: 'Missing',
      },
    ],
    suggestions: [
      {
        title: tr ? 'Uyuşmazlık çözümü maddesini netleştirin' : 'Clarify dispute resolution terms',
        body: tr ? 'Uygulanacak hukuk, yetkili mahkeme ve arabuluculuk/tahkim adımlarını açıkça yazın.' : 'Specify governing law, venue, and mediation/arbitration sequence explicitly.',
      },
      {
        title: tr ? 'Fesih ve bildirim hükümlerini dengeleyin' : 'Balance termination and notice provisions',
        body: tr ? 'Her iki taraf için simetrik bildirim süresi ve haklı fesih nedenleri tanımlayın.' : 'Define symmetric notice periods and justified termination grounds for both parties.',
      },
      {
        title: tr ? 'Teslim ve kabul kriterlerini ölçülebilir hale getirin' : 'Make delivery/acceptance criteria measurable',
        body: tr ? 'KPI, test senaryosu ve onay süresi gibi kriterleri sözleşmeye ekleyin.' : 'Add KPI, test scenarios, and acceptance timeline to the contract.',
      },
      {
        title: tr ? 'Veri güvenliği ekini güçlendirin' : 'Strengthen data security appendix',
        body: tr ? 'Erişim kontrolü, loglama, ihlal bildirimi ve saklama sürelerini netleştirin.' : 'Clarify access control, logging, breach notification, and retention periods.',
      },
    ],
  };

  if (/(jurisdiction|mahkeme|hukuk|law|dispute|uyuşmazlık)/i.test(src)) {
    candidates.issues.unshift({
      severity: 'high',
      text: tr ? 'Uyuşmazlık çözümü maddelerinde taraflar arasında yorum farklılığı riski var.' : 'Dispute resolution wording may allow conflicting interpretations between parties.',
      location: tr ? 'Uyuşmazlık çözümü maddesi' : 'Dispute resolution clause',
      tag: 'Inaccuracy',
    });
  }

  return {
    ...base,
    issues: [...base.issues, ...candidates.issues],
    suggestions: [...base.suggestions, ...candidates.suggestions],
  };
}

function splitContractIntoChunks(text, chunkSize = 5500, maxChunks = 4) {
  const src = String(text || '');
  if (src.length <= chunkSize) return [src];
  const chunks = [];
  const step = Math.max(1, Math.floor((src.length - chunkSize) / (maxChunks - 1)));
  for (let i = 0; i < maxChunks; i++) {
    const start = i * step;
    const chunk = src.slice(start, start + chunkSize);
    if (chunk.trim()) chunks.push(chunk);
  }
  return chunks;
}

function mergeAnalyses(analyses, filename) {
  const tr = currentLang === 'tr';
  const merged = {
    summary: analyses[0]?.summary || '',
    issues: [],
    suggestions: [],
    initialMessage: analyses[0]?.initialMessage || '',
  };

  const issueKeys = new Set();
  const sugKeys = new Set();

  for (const a of analyses) {
    for (const i of (a?.issues || [])) {
      const key = String(i?.text || '').toLowerCase().replace(/\W+/g, ' ').trim();
      if (!key || issueKeys.has(key)) continue;
      issueKeys.add(key);
      merged.issues.push(i);
    }
    for (const s of (a?.suggestions || [])) {
      const key = `${s?.title || ''} ${s?.body || ''}`.toLowerCase().replace(/\W+/g, ' ').trim();
      if (!key || sugKeys.has(key)) continue;
      sugKeys.add(key);
      merged.suggestions.push(s);
    }
  }

  if (!merged.summary) {
    merged.summary = tr
      ? `${filename} için çok bölümlü analiz tamamlandı.`
      : `Multi-section analysis completed for ${filename}.`;
  }
  merged.initialMessage = tr
    ? `**Analiz tamamlandı.** ${merged.issues.length} risk/sorun ve ${merged.suggestions.length} öneri tespit edildi.`
    : `**Analysis complete.** Found ${merged.issues.length} issues/risks and ${merged.suggestions.length} suggestions.`;

  return merged;
}

async function analyzeSnippetWithLLM(contractSnippet, filename, label = '') {
  const rawText = await ollamaChat(
    buildAnalysisSystemPrompt(),
    [{ role: "user", content: `Analyze this contract ${label ? `(${label})` : ''}:\n\nFilename: ${filename}\n\nMinimum target for this part: find at least 3 issues and 2 suggestions when possible.\n\n${contractSnippet}` }],
    1024,
    OLLAMA_CTX_ANALYSIS
  );

  try {
    const parsed = parseAnalysisJson(rawText);
    const localized = await enforceStrictTurkishAnalysisLanguage(await translateAnalysisToCurrentLang(parsed, true));
    return ensureAnalysisCompleteness(localized, contractSnippet, filename);
  } catch (err) {
    console.error('Raw Ollama analysis response:', rawText);
    try {
      const repaired = await repairAnalysisJsonWithLLM(rawText);
      const localized = await enforceStrictTurkishAnalysisLanguage(await translateAnalysisToCurrentLang(repaired, true));
      return ensureAnalysisCompleteness(localized, contractSnippet, filename);
    } catch (repairErr) {
      try {
        const fallback = await fallbackAnalyzeContract(contractSnippet, filename);
        const localized = await enforceStrictTurkishAnalysisLanguage(await translateAnalysisToCurrentLang(fallback, true));
        return ensureAnalysisCompleteness(localized, contractSnippet, filename);
      } catch (fallbackErr) {
        console.error('Chunk analysis failed, using deterministic fallback.', { err, repairErr, fallbackErr });
        return buildExpandedDeterministicFallback(contractSnippet, filename);
      }
    }
  }
}

async function analyzeContractWithLLM(text, filename) {
  const contractText = String(text || '');
  // Use a single large chunk for typical contracts; only split very large docs.
  // Chunks are analyzed in parallel (Promise.all) for max speed.
  const maxChunks = contractText.length > 80000 ? 3 : contractText.length > 25000 ? 2 : 1;
  const chunks = splitContractIntoChunks(contractText, 6000, maxChunks);

  const analyses = await Promise.all(
    chunks.map((chunk, i) => analyzeSnippetWithLLM(chunk, filename, chunks.length > 1 ? `part ${i + 1}/${chunks.length}` : ''))
  );

  const merged = mergeAnalyses(analyses, filename);
  return ensureAnalysisCompleteness(merged, contractText, filename);
}

function localizeTag(tag) {
  if (currentLang !== 'tr') return tag;
  const map = {
    Inaccuracy: 'Tutarsızlık',
    Missing: 'Eksik',
    Risk: 'Risk',
    Contradiction: 'Çelişki',
  };
  return map[tag] || tag;
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

function formatInlineMarkdown(escapedText) {
  return escapedText
    .replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>')
    .replace(/\*(.+?)\*/g, '<em>$1</em>');
}

function formatAiMessage(text) {
  const lines = String(text || '').split(/\r?\n/);
  const html = [];
  let inUl = false;
  let inOl = false;

  const closeLists = () => {
    if (inUl) { html.push('</ul>'); inUl = false; }
    if (inOl) { html.push('</ol>'); inOl = false; }
  };

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) {
      closeLists();
      continue;
    }

    const ulMatch = line.match(/^[-*]\s+(.+)$/);
    if (ulMatch) {
      if (inOl) { html.push('</ol>'); inOl = false; }
      if (!inUl) { html.push('<ul>'); inUl = true; }
      html.push(`<li>${formatInlineMarkdown(escapeHtml(ulMatch[1]))}</li>`);
      continue;
    }

    const olMatch = line.match(/^\d+\.\s+(.+)$/);
    if (olMatch) {
      if (inUl) { html.push('</ul>'); inUl = false; }
      if (!inOl) { html.push('<ol>'); inOl = true; }
      html.push(`<li>${formatInlineMarkdown(escapeHtml(olMatch[1]))}</li>`);
      continue;
    }

    closeLists();
    html.push(`<p>${formatInlineMarkdown(escapeHtml(line))}</p>`);
  }

  closeLists();
  return html.join('') || `<p>${escapeHtml(String(text || ''))}</p>`;
}

async function renderContractDocument(filename) {
  const docEl = document.getElementById('contract-doc');
  if (!docEl) return;

  if (currentContractDocxBuffer && window.docx?.renderAsync && window.JSZip) {
    docEl.classList.add('is-docx');
    docEl.classList.remove('is-rich-doc');
    docEl.innerHTML = `<div class="docx-canvas"></div>`;
    const canvas = docEl.querySelector('.docx-canvas');
    try {
      await window.docx.renderAsync(currentContractDocxBuffer, canvas, null, {
        inWrapper: true,
        breakPages: true,
        className: 'docx',
        ignoreWidth: false,
        ignoreHeight: false,
        useBase64URL: true,
      });
      return;
    } catch (err) {
      console.error('DOCX preview render failed, using HTML fallback:', err);
      // continue to HTML fallback
    }
  }

  docEl.classList.remove('is-docx');
  if (currentContractHtml && currentContractHtml.trim()) {
    docEl.classList.add('is-rich-doc');
    docEl.innerHTML = `
      <div class="doc-title">${escapeHtml(filename.toUpperCase())}</div>
      <div class="word-doc-body">${currentContractHtml}</div>
    `;
    return;
  }

  docEl.classList.remove('is-rich-doc');
  docEl.innerHTML = `
    <div class="doc-title">${escapeHtml(filename.toUpperCase())}</div>
    <pre class="plain-doc-body">${escapeHtml(currentContractText || '')}</pre>
  `;
}

function wrapFirstTextMatch(root, query, issueIndex) {
  const target = String(query || '').trim();
  if (!target || target.length < 3) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const lowerTarget = target.toLowerCase();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue;
    const lowerValue = value.toLowerCase();
    const idx = lowerValue.indexOf(lowerTarget);
    if (idx === -1) continue;

    const before = value.slice(0, idx);
    const match = value.slice(idx, idx + target.length);
    const after = value.slice(idx + target.length);

    const mark = document.createElement('span');
    mark.className = 'issue-anchor';
    mark.dataset.issueAnchor = String(issueIndex);
    mark.textContent = match;

    const parent = node.parentNode;
    if (!parent) return false;
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(mark, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);
    return true;
  }
  return false;
}

function issueQueries(issue) {
  const queries = [];
  const loc = String(issue?.location || '').trim();
  if (loc) queries.push(loc);

  const text = String(issue?.text || '')
    .replace(/[.,;:()\[\]{}"']/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  if (text) {
    const words = text.split(' ').filter(w => w.length > 3).slice(0, 6);
    if (words.length >= 2) queries.push(words.join(' '));
    if (words.length >= 1) queries.push(words[0]);
  }
  return queries;
}

function annotateIssuesInDocument(issues) {
  const docEl = document.getElementById('contract-doc');
  if (!docEl || !Array.isArray(issues)) return;

  issues.forEach((issue, idx) => {
    const found = issueQueries(issue).some(q => wrapFirstTextMatch(docEl, q, idx));
    if (!found) {
      // no-op; issue can still be focused in the panel
    }
  });
}

function focusIssue(index) {
  document.querySelectorAll('#issues-panel-body .issue-item').forEach((el, i) => {
    el.classList.toggle('active', i === index);
  });

  const rootId = contractViewerExpanded ? '#contract-modal-doc' : '#contract-doc';
  const anchor = document.querySelector(`${rootId} [data-issue-anchor="${index}"]`);
  // Scroll the contract viewer section into view first
  const viewer = document.querySelector('.contract-viewer');
  if (viewer && !contractViewerExpanded) viewer.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  if (!anchor) return;
  setTimeout(() => {
    anchor.scrollIntoView({ behavior: 'smooth', block: 'center' });
    anchor.classList.add('focused');
    setTimeout(() => anchor.classList.remove('focused'), 1400);
  }, viewer && !contractViewerExpanded ? 320 : 0);
}

function focusAnalyzeIssue(idx) {
  // Highlight the card
  document.querySelectorAll('#analyze-issues-list .issue-detail-card').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });
  const issue = currentAnalysis?.issues?.[idx];
  if (!issue) return;

  const canvasEl = document.getElementById('analyze-doc-canvas');
  const richEditor = document.getElementById('analyze-doc-rich');
  const isCanvasVisible = canvasEl && canvasEl.style.display !== 'none';
  const isRichVisible   = richEditor && richEditor.style.display !== 'none';

  const docTarget = isCanvasVisible ? canvasEl : isRichVisible ? richEditor : null;
  if (docTarget) {
    docTarget.scrollIntoView({ behavior: 'smooth', block: 'start' });
    const baseQueries = issueQueries(issue);
    const wordQueries = String(issue.text || '')
      .replace(/[.,;:()\[\]{}"']/g, ' ')
      .split(/\s+/)
      .filter(w => w.length > 5)
      .slice(0, 8);
    const queries = [...new Set([...baseQueries, ...wordQueries])].filter(q => q.length > 2);

    for (const q of queries) {
      if (highlightAndScrollTextIn(docTarget, q)) return;
    }

    // DOCX render can complete slightly after click; retry once.
    if (isCanvasVisible) {
      setTimeout(() => {
        for (const q of queries) {
          if (highlightAndScrollTextIn(docTarget, q)) return;
        }
      }, 240);
    }

    if (!isCanvasVisible) docTarget.focus();
    return;
  }

  const editor = document.getElementById('analyze-doc-editor');
  if (!editor) return;
  // Ensure the text area is visible on smaller screens before internal scroll.
  editor.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const tryFindPos = (source, query) => {
    const q = String(query || '').trim();
    if (!q) return -1;
    const candidates = [
      q,
      q.replace(/[.,;:()\[\]{}"']/g, ' ').replace(/\s+/g, ' ').trim(),
      q.split(/\s+/).filter(w => w.length > 3).slice(0, 4).join(' '),
      q.split(/\s+/).filter(w => w.length > 4)[0] || '',
    ].filter(Boolean);
    const lowerSource = String(source || '').toLowerCase();
    for (const c of candidates) {
      const pos = lowerSource.indexOf(c.toLowerCase());
      if (pos !== -1) return pos;
    }
    return -1;
  };

  // Try location string first, then first words of issue text
  const queries = [
    String(issue.location || '').replace(/^(clause|madde|section|bölüm)\s*/i, '').trim(),
    String(issue.text || '').split(/[.,;:]/)[0].trim().slice(0, 60),
  ].filter(q => q.length > 2);
  const content = editor.value;
  for (const q of queries) {
    const pos = tryFindPos(content, q);
    if (pos === -1) continue;
    const linesBefore = content.slice(0, pos).split('\n').length;
    const lh = parseFloat(getComputedStyle(editor).lineHeight) || 23;
    editor.scrollTop = Math.max(0, (linesBefore - 3) * lh);
    editor.focus();
    editor.setSelectionRange(pos, Math.min(pos + q.length, content.length));
    return;
  }
  // No match — just focus the editor
  editor.focus();
}

function highlightAndScrollTextIn(root, query) {
  if (!root || !query) return false;

  const target = String(query).trim();
  if (target.length < 3) return false;

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, {
    acceptNode(node) {
      return node.nodeValue && node.nodeValue.trim()
        ? NodeFilter.FILTER_ACCEPT
        : NodeFilter.FILTER_REJECT;
    },
  });

  const lowerTarget = target.toLowerCase();
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const value = node.nodeValue;
    const lowerValue = value.toLowerCase();
    const idx = lowerValue.indexOf(lowerTarget);
    if (idx === -1) continue;

    const before = value.slice(0, idx);
    const match = value.slice(idx, idx + target.length);
    const after = value.slice(idx + target.length);

    const mark = document.createElement('span');
    mark.className = 'text-scroll-hit';
    mark.textContent = match;

    const parent = node.parentNode;
    if (!parent) return false;
    if (before) parent.insertBefore(document.createTextNode(before), node);
    parent.insertBefore(mark, node);
    if (after) parent.insertBefore(document.createTextNode(after), node);
    parent.removeChild(node);

    mark.scrollIntoView({ behavior: 'smooth', block: 'center' });
    setTimeout(() => mark.classList.remove('text-scroll-hit'), 1800);
    return true;
  }
  return false;
}

function focusSuggestionInView(idx) {
  document.querySelectorAll('#suggestions-detail-list .sug-detail-card').forEach((el, i) => {
    el.classList.toggle('active', i === idx);
  });

  const sug = currentAnalysis?.suggestions?.[idx];
  if (!sug) return;

  updateSuggestionsCompare(true);

  const compareEl = document.getElementById('suggestions-compare');
  if (compareEl && compareEl.style.display !== 'none') {
    compareEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
  }

  const afterPanel = document.getElementById('sug-compare-after');
  const beforePanel = document.getElementById('sug-compare-before');
  const applied = suggestionsAppliedSet.has(idx);

  const queries = [
    String(sug.title || '').trim(),
    String(sug.body || '').split(/[.,;:]/)[0].trim().slice(0, 80),
    ...String(sug.body || '').split(/\s+/).filter(w => w.length > 4).slice(0, 4),
  ].filter(q => q.length > 2);

  const targetPanel = applied ? (afterPanel || beforePanel) : (beforePanel || afterPanel);
  if (!targetPanel) return;

  if (applied) {
    const note = targetPanel.querySelector(`[data-suggestion-anchor="${idx}"]`);
    if (note) {
      note.scrollIntoView({ behavior: 'smooth', block: 'center' });
      note.classList.add('flash-highlight');
      setTimeout(() => note.classList.remove('flash-highlight'), 1800);
      return;
    }
  }

  for (const q of queries) {
    if (highlightAndScrollTextIn(targetPanel, q)) return;
  }
}

function buildEditableRichHtml() {
  if (currentContractHtml && String(currentContractHtml).trim()) {
    return `<div class="word-doc-body">${currentContractHtml}</div>`;
  }
  return `<pre class="plain-doc-body">${escapeHtml(currentContractText || '')}</pre>`;
}

function updateAnalyzeNavBadge() {
  const badge = document.getElementById('nav-analyze-badge');
  if (!badge) return;
  const fallback = document.querySelectorAll('#issues-panel-body .issue-item').length;
  const n = currentAnalysis?.issues?.length ?? fallback;
  badge.textContent = String(n);
  badge.style.display = n > 0 ? '' : 'none';
}

function updateSuggestionsNavBadge() {
  const badge = document.getElementById('nav-suggestions-badge');
  if (!badge) return;
  const fallback = document.querySelectorAll('#suggestions-panel-body .suggestion-item').length;
  const n = currentAnalysis?.suggestions?.length ?? fallback;
  badge.textContent = String(n);
  badge.style.display = n > 0 ? '' : 'none';
}

function replaceFirstRegexInTextNodes(root, pattern, replacement) {
  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT, null);
  while (walker.nextNode()) {
    const node = walker.currentNode;
    const val = node.nodeValue;
    if (!pattern.test(val)) continue;
    node.nodeValue = val.replace(pattern, replacement);
    return true;
  }
  return false;
}

// Use LLM to apply a suggestion to the current contract text.
// Returns the modified text, or null on failure.
async function applyWithLLM(suggestion) {
  if (!currentContractText || currentContractText.trim().length < 30) return null;
  const maxLen = 5500;
  const src = currentContractText.length > maxLen
    ? currentContractText.slice(0, maxLen) + '\n[...]'
    : currentContractText;
  try {
    const result = await ollamaChat(
      `You are a contract editor. Apply exactly the one suggestion below to the contract text. Return ONLY the modified full contract text — no explanation, no markdown fences, no preamble. Preserve all other clauses exactly.`,
      [{ role: 'user', content: `SUGGESTION: ${suggestion.title}\nDETAIL: ${suggestion.body}\n\nCONTRACT TEXT:\n${src}` }],
      2048,
      OLLAMA_CTX
    );
    const trimmed = (result || '').trim();
    if (trimmed.length < 30) return null;
    // Strip accidental fences
    return trimmed.replace(/^```[^\n]*\n?/,'').replace(/\n?```$/,'').trim();
  } catch (err) {
    console.warn('applyWithLLM failed:', err);
    return null;
  }
}

// Core apply: LLM-powered, with narrow-regex + annotation fallback.
async function applyDocumentEdit(suggestion) {
  const docEl = document.getElementById('contract-doc');
  if (!docEl) return;

  // Snapshot original BEFORE any changes
  if (!originalDocHtml) {
    originalDocHtml = docEl.innerHTML;
  }
  if (!originalContractText) {
    originalContractText = currentContractText || '';
  }

  const modified = await applyWithLLM(suggestion);

  if (modified && modified.trim() !== (currentContractText || '').trim()) {
    // ── LLM succeeded: update global text, re-render all doc panels ──
    currentContractText = modified;
    currentContractHtml = formatAiMessage(modified);
    currentContractDocxBuffer = null; // avoid showing stale original DOCX after edits

    // Dashboard contract-doc
    docEl.classList.remove('is-docx');
    docEl.classList.add('is-rich-doc');
    docEl.innerHTML = `
      <div class="doc-title">${escapeHtml((currentContractName || '').toUpperCase())}</div>
      <div class="word-doc-body">${currentContractHtml}</div>
    `;
    syncContractViewerModal();

    // Analyze view: invalidate DOCX canvas, keep editable rich view
    const canvas   = document.getElementById('analyze-doc-canvas');
    const rich     = document.getElementById('analyze-doc-rich');
    const editor   = document.getElementById('analyze-doc-editor');
    const modeBadge = document.getElementById('analyze-doc-mode-badge');
    if (canvas)   { canvas._rendered = false; canvas.style.display = 'none'; }
    if (rich)     { rich.style.display = ''; rich.innerHTML = buildEditableRichHtml(); rich._userEdited = false; }
    if (editor)   { editor.style.display = 'none'; editor.value = modified; editor._userEdited = false; }
    if (modeBadge) { modeBadge.textContent = t('view.analyze.editable'); modeBadge.className = 'panel-badge badge-info'; }
  } else {
    // ── Fallback: narrow regex replacements + prepend annotation ──
    const combined = `${suggestion?.title || ''} ${suggestion?.body || ''}`.toLowerCase();
    if (/(gizlilik|confidential)/i.test(combined)) {
      replaceFirstRegexInTextNodes(docEl, /\b2\s*(yıl|years?)\b/i, currentLang === 'tr' ? '5 yıl' : '5 years');
    }
    if (/(ödeme|payment|fee)/i.test(combined)) {
      replaceFirstRegexInTextNodes(docEl, /\[(payment amount not specified|belirtilmemiş)\]/i,
        currentLang === 'tr' ? '[ÖDEME TUTARI EKLENDİ]' : '[PAYMENT AMOUNT ADDED]');
    }
    const note = document.createElement('div');
    note.className = 'applied-note';
    note.innerHTML = `<strong>${escapeHtml(suggestion?.title || t('apply.done'))}</strong><br>${escapeHtml(suggestion?.body || '')}`;
    docEl.prepend(note);
    syncContractViewerModal();
  }
}

function renderAnalysis(filename, analysis, options = {}) {
  const { trackState = true, addToSidebar = true } = options;
  const issueCount  = analysis.issues?.length      || 0;
  const sugCount    = analysis.suggestions?.length  || 0;
  currentContractName = filename;
  updateAnalyzeNavBadge();
  updateSuggestionsNavBadge();

  // Hide upload zone, expand viewer
  const mainArea = document.getElementById('main-area');
  if (mainArea) mainArea.classList.add('has-contract');
  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) uploadZone.style.display = 'none';

  // Reset compare state for new contract
  originalDocHtml = null;
  originalContractText = null;
  compareModeActive = false;
  suggestionsAppliedSet = new Set();
  const analyzeEditorEl = document.getElementById('analyze-doc-editor');
  if (analyzeEditorEl) analyzeEditorEl._userEdited = false;
  const analyzeRichEl = document.getElementById('analyze-doc-rich');
  if (analyzeRichEl) { analyzeRichEl._userEdited = false; }
  const analyzeCanvasEl = document.getElementById('analyze-doc-canvas');
  if (analyzeCanvasEl) { analyzeCanvasEl._rendered = false; }

  // -- Contract section title --
  const titleEl = document.querySelector('[data-i18n="section.contract"]');
  if (titleEl) { titleEl.textContent = formatDynamicContractTitle(filename); }

  // -- Contract document viewer --
  renderContractDocument(filename).then(() => {
    annotateIssuesInDocument(analysis.issues || []);
    syncContractViewerModal();
  });

  // -- Issues badge --
  const issuesBadge = document.querySelector('[data-i18n="panel.risksFound"]');
  if (issuesBadge) { issuesBadge.textContent = formatDynamicRisksFound(issueCount); }

  // -- Issues list --
  const issuesBody = document.getElementById('issues-panel-body');
  if (issuesBody) {
    if (issueCount === 0) {
      issuesBody.innerHTML = `<div class="panel-empty">${t('issues.none')}</div>`;
    } else {
      const tagClass = { Inaccuracy: 'tag-inaccuracy', Missing: 'tag-missing', Contradiction: 'tag-inaccuracy', Risk: 'tag-risk' };
      issuesBody.innerHTML = analysis.issues.map((issue, idx) => `
        <div class="issue-item" onclick="focusIssue(${idx})">
          <span class="issue-severity ${issue.severity === 'high' ? 'sev-high' : issue.severity === 'medium' ? 'sev-med' : 'sev-low'}"></span>
          <div>
            <div class="issue-text">${escapeHtml(issue.text)}</div>
            <div class="issue-loc">${escapeHtml(issue.location || '')}</div>
          </div>
          <span class="issue-tag ${tagClass[issue.tag] || 'tag-risk'}">${escapeHtml(localizeTag(issue.tag || 'Risk'))}</span>
        </div>`).join('');
    }
  }

  // -- Suggestions badge --
  const sugBadge = document.querySelector('[data-i18n="panel.sugCount"]');
  if (sugBadge) { sugBadge.textContent = formatDynamicSuggestionCount(sugCount); }

  // -- Suggestions list --
  const sugBody = document.getElementById('suggestions-panel-body');
  if (sugBody) {
    if (sugCount === 0) {
      sugBody.innerHTML = `<div class="panel-empty">${t('suggestions.none')}</div>`;
    } else {
      sugBody.innerHTML = analysis.suggestions.map((sug, idx) => `
        <div class="suggestion-item">
          <div class="sug-title">
            <span class="sug-icon">→</span>
            <span>${escapeHtml(sug.title)}</span>
            <button class="apply-btn" onclick="applySuggestion(this, ${idx})">${t('apply.btn')}</button>
          </div>
          <div class="sug-body">${escapeHtml(sug.body)}</div>
        </div>`).join('');
    }
  }

  // -- Initial chat message --
  const chatMsg = document.getElementById('initial-ai-msg');
  if (chatMsg && analysis.initialMessage) chatMsg.innerHTML = formatAiMessage(analysis.initialMessage);

  // -- Stats --
  if (trackState) {
    AppState.analyzed++;
    AppState.issuesFound += issueCount;
    AppState.sessionUploads++;
    saveState();
    updateStatCards();
  }

  // -- Sidebar --
  if (addToSidebar) addContractToSidebar(filename, issueCount);

  // Refresh secondary views if they are active
  if (document.getElementById('view-analyze')?.style.display !== 'none') refreshAnalyzeView();
  if (document.getElementById('view-suggestions')?.style.display !== 'none') refreshSuggestionsView();
}

function snapshotCurrentContract(name) {
  return {
    id: `uploaded-${savedContractSeq++}`,
    name,
    text: currentContractText || '',
    html: currentContractHtml || '',
    docxBuffer: currentContractDocxBuffer ? currentContractDocxBuffer.slice(0) : null,
    analysis: JSON.parse(JSON.stringify(currentAnalysis || {})),
  };
}

function restoreSavedContract(contractId) {
  const snap = savedContracts.get(contractId);
  if (!snap) return;
  currentContractText = snap.text || '';
  currentContractHtml = snap.html || '';
  currentContractDocxBuffer = snap.docxBuffer ? snap.docxBuffer.slice(0) : null;
  currentAnalysis = JSON.parse(JSON.stringify(snap.analysis || {}));
  currentContractName = snap.name || '';
  chatHistory = [];

  renderAnalysis(snap.name, currentAnalysis, { trackState: false, addToSidebar: false });
}

function addContractToSidebar(name, issueCount) {
  const list = document.getElementById('contract-list');
  const status = issueCount === 0 ? 'ok' : issueCount <= 3 ? 'warn' : 'risk';
  const now = new Date();
  const today = now.toLocaleDateString(currentLocale(), { month: 'short', day: 'numeric' });
  const div = document.createElement('div');
  const snapshot = snapshotCurrentContract(name);
  savedContracts.set(snapshot.id, snapshot);
  div.className = 'contract-item';
  div.dataset.dynamic = '1';
  div.dataset.issueCount = String(issueCount);
  div.dataset.dateIso = now.toISOString();
  div.dataset.contractId = snapshot.id;
  div.onclick = function () {
    document.querySelectorAll('.contract-item').forEach(c => c.classList.remove('active'));
    this.classList.add('active');
    restoreSavedContract(this.dataset.contractId);
  };
  div.innerHTML = `
    <div class="contract-name">${escapeHtml(name)}</div>
    <div class="contract-meta">
      <span class="status-dot status-${status}"></span>
      <span>${formatDynamicMeta(issueCount, today)}</span>
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

async function applySuggestion(btn, suggestionIndex) {
  if (btn.disabled) return;
  const origText = btn.textContent;
  btn.disabled = true;
  btn.textContent = '⏳';

  const sug = currentAnalysis?.suggestions?.[suggestionIndex];
  if (sug) {
    const docEl = document.getElementById('contract-doc');
    if (docEl && !originalDocHtml) originalDocHtml = docEl.innerHTML;
    if (!originalContractText) originalContractText = currentContractText || '';
    await applyDocumentEdit(sug);
  }

  btn.textContent = t('apply.done');
  btn.classList.add('applied');
  suggestionsAppliedSet.add(suggestionIndex);
  AppState.suggestionsApplied++;
  saveState();
  updateStatCards();
  if (document.getElementById('view-suggestions')?.style.display !== 'none') {
    renderSuggestionsDetailList();
    updateSuggestionsCompare(true);
  }
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

  // Hide upload zone immediately and show viewer area
  const uploadZone = document.getElementById('upload-zone');
  if (uploadZone) uploadZone.style.display = 'none';
  const mainArea = document.getElementById('main-area');
  if (mainArea) mainArea.classList.add('has-contract');

  // Show loading state in viewer and scroll it into view
  const viewerSection = document.querySelector('.contract-viewer');
  if (viewerSection) viewerSection.scrollIntoView({ behavior: 'smooth', block: 'start' });

  const name = file.name.replace(/\.[^.]+$/, "");
  addMessage("user", t('msg.reading').replace('{name}', file.name));
  setLoading(true);

  try {
    const payload = await readContractFileContent(file);
    const text = payload.text;
    if (!text || text.trim().length < 30) throw new Error("empty");

    currentContractText = text;
    currentContractHtml = payload.html || '';
    currentContractDocxBuffer = payload.docxBuffer || null;
    chatHistory = [];

    // Render document immediately — don't wait for AI
    const titleEl = document.querySelector('[data-i18n="section.contract"]');
    if (titleEl) titleEl.textContent = formatDynamicContractTitle(name);
    await renderContractDocument(name);

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

  const views = ['dashboard', 'analyze', 'archive', 'suggestions'];
  views.forEach(v => {
    const panel = document.getElementById(`view-${v}`);
    if (panel) panel.style.display = v === view ? '' : 'none';
  });

  if (view === 'analyze') refreshAnalyzeView();
  if (view === 'archive') refreshArchiveView();
  if (view === 'suggestions') refreshSuggestionsView();
}

// ===========================
//  Archived Contracts
// ===========================

// In-memory archive (not persisted to localStorage — ArrayBuffers not serializable)
let archivedContracts = [];
let activeArchivedIndex = -1;

function archiveCurrentContract() {
  if (!currentContractName) return;
  const entry = {
    id: `arc-${Date.now()}`,
    name: currentContractName,
    text: currentContractText || '',
    html: currentContractHtml || '',
    analysis: currentAnalysis ? JSON.parse(JSON.stringify(currentAnalysis)) : null,
    archivedAt: new Date(),
  };
  archivedContracts.unshift(entry);
  AppState.archived = archivedContracts.length;
  saveState();
  updateStatCards();
  // Give feedback
  const btn = document.getElementById('btn-archive-contract');
  if (btn) {
    const orig = btn.textContent;
    btn.textContent = '✓ ' + t('view.analyze.archived');
    btn.disabled = true;
    setTimeout(() => { btn.textContent = orig; btn.disabled = false; }, 2000);
  }
}

// ===========================
//  Analyze View
// ===========================

function refreshAnalyzeView() {
  const empty = document.getElementById('analyze-empty');
  const content = document.getElementById('analyze-content');
  if (!currentContractName || !currentAnalysis) {
    if (empty) empty.style.display = '';
    if (content) content.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (content) content.style.display = 'flex';

  const subtitle = document.getElementById('analyze-subtitle');
  const issueCount = currentAnalysis.issues?.length || 0;
  if (subtitle) subtitle.textContent = `${currentContractName} • ${formatDynamicRisksFound(issueCount)}`;

  const badge = document.getElementById('analyze-issues-badge');
  if (badge) badge.textContent = formatDynamicRisksFound(issueCount);

  const list = document.getElementById('analyze-issues-list');
  if (list) {
    const tagClass = { Inaccuracy: 'tag-inaccuracy', Missing: 'tag-missing', Contradiction: 'tag-inaccuracy', Risk: 'tag-risk' };
    const sevLabel = { high: t('sev.high'), medium: t('sev.medium'), low: t('sev.low') };
    if (issueCount === 0) {
      list.innerHTML = `<div class="panel-empty">${t('issues.none')}</div>`;
    } else {
      list.innerHTML = currentAnalysis.issues.map((issue, idx) => `
        <div class="issue-detail-card" onclick="focusAnalyzeIssue(${idx})">
          <div class="issue-detail-header">
            <span class="issue-severity ${issue.severity === 'high' ? 'sev-high' : issue.severity === 'medium' ? 'sev-med' : 'sev-low'}"></span>
            <span class="issue-detail-sev-label ${issue.severity === 'high' ? 'sev-label-high' : issue.severity === 'medium' ? 'sev-label-med' : 'sev-label-low'}">${escapeHtml(sevLabel[issue.severity] || issue.severity)}</span>
            <span class="issue-tag ${tagClass[issue.tag] || 'tag-risk'}" style="margin-left:auto">${escapeHtml(localizeTag(issue.tag || 'Risk'))}</span>
          </div>
          <div class="issue-detail-text">${escapeHtml(issue.text)}</div>
          <div class="issue-detail-loc">📍 ${escapeHtml(issue.location || '')}</div>
        </div>`).join('');
    }
  }

  const editor = document.getElementById('analyze-doc-editor');
  const richEditor = document.getElementById('analyze-doc-rich');
  const canvasEl = document.getElementById('analyze-doc-canvas');
  const modeBadge = document.getElementById('analyze-doc-mode-badge');

  const isDocx = !!(currentContractDocxBuffer && window.docx?.renderAsync);
  const isRich = !isDocx && !!(currentContractHtml && String(currentContractHtml).trim());

  // Hide all three, then show the right one
  [editor, richEditor, canvasEl].forEach(el => el && (el.style.display = 'none'));

  if (isDocx) {
    if (canvasEl) {
      canvasEl.style.display = '';
      canvasEl.contentEditable = 'true';
      canvasEl.spellcheck = false;
      if (modeBadge) { modeBadge.textContent = 'Word'; modeBadge.className = 'panel-badge badge-ok'; }
      if (!canvasEl._rendered) {
        canvasEl._rendered = true;
        canvasEl.innerHTML = '<div class="docx-canvas"></div>';
        const canvas = canvasEl.querySelector('.docx-canvas');
        window.docx.renderAsync(currentContractDocxBuffer.slice(0), canvas, null, {
          inWrapper: true,
          breakPages: true,
          className: 'docx',
          ignoreWidth: false,
          ignoreHeight: false,
          useBase64URL: true,
        }).catch(err => {
          console.warn('Analyze docx-preview failed, switching to rich fallback:', err);
          canvasEl._rendered = false;
          canvasEl.style.display = 'none';
          if (richEditor) {
            richEditor.style.display = '';
            richEditor.innerHTML = buildEditableRichHtml();
          }
        });
      }
    }
  } else if (isRich) {
    if (richEditor) {
      richEditor.style.display = '';
      if (!richEditor._userEdited) richEditor.innerHTML = buildEditableRichHtml();
    }
    if (modeBadge) { modeBadge.textContent = t('view.analyze.editable'); modeBadge.className = 'panel-badge badge-info'; }
  } else {
    if (editor) {
      editor.style.display = '';
      if (!editor._userEdited) editor.value = currentContractText || '';
    }
    if (modeBadge) { modeBadge.textContent = t('view.analyze.editable'); modeBadge.className = 'panel-badge badge-info'; }
  }

  updateAnalyzeNavBadge();
}

function downloadEditedContract() {
  const editor    = document.getElementById('analyze-doc-editor');
  const richEditor = document.getElementById('analyze-doc-rich');
  const canvasEl  = document.getElementById('analyze-doc-canvas');

  // Prefer rich HTML source for formatting-preserving DOCX export
  let html = '';
  let text = '';
  if (richEditor && richEditor.style.display !== 'none') {
    html = richEditor.innerHTML || '';
    text = richEditor.innerText || currentContractText || '';
  } else if (canvasEl && canvasEl.style.display !== 'none') {
    // For DOCX canvas: use currentContractHtml if available (the rich mammoth HTML)
    html = currentContractHtml || canvasEl.innerHTML || '';
    text = currentContractText || canvasEl.innerText || '';
  } else {
    text = editor ? editor.value : (currentContractText || '');
    html = currentContractHtml || '';
  }
  const name = (currentContractName || 'contract').replace(/[^a-zA-Z0-9_-]/g, '_') + '_edited';
  downloadAsDocx(text, name, html);
}

// ===========================
//  Archive View
// ===========================

function refreshArchiveView() {
  const empty = document.getElementById('archive-empty');
  const content = document.getElementById('archive-content');
  if (archivedContracts.length === 0) {
    if (empty) empty.style.display = '';
    if (content) content.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (content) content.style.display = '';

  const list = document.getElementById('archive-list');
  if (list) {
    list.innerHTML = archivedContracts.map((entry, idx) => {
      const dateStr = entry.archivedAt.toLocaleString(currentLocale(), { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
      const issueCount = entry.analysis?.issues?.length || 0;
      const status = issueCount === 0 ? 'ok' : issueCount <= 3 ? 'warn' : 'risk';
      return `
        <div class="archive-row ${activeArchivedIndex === idx ? 'active' : ''}" onclick="openArchivedContract(${idx})">
          <span class="status-dot status-${status}" style="flex-shrink:0;margin-top:2px"></span>
          <div class="archive-row-info">
            <div class="archive-row-name">${escapeHtml(entry.name)}</div>
            <div class="archive-row-meta">${escapeHtml(t('view.archive.archivedOn').replace('{date}', dateStr))} · ${issueCount === 0 ? t('meta.cleanDynamic') : t('meta.issuesDynamic').replace('{n}', issueCount).replace('{s}', pluralSuffix(issueCount))}</div>
          </div>
          <button class="btn-sm" onclick="event.stopPropagation(); downloadArchivedContractByIdx(${idx})" style="margin-left:auto;flex-shrink:0" data-i18n="view.archive.download">↓</button>
        </div>`;
    }).join('');
  }
}

function openArchivedContract(idx) {
  const entry = archivedContracts[idx];
  if (!entry) return;
  activeArchivedIndex = idx;
  refreshArchiveView();

  const viewer = document.getElementById('archive-viewer');
  const titleEl = document.getElementById('archive-viewer-title');
  const dateEl = document.getElementById('archive-viewer-date');
  const docEl = document.getElementById('archive-doc');

  if (viewer) viewer.style.display = '';
  if (titleEl) titleEl.textContent = entry.name;
  if (dateEl) dateEl.textContent = entry.archivedAt.toLocaleString(currentLocale(), { month: 'short', day: 'numeric', year: 'numeric', hour: '2-digit', minute: '2-digit' });
  if (docEl) {
    if (entry.html) {
      docEl.innerHTML = `<div class="word-doc-body">${entry.html}</div>`;
    } else {
      docEl.innerHTML = `<pre class="plain-doc-body">${escapeHtml(entry.text)}</pre>`;
    }
  }
  viewer.scrollIntoView({ behavior: 'smooth', block: 'start' });
}

function closeArchiveViewer() {
  activeArchivedIndex = -1;
  const viewer = document.getElementById('archive-viewer');
  if (viewer) viewer.style.display = 'none';
  refreshArchiveView();
}

function downloadArchivedContract() {
  if (activeArchivedIndex >= 0) downloadArchivedContractByIdx(activeArchivedIndex);
}

function downloadArchivedContractByIdx(idx) {
  const entry = archivedContracts[idx];
  if (!entry) return;
  const name = (entry.name || 'contract').replace(/[^a-zA-Z0-9_-]/g, '_') + '_archived';
  downloadAsDocx(entry.text, name);
}

// ===========================
//  Suggestions View
// ===========================

let suggestionsAppliedSet = new Set(); // indexes of applied suggestions in current contract

function refreshSuggestionsView() {
  const empty = document.getElementById('suggestions-empty');
  const content = document.getElementById('suggestions-content');
  if (!currentContractName || !currentAnalysis?.suggestions?.length) {
    if (empty) empty.style.display = '';
    if (content) content.style.display = 'none';
    return;
  }
  if (empty) empty.style.display = 'none';
  if (content) content.style.display = '';

  const subtitle = document.getElementById('suggestions-subtitle');
  const suggestionCount = currentAnalysis?.suggestions?.length || 0;
  if (subtitle) subtitle.textContent = `${currentContractName} • ${formatDynamicSuggestionCount(suggestionCount)}`;

  renderSuggestionsDetailList();
  updateSuggestionsCompare(true);
  updateSuggestionsNavBadge();
}

function renderSuggestionsDetailList() {
  const list = document.getElementById('suggestions-detail-list');
  if (!list || !currentAnalysis?.suggestions) return;
  const sugs = currentAnalysis.suggestions;
  list.innerHTML = sugs.map((sug, idx) => {
    const applied = suggestionsAppliedSet.has(idx);
    return `
      <div class="sug-detail-card ${applied ? 'sug-applied' : ''}" onclick="focusSuggestionInView(${idx})">
        <div class="sug-detail-header">
          <span class="sug-detail-icon">→</span>
          <span class="sug-detail-title">${escapeHtml(sug.title)}</span>
          <button class="apply-btn ${applied ? 'applied' : ''}" ${applied ? 'disabled' : ''} onclick="event.stopPropagation(); applySuggestionFromView(${idx})" style="margin-left:auto">
            ${applied ? t('apply.done') : t('apply.btn')}
          </button>
        </div>
        <div class="sug-detail-body">${escapeHtml(sug.body)}</div>
      </div>`;
  }).join('');
}

async function applySuggestionFromView(idx) {
  if (suggestionsAppliedSet.has(idx)) return;

  const sug = currentAnalysis?.suggestions?.[idx];
  if (!sug) return;

  // Snapshot original BEFORE changes so compare works
  const docEl = document.getElementById('contract-doc');
  if (docEl && !originalDocHtml) originalDocHtml = docEl.innerHTML;
  if (!originalContractText) originalContractText = currentContractText || '';

  // Show loading state on the card's button
  const cards = document.querySelectorAll('#suggestions-detail-list .sug-detail-card');
  const btn = cards[idx]?.querySelector('.apply-btn');
  if (btn) { btn.disabled = true; btn.textContent = '⏳'; }

  suggestionsAppliedSet.add(idx);

  await applyDocumentEdit(sug);

  AppState.suggestionsApplied++;
  saveState();
  updateStatCards();
  renderSuggestionsDetailList();
  updateSuggestionsCompare(true);

  // Also update dashboard panel Apply buttons
  const dashBtn = document.querySelector(`#suggestions-panel-body .suggestion-item:nth-child(${idx + 1}) .apply-btn`);
  if (dashBtn) { dashBtn.textContent = t('apply.done'); dashBtn.disabled = true; dashBtn.classList.add('applied'); }

  // Scroll to compare and flash the change
  const compareEl = document.getElementById('suggestions-compare');
  if (compareEl && compareEl.style.display !== 'none') {
    setTimeout(() => {
      compareEl.scrollIntoView({ behavior: 'smooth', block: 'start' });
      setTimeout(() => {
        const afterPanel = document.getElementById('sug-compare-after');
        if (!afterPanel) return;
        const note = afterPanel.querySelector('.applied-note');
        if (note) {
          note.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
          note.classList.add('flash-highlight');
          setTimeout(() => note.classList.remove('flash-highlight'), 1800);
        }
      }, 400);
    }, 60);
  }
}

async function applyAllSuggestions() {
  const applyAllBtn = document.getElementById('btn-apply-all');
  if (applyAllBtn) { applyAllBtn.disabled = true; applyAllBtn.textContent = '⏳'; }
  const sugs = currentAnalysis?.suggestions || [];
  for (let idx = 0; idx < sugs.length; idx++) {
    if (!suggestionsAppliedSet.has(idx)) await applySuggestionFromView(idx);
  }
  if (applyAllBtn) { applyAllBtn.textContent = '✓ ' + t('apply.done'); }
}

function updateSuggestionsCompare(forceVisible = false) {
  const compareEl  = document.getElementById('suggestions-compare');
  const rightEmpty = document.getElementById('sug-right-empty');
  if (!compareEl) return;

  const before = document.getElementById('sug-compare-before');
  const after = document.getElementById('sug-compare-after');
  const current = document.getElementById('contract-doc');

  if (!forceVisible && (suggestionsAppliedSet.size === 0 || !originalDocHtml)) {
    compareEl.style.display = 'none';
    if (rightEmpty) rightEmpty.style.display = '';
    return;
  }

  compareEl.style.display = '';
  if (rightEmpty) rightEmpty.style.display = 'none';

  if (before) {
    if (originalDocHtml) before.innerHTML = originalDocHtml;
    else if (current) before.innerHTML = current.innerHTML;
  }
  if (after) {
    if (originalContractText && currentContractText && suggestionsAppliedSet.size > 0) {
      after.innerHTML = buildTrackChangesHtml(originalContractText, currentContractText);
    } else if (current) {
      after.innerHTML = current.innerHTML;
    }
  }
}

function downloadSuggestedContract() {
  const text = currentContractText || '';
  const html = currentContractHtml || '';
  const name = (currentContractName || 'contract').replace(/[^a-zA-Z0-9_-]/g, '_') + '_modified';
  downloadAsDocx(text, name, html);
}

// ===========================
//  Download helper — DOCX generation via JSZip
// ===========================

function downloadTextFile(text, filename) {
  // Kept as plain-text fallback
  const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
  triggerBlobDownload(blob, filename);
}

function triggerBlobDownload(blob, filename) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

// ── HTML → DOCX paragraph XML converter ───────────────────────────────────
function htmlToDocxParas(htmlString) {
  const div = document.createElement('div');
  div.innerHTML = String(htmlString || '');
  const paras = [];

  function esc(s) {
    return String(s || '')
      .replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  }

  function inlineRuns(node, opts) {
    opts = opts || {};
    let out = '';
    for (let i = 0; i < node.childNodes.length; i++) {
      const child = node.childNodes[i];
      if (child.nodeType === 3) { // TEXT_NODE
        const txt = child.textContent;
        if (!txt) continue;
        let rPr = '';
        if (opts.bold)      rPr += '<w:b/><w:bCs/>';
        if (opts.italic)    rPr += '<w:i/><w:iCs/>';
        if (opts.underline) rPr += '<w:u w:val="single"/>';
        out += `<w:r>${rPr ? `<w:rPr>${rPr}</w:rPr>` : ''}<w:t xml:space="preserve">${esc(txt)}</w:t></w:r>`;
      } else if (child.nodeType === 1) { // ELEMENT_NODE
        const t = child.tagName.toLowerCase();
        const next = Object.assign({}, opts);
        if (t === 'strong' || t === 'b') next.bold = true;
        if (t === 'em' || t === 'i') next.italic = true;
        if (t === 'u') next.underline = true;
        if (t === 'br') { out += '<w:r><w:br/></w:r>'; continue; }
        out += inlineRuns(child, next);
      }
    }
    return out;
  }

  function processEl(el) {
    if (el.nodeType === 3) { // TEXT_NODE
      const txt = el.textContent.trim();
      if (txt) paras.push(`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr><w:r><w:t xml:space="preserve">${esc(txt)}</w:t></w:r></w:p>`);
      return;
    }
    if (el.nodeType !== 1) return;
    const tag = el.tagName.toLowerCase();

    if (/^h[1-6]$/.test(tag)) {
      const level = parseInt(tag[1], 10);
      const szMap = [36, 32, 28, 26, 24, 22];
      const sz = szMap[level - 1] || 26;
      const runs = inlineRuns(el, { bold: true });
      const styleId = level <= 2 ? 'Heading1' : level <= 4 ? 'Heading2' : 'Heading3';
      paras.push(`<w:p><w:pPr><w:pStyle w:val="${styleId}"/><w:spacing w:before="240" w:after="80"/></w:pPr>${runs}</w:p>`);
    } else if (tag === 'p') {
      const runs = inlineRuns(el);
      paras.push(runs
        ? `<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs}</w:p>`
        : '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>');
    } else if (tag === 'li') {
      const isOl = el.parentElement && el.parentElement.tagName.toLowerCase() === 'ol';
      const runs = inlineRuns(el);
      if (runs) {
        const bullet = isOl ? '' : '<w:r><w:t xml:space="preserve">• </w:t></w:r>';
        paras.push(`<w:p><w:pPr><w:ind w:left="720" w:hanging="360"/><w:spacing w:after="80"/></w:pPr>${bullet}${runs}</w:p>`);
      }
    } else if (tag === 'ul' || tag === 'ol' || tag === 'div' || tag === 'section' || tag === 'article') {
      for (let i = 0; i < el.childNodes.length; i++) processEl(el.childNodes[i]);
    } else if (tag === 'br') {
      paras.push('<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>');
    } else if (tag === 'table') {
      // Flatten table rows as plain paragraphs
      el.querySelectorAll('tr').forEach(tr => {
        const cells = Array.from(tr.querySelectorAll('td, th')).map(td => td.textContent.trim()).filter(Boolean);
        if (cells.length) {
          const line = esc(cells.join('  │  '));
          paras.push(`<w:p><w:pPr><w:spacing w:after="80"/></w:pPr><w:r><w:t xml:space="preserve">${line}</w:t></w:r></w:p>`);
        }
      });
    } else {
      // span, strong, em, etc at block level — wrap as paragraph if has text
      const runs = inlineRuns(el);
      if (runs) paras.push(`<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>${runs}</w:p>`);
      else { for (let i = 0; i < el.childNodes.length; i++) processEl(el.childNodes[i]); }
    }
  }

  for (let i = 0; i < div.childNodes.length; i++) processEl(div.childNodes[i]);
  return paras.join('\n');
}
// ────────────────────────────────────────────────────────────────────────────

async function downloadAsDocx(text, baseName, html) {
  if (typeof JSZip === 'undefined') {
    downloadTextFile(text, baseName + '.txt');
    return;
  }
  const zip = new JSZip();

  zip.file('[Content_Types].xml',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">\n' +
    '  <Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>\n' +
    '  <Default Extension="xml" ContentType="application/xml"/>\n' +
    '  <Override PartName="/word/document.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.document.main+xml"/>\n' +
    '  <Override PartName="/word/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.wordprocessingml.styles+xml"/>\n' +
    '</Types>');

  zip.file('_rels/.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="word/document.xml"/>\n' +
    '</Relationships>');

  zip.file('word/_rels/document.xml.rels',
    '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">\n' +
    '  <Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>\n' +
    '</Relationships>');

  zip.file('word/styles.xml', buildDocxStyles());
  const docXml = (html && html.trim())
    ? buildDocxDocumentFromHtml(html)
    : buildDocxDocument(text);
  zip.file('word/document.xml', docXml);

  const blob = await zip.generateAsync({
    type: 'blob',
    mimeType: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  });
  triggerBlobDownload(blob, baseName + '.docx');
}

function buildDocxDocumentFromHtml(html) {
  const paras = htmlToDocxParas(html);
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
    '<w:body>\n' + paras + '\n' +
    '<w:sectPr>' +
    '<w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/>' +
    '</w:sectPr>\n</w:body>\n</w:document>';
}

function buildDocxDocument(text) {
  const W = 'http://schemas.openxmlformats.org/wordprocessingml/2006/main';
  const paras = String(text || '').split(/\r?\n/).map(line => {
    const s = line.trim();
    if (!s) return '<w:p><w:pPr><w:spacing w:after="0"/></w:pPr></w:p>';
    const esc = s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
    // Heading heuristic: ALL-CAPS line or "1. TITLE" pattern
    const isHeading = (s === s.toUpperCase() && s.length < 120 && /[A-ZÇĞİÖŞÜA-Z]/.test(s)) ||
                      /^\d+\.\s+[A-ZÇĞİÖŞÜA-Z]/.test(s);
    if (isHeading) {
      return '<w:p><w:pPr><w:pStyle w:val="Heading1"/></w:pPr>' +
             `<w:r><w:t xml:space="preserve">${esc}</w:t></w:r></w:p>`;
    }
    return '<w:p><w:pPr><w:spacing w:after="120"/></w:pPr>' +
           `<w:r><w:t xml:space="preserve">${esc}</w:t></w:r></w:p>`;
  }).join('\n');

  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
    '<w:document xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main"' +
    ' xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">\n' +
    '<w:body>\n' + paras + '\n' +
    '<w:sectPr>' +
    '<w:pgSz w:w="12240" w:h="15840"/>' +
    '<w:pgMar w:top="1440" w:right="1440" w:bottom="1440" w:left="1800"/>' +
    '</w:sectPr>\n</w:body>\n</w:document>';
}

function buildDocxStyles() {
  return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>\n' +
  '<w:styles xmlns:w="http://schemas.openxmlformats.org/wordprocessingml/2006/main">\n' +
  '<w:docDefaults><w:rPrDefault><w:rPr>' +
  '<w:rFonts w:ascii="Calibri" w:hAnsi="Calibri" w:cs="Calibri"/>' +
  '<w:sz w:val="22"/><w:szCs w:val="22"/>' +
  '</w:rPr></w:rPrDefault>' +
  '<w:pPrDefault><w:pPr><w:spacing w:after="160" w:line="259" w:lineRule="auto"/></w:pPr></w:pPrDefault>' +
  '</w:docDefaults>\n' +
  '<w:style w:type="paragraph" w:default="1" w:styleId="Normal"><w:name w:val="Normal"/></w:style>\n' +
  '<w:style w:type="paragraph" w:styleId="Heading1">' +
  '<w:name w:val="heading 1"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
  '<w:pPr><w:spacing w:before="280" w:after="80"/></w:pPr>' +
  '<w:rPr><w:b/><w:bCs/><w:sz w:val="36"/><w:szCs w:val="36"/></w:rPr>' +
  '</w:style>\n' +
  '<w:style w:type="paragraph" w:styleId="Heading2">' +
  '<w:name w:val="heading 2"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
  '<w:pPr><w:spacing w:before="240" w:after="80"/></w:pPr>' +
  '<w:rPr><w:b/><w:bCs/><w:sz w:val="30"/><w:szCs w:val="30"/></w:rPr>' +
  '</w:style>\n' +
  '<w:style w:type="paragraph" w:styleId="Heading3">' +
  '<w:name w:val="heading 3"/><w:basedOn w:val="Normal"/><w:next w:val="Normal"/>' +
  '<w:pPr><w:spacing w:before="200" w:after="60"/></w:pPr>' +
  '<w:rPr><w:b/><w:bCs/><w:sz w:val="26"/><w:szCs w:val="26"/></w:rPr>' +
  '</w:style>\n' +
  '</w:styles>';
}

function selectContract(idx, el) {
  document.querySelectorAll(".contract-item").forEach((c) => c.classList.remove("active"));
  el.classList.add("active");
  const c = DEMO_CONTRACTS[idx];

  const demo = getDemoContractPayload(idx);
  currentContractText = demo.text;
  currentContractHtml = '';
  currentContractDocxBuffer = null;
  currentAnalysis = demo.analysis;
  currentContractName = c.name;
  chatHistory = [];
  updateAnalyzeNavBadge();
  updateSuggestionsNavBadge();

  renderAnalysis(c.name, demo.analysis, { trackState: false, addToSidebar: false });

  addMessage("ai", demo.analysis.initialMessage || t('msg.switch.clean').replace('{name}', c.name));
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
    let localizedReply = reply;
    try {
      localizedReply = await translateTextToCurrentLang(reply, true);
      if (currentLang === 'tr' && looksForeignForTurkish(localizedReply)) {
        localizedReply = await translateTextToCurrentLang(localizedReply, true);
      }
    } catch {}
    chatHistory.push({ role: "assistant", content: localizedReply });
    addMessage("ai", localizedReply || t('msg.noResponse'));
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
  const safeText = role === 'ai' ? formatAiMessage(text) : escapeHtml(text).replace(/\n/g, '<br>');
  div.innerHTML = `
    <div class="msg-avatar ${role === "ai" ? "msg-ai" : "msg-user"}">${avatarLabel}</div>
    <div class="msg-text">${safeText}</div>
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
  applyTheme(getInitialTheme(), false);
  // Restore saved model preference
  const savedModel = localStorage.getItem('clauseai-model');
  if (savedModel) {
    OLLAMA_MODEL = savedModel;
    const sel = document.getElementById('model-select');
    if (sel) sel.value = savedModel;
  }
  if (window.matchMedia) {
    const media = window.matchMedia('(prefers-color-scheme: dark)');
    media.addEventListener('change', () => {
      if (currentTheme === 'system') applyTheme('system', false);
    });
  }
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && contractViewerExpanded) closeContractViewerModal();
  });
  setLang('tr');
  updateStatCards();

  // Track manual edits in the analyze editor so we don't overwrite them on re-render
  const analyzeEditor = document.getElementById('analyze-doc-editor');
  if (analyzeEditor) {
    analyzeEditor.addEventListener('input', () => { analyzeEditor._userEdited = true; });
  }

  const richAnalyzeEditor = document.getElementById('analyze-doc-rich');
  if (richAnalyzeEditor) {
    richAnalyzeEditor.addEventListener('input', () => { richAnalyzeEditor._userEdited = true; });
  }

  const analyzeCanvas = document.getElementById('analyze-doc-canvas');
  if (analyzeCanvas) {
    analyzeCanvas.addEventListener('input', () => {
      analyzeCanvas._userEdited = true;
      const canvasText = analyzeCanvas.innerText || analyzeCanvas.textContent || '';
      currentContractText = canvasText;
    });
  }

  updateAnalyzeNavBadge();
  updateSuggestionsNavBadge();

  // ── Suggestions split-pane drag-to-resize ───────────────────────
  (function initSugDivider() {
    const divider  = document.getElementById('sug-divider');
    const leftCol  = document.getElementById('sug-left-col');
    const container = document.getElementById('suggestions-content');
    if (!divider || !leftCol || !container) return;

    const MIN_PX = 200;
    const MAX_FRAC = 0.80;
    let dragging = false;
    let startX = 0;
    let startW = 0;

    divider.addEventListener('mousedown', (e) => {
      dragging = true;
      startX = e.clientX;
      startW = leftCol.getBoundingClientRect().width;
      divider.classList.add('dragging');
      document.body.style.cursor = 'col-resize';
      document.body.style.userSelect = 'none';
      e.preventDefault();
    });

    document.addEventListener('mousemove', (e) => {
      if (!dragging) return;
      const dx = e.clientX - startX;
      const containerW = container.getBoundingClientRect().width;
      const newW = Math.min(Math.max(startW + dx, MIN_PX), containerW * MAX_FRAC);
      leftCol.style.flex = `0 0 ${newW}px`;
      leftCol.style.width = `${newW}px`;
    });

    document.addEventListener('mouseup', () => {
      if (!dragging) return;
      dragging = false;
      divider.classList.remove('dragging');
      document.body.style.cursor = '';
      document.body.style.userSelect = '';
    });

    // Touch support
    divider.addEventListener('touchstart', (e) => {
      dragging = true;
      startX = e.touches[0].clientX;
      startW = leftCol.getBoundingClientRect().width;
      divider.classList.add('dragging');
      e.preventDefault();
    }, { passive: false });

    document.addEventListener('touchmove', (e) => {
      if (!dragging) return;
      const dx = e.touches[0].clientX - startX;
      const containerW = container.getBoundingClientRect().width;
      const newW = Math.min(Math.max(startW + dx, MIN_PX), containerW * MAX_FRAC);
      leftCol.style.flex = `0 0 ${newW}px`;
      leftCol.style.width = `${newW}px`;
    }, { passive: false });

    document.addEventListener('touchend', () => {
      dragging = false;
      divider.classList.remove('dragging');
    });
  })();
});
