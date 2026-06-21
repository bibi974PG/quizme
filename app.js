import {
  initFirebase,
  isOnlineDb,
  saveQuizRemote,
  loadQuizRemote,
  saveScoreRemote,
  loadScoresRemote,
  loadAppContent,
  loadCommunityQuestions,
  submitCommunityQuestion,
  loadCreatorQuizzes,
  signInWithGoogle,
  getCurrentUser,
  computeQuizStats,
} from "./firebase-db.js";
import { GAMER_QUIZZES as FALLBACK_GAMER_QUIZZES } from "./content-data.js";

(function () {
  "use strict";

  let DEFAULT_COUNT = 8;
  let THEMES = [];
  let QUESTION_BANK = {};
  let QUIZ_TEMPLATES = [];
  let GAMER_QUIZZES = [];
  let selectedGamerId = null;
  let COMMUNITY_BY_THEME = {};

  let currentQuiz = null;
  let playQuizSource = null;
  let playState = { index: 0, answers: [], playerName: "", locked: false, timerId: null, timeLeft: 0 };
  let quizSetup = { count: 8, themes: [], blank: false, timer: false };
  let editingQuizId = null;
  let lastReviewData = null;

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  const DEFAULT_TEMPLATES = [
    { id: "couple", icon: "💕", label: "Quiz couple", desc: "Amour & souvenirs", themes: ["amour", "souvenirs"], count: 10 },
    { id: "bff", icon: "💛", label: "Quiz BFF", desc: "Amitié & fun", themes: ["amitie", "fun"], count: 10 },
    { id: "famille", icon: "👨‍👩‍👧", label: "Quiz famille", desc: "Famille & traditions", themes: ["famille", "souvenirs"], count: 8 },
    { id: "foodie", icon: "🍕", label: "Quiz food", desc: "Plats & goûts", themes: ["food", "gouts"], count: 8 },
  ];

  function showScreen(name) {
    $$(".screen").forEach((el) => el.classList.remove("screen--active"));
    const screen = document.querySelector(`[data-screen="${name}"]`);
    if (screen) screen.classList.add("screen--active");
    const navBtn = $("#btnNavNewQuiz");
    if (navBtn) navBtn.hidden = name === "home";
    clearQuestionTimer();
  }

  function clearQuestionTimer() {
    if (playState.timerId) {
      clearInterval(playState.timerId);
      playState.timerId = null;
    }
  }

  function normalizeText(str) {
    return String(str || "")
      .trim()
      .toLowerCase()
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "");
  }

  function isAnswerCorrect(q, answer) {
    if (q.type === "text") {
      const expected = q.correctText || q.options?.[q.correct] || "";
      return normalizeText(answer?.text ?? answer) === normalizeText(expected);
    }
    return answer === q.correct;
  }

  function getCorrectLabel(q) {
    if (q.type === "text") return q.correctText || q.options?.[q.correct] || "—";
    return q.options?.[q.correct] ?? "—";
  }

  function openSetup(blank, template) {
    editingQuizId = null;
    quizSetup = {
      count: template?.count || DEFAULT_COUNT,
      themes: template ? [...template.themes] : blank ? [] : ["gouts", "amitie", "fun"],
      blank: !!blank,
      timer: false,
    };
    if ($("#setupTimer")) $("#setupTimer").checked = false;
    renderThemeGrid();
    renderCountPicker();
    updateSetupView();
    $("#setupError").hidden = true;
    showScreen("setup");
  }

  function applyTemplate(template) {
    openSetup(false, template);
  }

  function renderTemplateRow() {
    const row = $("#templateRow");
    if (!row) return;
    const list = QUIZ_TEMPLATES.length ? QUIZ_TEMPLATES : DEFAULT_TEMPLATES;
    row.innerHTML = list
      .map(
        (t) => `
      <button type="button" class="template-card" data-template="${t.id}">
        <span class="template-card__icon">${t.icon || "📋"}</span>
        <strong>${escapeHtml(t.label)}</strong>
        <span>${escapeHtml(t.desc || "")}</span>
      </button>`
      )
      .join("");
    row.querySelectorAll(".template-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        const tpl = list.find((x) => x.id === btn.dataset.template);
        if (tpl) applyTemplate(tpl);
      });
    });
  }

  function renderGamerGrid() {
    const grid = $("#gamerGrid");
    if (!grid) return;
    grid.innerHTML = GAMER_QUIZZES.map(
      (g) => `
      <button type="button" class="gamer-card" data-gamer="${g.id}">
        <span class="gamer-card__icon">${g.icon || "🎮"}</span>
        <div class="gamer-card__text">
          <strong>${escapeHtml(g.label)}</strong>
          <span>${escapeHtml(g.tag || "4 niveaux")}</span>
        </div>
        <span class="gamer-card__play">Choisir →</span>
      </button>`
    ).join("");
    grid.querySelectorAll(".gamer-card").forEach((btn) => {
      btn.addEventListener("click", () => openGamerLevelPicker(btn.dataset.gamer));
    });
  }

  const GAMER_LEVEL_LABELS = {
    easy: "Facile",
    hard: "Difficile",
    expert: "Expert",
    wat: "WAT",
  };

  const GAMER_LEVEL_COUNTS = {
    easy: 10,
    hard: 10,
    expert: 10,
    wat: 20,
  };

  function openGamerLevelPicker(id) {
    const meta = GAMER_QUIZZES.find((x) => x.id === id);
    if (!meta) return;
    selectedGamerId = id;
    if ($("#gamerLevelTitle")) $("#gamerLevelTitle").textContent = meta.label;
    if ($("#gamerLevelIcon")) $("#gamerLevelIcon").textContent = meta.icon || "🎮";
    showScreen("gamer-level");
  }

  function startGamerQuiz(id, level) {
    const meta = GAMER_QUIZZES.find((x) => x.id === id);
    if (!meta) return;
    const pack = meta.levels?.[level];
    if (!pack?.questions?.length) {
      alert("Quiz indisponible pour ce niveau.");
      return;
    }
    const levelLabel = GAMER_LEVEL_LABELS[level] || level;
    const qCount = pack.questions.length;
    const quiz = {
      creator: `${meta.label} · ${levelLabel}`,
      intro: pack.intro || `${qCount} questions ${levelLabel} sur ${meta.label}.`,
      questions: pack.questions.map((q) =>
        shuffleQuestionOptions({
          text: q.text,
          type: "choice",
          options: [...q.options],
          correct: q.correct ?? 0,
        })
      ),
      timer: false,
      isGamer: true,
      gamerLevel: level,
      _id: `gamer_${meta.id}_${level}`,
    };
    quiz._encoded = encodeQuiz(quiz);
    startPlay(quiz);
  }

  function openGamerHub() {
    renderGamerGrid();
    showScreen("gamer");
  }

  function updateSetupView() {
    const themesBlock = $("#setupThemesBlock");
    const title = $("#setupTitle");
    const desc = $("#setupDesc");
    if (quizSetup.blank) {
      themesBlock.hidden = true;
      title.textContent = "Quiz vierge";
      desc.textContent = "Choisis le nombre de questions vides à remplir toi-même.";
    } else {
      themesBlock.hidden = false;
      title.textContent = "Configure ton quiz";
      desc.textContent = "Choisis combien de questions et sur quels sujets.";
    }
  }

  function updateCreateView() {
    const templatesBar = $("#templatesBar");
    const blankHint = $("#blankHint");
    if (quizSetup.blank) {
      templatesBar.hidden = true;
      blankHint.hidden = false;
    } else {
      templatesBar.hidden = false;
      blankHint.hidden = true;
    }
  }

  function startNewQuiz() {
    currentQuiz = null;
    playQuizSource = null;
    editingQuizId = null;
    playState = { index: 0, answers: [], playerName: "", locked: false, timerId: null, timeLeft: 0 };
    if (window.location.search) {
      window.location.href = baseUrl();
      return;
    }
    showScreen("home");
  }

  function blankQuestions(count) {
    return Array.from({ length: count }, () => ({
      text: "",
      type: "choice",
      options: ["", "", "", ""],
      correct: 0,
      correctText: "",
    }));
  }

  function themeLabel(id) {
    const t = THEMES.find((x) => x.id === id);
    return t ? `${t.icon} ${t.label}` : id;
  }

  function shuffle(arr) {
    const a = [...arr];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  /** Mélange les réponses — la bonne réponse change de position à chaque partie. */
  function shuffleQuestionOptions(question) {
    if (question.type === "text" || !question.options?.length) return { ...question };
    const correctIdx = question.correct ?? 0;
    const pairs = question.options.map((opt, i) => ({ opt, isCorrect: i === correctIdx }));
    const shuffled = shuffle(pairs);
    return {
      ...question,
      options: shuffled.map((p) => p.opt),
      correct: Math.max(0, shuffled.findIndex((p) => p.isCorrect)),
    };
  }

  function cloneQuiz(quiz) {
    return JSON.parse(JSON.stringify(quiz));
  }

  function prepareQuizForPlay(quiz) {
    const base = cloneQuiz(quiz);
    return {
      ...base,
      questions: base.questions.map((q) => shuffleQuestionOptions(q)),
    };
  }

  function pickQuestions(count, themeIds) {
    const pool = [];
    themeIds.forEach((id) => {
      (QUESTION_BANK[id] || []).forEach((q) => pool.push({ ...q, theme: id, type: q.type || "choice" }));
      (COMMUNITY_BY_THEME[id] || []).forEach((q) => pool.push({ ...q, theme: id, type: q.type || "choice" }));
    });
    if (pool.length === 0) return [];
    const shuffled = shuffle(pool);
    const picked = [];
    const usedTexts = new Set();
    for (const q of shuffled) {
      if (picked.length >= count) break;
      if (!usedTexts.has(q.text)) {
        usedTexts.add(q.text);
        picked.push({ ...q, correct: q.correct ?? 0 });
      }
    }
    while (picked.length < count && shuffled.length) {
      const q = shuffled[picked.length % shuffled.length];
      picked.push({ ...q, theme: q.theme, correct: q.correct ?? 0 });
    }
    return picked.slice(0, count);
  }

  function renderThemeGrid() {
    const grid = $("#themeGrid");
    grid.innerHTML = THEMES.map((t) => {
      const active = quizSetup.themes.includes(t.id) ? " theme-chip--active" : "";
      return `
        <button type="button" class="theme-chip${active}" data-theme="${t.id}">
          <span class="theme-chip__icon">${t.icon}</span>
          <span class="theme-chip__text">
            <strong>${t.label}</strong>
            <span>${t.desc}</span>
          </span>
        </button>`;
    }).join("");
    grid.querySelectorAll(".theme-chip").forEach((btn) => {
      btn.addEventListener("click", () => {
        const id = btn.dataset.theme;
        if (quizSetup.themes.includes(id)) {
          quizSetup.themes = quizSetup.themes.filter((x) => x !== id);
          btn.classList.remove("theme-chip--active");
        } else {
          quizSetup.themes.push(id);
          btn.classList.add("theme-chip--active");
        }
      });
    });
  }

  function renderCountPicker() {
    $$(".count-btn").forEach((btn) => {
      btn.classList.toggle("count-btn--active", parseInt(btn.dataset.count, 10) === quizSetup.count);
    });
  }

  function updateSetupSummary() {
    const summary = $("#setupSummary");
    if (quizSetup.blank) {
      summary.innerHTML = `
        <span class="setup-tag">${quizSetup.count} questions</span>
        <span class="setup-tag setup-tag--blank">📝 Quiz vierge</span>
        ${quizSetup.timer ? '<span class="setup-tag">⏱ Chrono</span>' : ""}`;
      $("#createSubtitle").textContent = `${quizSetup.count} questions vides — à remplir par toi.`;
      return;
    }
    const themeTags = quizSetup.themes.map((id) => `<span class="setup-tag">${themeLabel(id)}</span>`).join("");
    summary.innerHTML = `
      <span class="setup-tag">${quizSetup.count} questions</span>
      ${themeTags}
      ${quizSetup.timer ? '<span class="setup-tag">⏱ Chrono</span>' : ""}`;
    $("#createSubtitle").textContent = `${quizSetup.count} questions sur toi — tes amis devront deviner.`;
  }

  function encodeQuiz(quiz) {
    const json = JSON.stringify(quiz);
    return btoa(unescape(encodeURIComponent(json)))
      .replace(/\+/g, "-")
      .replace(/\//g, "_")
      .replace(/=+$/, "");
  }

  function decodeQuiz(encoded) {
    try {
      let b64 = encoded.replace(/-/g, "+").replace(/_/g, "/");
      while (b64.length % 4) b64 += "=";
      const json = decodeURIComponent(escape(atob(b64)));
      const quiz = JSON.parse(json);
      if (!quiz.creator || !Array.isArray(quiz.questions) || quiz.questions.length === 0) return null;
      quiz.questions = quiz.questions.map((q) => ({
        ...q,
        type: q.type || "choice",
        correct: q.correct ?? 0,
        options: q.options || ["", "", "", ""],
        correctText: q.correctText || "",
      }));
      return quiz;
    } catch {
      return null;
    }
  }

  function quizId(quiz) {
    return encodeQuiz({ c: quiz.creator, q: quiz.questions.map((q) => q.text) }).slice(0, 12);
  }

  function baseUrl() {
    return window.location.href.split("?")[0].split("#")[0];
  }

  function playUrl(encoded) {
    return `${baseUrl()}?q=${encoded}`;
  }

  function manageUrl(id) {
    return `${baseUrl()}?manage=${id}`;
  }

  function saveQuizLocally(id, quiz) {
    try { localStorage.setItem(`quizmoi_quiz_${id}`, JSON.stringify(quiz)); } catch (_) {}
  }

  function loadQuizLocally(id) {
    try {
      const raw = localStorage.getItem(`quizmoi_quiz_${id}`);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function saveScoreLocally(id, entry) {
    try {
      const key = `quizmoi_scores_${id}`;
      const list = JSON.parse(localStorage.getItem(key) || "[]");
      list.push(entry);
      list.sort((a, b) => b.score - a.score || a.date - b.date);
      localStorage.setItem(key, JSON.stringify(list));
    } catch (_) {}
  }

  function loadScoresLocally(id) {
    try {
      return JSON.parse(localStorage.getItem(`quizmoi_scores_${id}`) || "[]");
    } catch {
      return [];
    }
  }

  async function saveScore(id, entry) {
    saveScoreLocally(id, entry);
    if (isOnlineDb()) {
      try { await saveScoreRemote(id, entry); } catch (_) {}
    }
  }

  async function loadScores(id) {
    if (isOnlineDb()) {
      try {
        const remote = await loadScoresRemote(id);
        if (remote) return remote;
      } catch (_) {}
    }
    return loadScoresLocally(id);
  }

  function getTier(score, total, creator, isGamer, gamerLevel) {
    const pct = total ? score / total : 0;
    if (isGamer) {
      if (gamerLevel === "wat" || creator.includes("WAT")) {
        if (score === total) return { title: "??? IMPOSSIBLE ???", msg: "T'es un alien. C'est illégal.", badge: "💀" };
        if (pct >= 0.5) return { title: "Survivant WAT", msg: "Peu de gens arrivent là.", badge: "🧠" };
        return { title: "Victime du WAT", msg: "Même Google a abandonné.", badge: "☠️" };
      }
      if (score === total) return { title: "Pro gamer", msg: `Expert ${creator} — GG EZ !`, badge: "🏆" };
      if (pct >= 0.75) return { title: "Hardcore", msg: "Tu grind clairement ce jeu.", badge: "🔥" };
      if (pct >= 0.5) return { title: "Casual+", msg: "Pas mal, mais t'es pas meta.", badge: "🎮" };
      if (pct >= 0.25) return { title: "Noob friendly", msg: "Retourne faire le tuto.", badge: "🐣" };
      return { title: "AFK", msg: "T'étais où pendant le chargement ?", badge: "💤" };
    }
    if (score === total) return { title: "Légende absolue", msg: `Score parfait. ${creator} devrait t'adopter.`, badge: "👑" };
    if (pct >= 0.75) return { title: "Âme sœur", msg: `Tu connais ${creator} mieux que ${creator} ne se connaît !`, badge: "💫" };
    if (pct >= 0.5) return { title: "Bon ami", msg: "Pas mal ! Tu fais partie du cercle proche.", badge: "🤝" };
    if (pct >= 0.25) return { title: "Connaissance de surface", msg: `Tu as croisé ${creator} deux fois dans un couloir.`, badge: "👀" };
    return { title: "Stranger danger", msg: "On se présente ? Tu connais à peine le prénom…", badge: "🚨" };
  }

  function renderQuestionEditor(templates) {
    const container = $("#questionsEditor");
    container.innerHTML = "";
    let questions = templates;
    if (!questions) {
      questions = quizSetup.blank
        ? blankQuestions(quizSetup.count)
        : pickQuestions(quizSetup.count, quizSetup.themes);
    }

    questions.forEach((tpl, i) => {
      const type = tpl.type || "choice";
      const block = document.createElement("div");
      block.className = "q-block";
      block.dataset.index = i;
      block.dataset.type = type;
      if (tpl.theme) block.dataset.theme = tpl.theme;
      const themeBadge = tpl.theme ? `<span class="q-block__theme">${themeLabel(tpl.theme)}</span>` : "";
      const choiceHtml =
        type === "text"
          ? `<div class="q-text-answer">
              <label>Bonne réponse (texte libre)</label>
              <input type="text" class="input q-correct-text" placeholder="Ex : 12 mars 1998" value="${escapeAttr(tpl.correctText || tpl.options?.[tpl.correct] || "")}" maxlength="80" />
            </div>`
          : `<div class="q-options">
              ${(tpl.options || ["", "", "", ""])
                .map(
                  (opt, j) => `
                <div class="q-option">
                  <input type="radio" name="correct-${i}" value="${j}" ${j === (tpl.correct ?? 0) ? "checked" : ""} title="Bonne réponse" />
                  <input type="text" class="q-opt-text" placeholder="Réponse ${j + 1}" value="${escapeAttr(opt)}" maxlength="60" />
                </div>`
                )
                .join("")}
            </div>`;

      block.innerHTML = `
        <div class="q-block__head">
          <span class="q-block__num">${i + 1}</span>
          <label>Question ${i + 1}</label>
          ${themeBadge}
          <div class="q-type-toggle">
            <button type="button" class="btn btn--chip q-type-btn${type === "choice" ? " q-type-btn--active" : ""}" data-type="choice">Choix</button>
            <button type="button" class="btn btn--chip q-type-btn${type === "text" ? " q-type-btn--active" : ""}" data-type="text">Texte libre</button>
          </div>
        </div>
        <input type="text" class="input q-text" placeholder="Ta question…" value="${escapeAttr(tpl.text)}" maxlength="120" />
        <div class="q-body">${choiceHtml}</div>
        <label class="community-check"><input type="checkbox" class="q-community" /> Proposer à la banque communautaire</label>
      `;
      container.appendChild(block);

      block.querySelectorAll(".q-type-btn").forEach((btn) => {
        btn.addEventListener("click", () => {
          const newType = btn.dataset.type;
          const text = block.querySelector(".q-text").value;
          const rebuilt = {
            text,
            theme: tpl.theme,
            type: newType,
            options: newType === "choice" ? ["", "", "", ""] : [],
            correct: 0,
            correctText: "",
          };
          const all = readEditorQuestionsFromDom();
          all[i] = rebuilt;
          renderQuestionEditor(all);
        });
      });
    });
  }

  function readEditorQuestionsFromDom() {
    return [...$$(".q-block")].map((block) => {
      const type = block.dataset.type || "choice";
      const text = block.querySelector(".q-text").value.trim();
      if (type === "text") {
        const correctText = block.querySelector(".q-correct-text")?.value.trim() || "";
        return { text, type, options: [], correct: 0, correctText, theme: block.dataset.theme || undefined };
      }
      const options = [...block.querySelectorAll(".q-opt-text")].map((inp) => inp.value.trim());
      const correctRadio = block.querySelector('input[type="radio"]:checked');
      const correct = correctRadio ? parseInt(correctRadio.value, 10) : 0;
      return { text, type: "choice", options, correct, theme: block.dataset.theme };
    });
  }

  function escapeAttr(str) {
    return String(str)
      .replace(/&/g, "&amp;")
      .replace(/"/g, "&quot;")
      .replace(/</g, "&lt;");
  }

  function readEditorQuiz() {
    const creator = $("#creatorName").value.trim();
    const intro = $("#creatorIntro")?.value.trim() || "";
    const avatar = $("#creatorAvatar")?.value.trim() || "";
    const questions = readEditorQuestionsFromDom();
    return {
      creator,
      intro,
      avatar,
      timer: quizSetup.timer,
      timerSec: 15,
      questions,
      themes: [...quizSetup.themes],
      count: questions.length,
      createdAt: Date.now(),
    };
  }

  function validateQuiz(quiz) {
    if (!quiz.creator) return "Entre ton prénom.";
    if (quiz.creator.length < 2) return "Prénom trop court.";
    if (quiz.questions.length < 3) return "Il faut au moins 3 questions.";
    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      if (!q.text) return `Question ${i + 1} : texte manquant.`;
      if (q.type === "text") {
        if (!q.correctText) return `Question ${i + 1} : bonne réponse manquante.`;
        continue;
      }
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j]) return `Question ${i + 1} : réponse ${j + 1} manquante.`;
      }
      const unique = new Set(q.options.map((o) => o.toLowerCase()));
      if (unique.size < q.options.length) return `Question ${i + 1} : deux réponses identiques.`;
    }
    return null;
  }

  async function submitCommunityFromEditor(quiz) {
    if (!isOnlineDb()) return;
    const blocks = $$(".q-block");
    for (let i = 0; i < blocks.length; i++) {
      const cb = blocks[i].querySelector(".q-community");
      if (!cb?.checked) continue;
      const q = quiz.questions[i];
      try {
        await submitCommunityQuestion({
          theme: q.theme || quiz.themes[0] || "fun",
          text: q.text,
          options: q.options,
          correct: q.correct,
          type: q.type,
          correctText: q.correctText,
          author: quiz.creator,
        });
      } catch (_) {}
    }
  }

  function applyTemplates() {
    if (quizSetup.blank) return;
    renderQuestionEditor();
  }

  function continueFromSetup() {
    const errEl = $("#setupError");
    errEl.hidden = true;
    quizSetup.timer = $("#setupTimer")?.checked || false;
    if (!quizSetup.blank && quizSetup.themes.length === 0) {
      errEl.textContent = "Choisis au moins un thème.";
      errEl.hidden = false;
      return;
    }
    updateSetupSummary();
    updateCreateView();
    if (!editingQuizId) {
      renderQuestionEditor();
      $("#creatorName").value = "";
      if ($("#creatorIntro")) $("#creatorIntro").value = "";
      if ($("#creatorAvatar")) $("#creatorAvatar").value = "";
    }
    $("#createError").hidden = true;
    showScreen("create");
  }

  async function publishQuiz() {
    const errEl = $("#createError");
    errEl.hidden = true;
    const quiz = readEditorQuiz();
    const error = validateQuiz(quiz);
    if (error) {
      errEl.textContent = error;
      errEl.hidden = false;
      return;
    }
    await submitCommunityFromEditor(quiz);
    const encoded = encodeQuiz(quiz);
    const id = editingQuizId || quizId(quiz);
    saveQuizLocally(id, quiz);
    if (isOnlineDb()) {
      try { await saveQuizRemote(id, quiz, encoded); } catch (_) {}
    }
    currentQuiz = quiz;
    currentQuiz._encoded = encoded;
    currentQuiz._id = id;
    $("#shareLink").value = playUrl(encoded);
    $("#manageLink").value = manageUrl(id);
    showScreen("share");
  }

  function openEditQuiz(quiz, id) {
    editingQuizId = id;
    quizSetup = {
      count: quiz.questions.length,
      themes: quiz.themes || [],
      blank: false,
      timer: !!quiz.timer,
    };
    if ($("#setupTimer")) $("#setupTimer").checked = !!quiz.timer;
    updateSetupSummary();
    updateCreateView();
    $("#creatorName").value = quiz.creator || "";
    if ($("#creatorIntro")) $("#creatorIntro").value = quiz.intro || "";
    if ($("#creatorAvatar")) $("#creatorAvatar").value = quiz.avatar || "";
    renderQuestionEditor(quiz.questions);
    showScreen("create");
  }

  async function copyText(text, toastEl) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const ta = document.createElement("textarea");
      ta.value = text;
      document.body.appendChild(ta);
      ta.select();
      document.execCommand("copy");
      document.body.removeChild(ta);
    }
    if (toastEl) {
      toastEl.hidden = false;
      setTimeout(() => { toastEl.hidden = true; }, 2000);
    }
  }

  function shareLinkText() {
    return `Fais mon quiz « Es-tu vraiment mon ami ? » 👀\n${$("#shareLink").value}`;
  }

  function startPlay(quiz) {
    playQuizSource = cloneQuiz(quiz);
    currentQuiz = playQuizSource;
    playState = { index: 0, answers: [], playerName: "", locked: false, timerId: null, timeLeft: 0 };
    const total = playQuizSource.questions.length;
    $("#playCreatorLabel").textContent = `Quiz de ${playQuizSource.creator}`;
    $("#playCreatorLabelQ").textContent = `Quiz de ${playQuizSource.creator}`;
    $("#introCreatorName").textContent = playQuizSource.creator;
    $("#introQuestionCount").textContent = total;
    $("#playerName").value = "";

    const avatarWrap = $("#playAvatarWrap");
    const avatarImg = $("#playAvatar");
    if (playQuizSource.avatar && avatarWrap && avatarImg) {
      avatarImg.src = playQuizSource.avatar;
      avatarImg.alt = playQuizSource.creator;
      avatarWrap.hidden = false;
    } else if (avatarWrap) avatarWrap.hidden = true;

    const introEl = $("#playIntroMsg");
    if (introEl) {
      if (playQuizSource.intro) {
        introEl.textContent = playQuizSource.intro;
        introEl.hidden = false;
      } else introEl.hidden = true;
    }

    const timerNote = $("#playTimerNote");
    if (timerNote) timerNote.hidden = !playQuizSource.timer;

    showScreen("play-intro");
  }

  function updateProgress(current, total) {
    const pct = total ? (current / total) * 100 : 0;
    $("#progressFill").style.width = `${pct}%`;
    $("#playStep").textContent = `${current} / ${total}`;
    $("#questionBadge").textContent = `Question ${current}`;
  }

  function beginQuestions() {
    const name = $("#playerName").value.trim();
    if (name.length < 2) {
      $("#playerName").focus();
      return;
    }
    playState.playerName = name;
    playState.index = 0;
    playState.answers = [];
    playState.locked = false;
    const source = playQuizSource || currentQuiz;
    if (!source?.questions?.length) return;
    currentQuiz = prepareQuizForPlay(source);
    showQuestionPage();
  }

  function hideFeedback() {
    $("#answerFeedback").hidden = true;
    $("#feedbackCorrect").hidden = true;
    $("#feedbackBox").className = "answer-feedback__box";
  }

  function startQuestionTimer() {
    clearQuestionTimer();
    if (!currentQuiz.timer) return;
    const sec = currentQuiz.timerSec || 15;
    playState.timeLeft = sec;
    const bar = $("#timerBar");
    const fill = $("#timerFill");
    const label = $("#timerLabel");
    if (bar) bar.hidden = false;
    if (label) { label.hidden = false; label.textContent = `${sec} s`; }
    const tick = () => {
      playState.timeLeft -= 1;
      const pct = (playState.timeLeft / sec) * 100;
      if (fill) fill.style.width = `${Math.max(0, pct)}%`;
      if (label) label.textContent = `${Math.max(0, playState.timeLeft)} s`;
      if (playState.timeLeft <= 0) {
        clearQuestionTimer();
        if (!playState.locked) handleTimedOut();
      }
    };
    if (fill) fill.style.width = "100%";
    playState.timerId = setInterval(tick, 1000);
  }

  function handleTimedOut() {
    const q = currentQuiz.questions[playState.index];
    if (q.type === "text") {
      registerTextAnswer("");
    } else {
      registerChoiceAnswer(-1);
    }
  }

  function showQuestionPage() {
    const q = currentQuiz.questions[playState.index];
    if (!q) {
      finishQuiz();
      return;
    }
    playState.locked = false;
    hideFeedback();
    const num = playState.index + 1;
    const total = currentQuiz.questions.length;
    updateProgress(num, total);
    $("#questionText").textContent = q.text;

    const list = $("#optionsList");
    const textBox = $("#textAnswerBox");
    const isText = q.type === "text";

    if (isText) {
      list.innerHTML = "";
      list.hidden = true;
      textBox.hidden = false;
      const inp = $("#textAnswerInput");
      inp.value = "";
      inp.disabled = false;
    } else {
      list.hidden = false;
      textBox.hidden = true;
      list.innerHTML = "";
      q.options.forEach((opt, i) => {
        const li = document.createElement("li");
        const btn = document.createElement("button");
        btn.type = "button";
        btn.className = "option-btn";
        btn.textContent = opt;
        btn.dataset.index = i;
        btn.addEventListener("click", () => registerChoiceAnswer(i));
        li.appendChild(btn);
        list.appendChild(li);
      });
    }

    const page = $("#questionPage");
    page.classList.remove("q-page--out");
    void page.offsetWidth;
    page.style.animation = "none";
    void page.offsetWidth;
    page.style.animation = "";
    showScreen("play-question");
    startQuestionTimer();
  }

  function showAnswerFeedback(isCorrect, q, choice) {
    playState.locked = true;
    clearQuestionTimer();
    const buttons = $$("#optionsList .option-btn");
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      btn.classList.add("option-btn--disabled");
      if (q.type !== "text" && i === q.correct) btn.classList.add("option-btn--correct");
      else if (i === choice && !isCorrect) btn.classList.add("option-btn--wrong");
    });

    const feedbackBox = $("#feedbackBox");
    const feedbackTitle = $("#feedbackTitle");
    const feedbackCorrect = $("#feedbackCorrect");
    if (isCorrect) {
      feedbackBox.className = "answer-feedback__box answer-feedback__box--ok";
      feedbackTitle.textContent = "✓ Bonne réponse !";
      feedbackCorrect.hidden = true;
    } else {
      feedbackBox.className = "answer-feedback__box answer-feedback__box--ko";
      feedbackTitle.textContent = choice === -1 ? "⏱ Temps écoulé" : "✗ Mauvaise réponse";
      feedbackCorrect.textContent = `La bonne réponse : ${getCorrectLabel(q)}`;
      feedbackCorrect.hidden = false;
    }
    const isLast = playState.index + 1 >= currentQuiz.questions.length;
    $("#btnContinue").textContent = isLast ? "Voir mon résultat →" : `Question ${playState.index + 2} →`;
    $("#answerFeedback").hidden = false;
  }

  function registerChoiceAnswer(choice) {
    if (playState.locked) return;
    const q = currentQuiz.questions[playState.index];
    const isCorrect = choice === q.correct;
    playState.answers.push(choice);
    showAnswerFeedback(isCorrect, q, choice);
  }

  function registerTextAnswer(text) {
    if (playState.locked) return;
    const q = currentQuiz.questions[playState.index];
    const answer = { text: text.trim() };
    const isCorrect = isAnswerCorrect(q, answer);
    playState.answers.push(answer);
    const inp = $("#textAnswerInput");
    if (inp) inp.disabled = true;
    showAnswerFeedback(isCorrect, q, null);
  }

  function continueToNext() {
    const page = $("#questionPage");
    const isLast = playState.index + 1 >= currentQuiz.questions.length;
    page.classList.add("q-page--out");
    setTimeout(() => {
      playState.index += 1;
      if (isLast) finishQuiz();
      else showQuestionPage();
    }, 250);
  }

  async function finishQuiz() {
    clearQuestionTimer();
    const total = currentQuiz.questions.length;
    let score = 0;
    const details = [];
    currentQuiz.questions.forEach((q, i) => {
      const ans = playState.answers[i];
      const ok = isAnswerCorrect(q, ans);
      if (ok) score += 1;
      const playerAnswer =
        q.type === "text"
          ? (ans?.text || "—")
          : ans >= 0
            ? q.options[ans]
            : "—";
      details.push({ q, ok, playerAnswer, correct: getCorrectLabel(q) });
    });

    const tier = getTier(score, total, currentQuiz.creator, currentQuiz.isGamer, currentQuiz.gamerLevel);
    const id = currentQuiz._id || quizId(currentQuiz);
    const entry = {
      name: playState.playerName,
      score,
      total,
      date: Date.now(),
      answers: playState.answers,
    };
    await saveScore(id, entry);

    $("#resultScore").textContent = `${score} / ${total}`;
    $("#resultTitle").textContent = tier.title;
    $("#resultMsg").textContent = tier.msg;
    $("#resultCreator").textContent = `Quiz de ${currentQuiz.creator}`;
    if ($("#resultBadge")) $("#resultBadge").textContent = tier.badge;

    const detailsEl = $("#resultDetails");
    const detailsList = $("#resultDetailsList");
    if (detailsEl && detailsList) {
      const wrong = details.filter((d) => !d.ok);
      if (wrong.length) {
        detailsList.innerHTML = wrong
          .map(
            (d) => `
          <li class="result-details__item result-details__item--wrong">
            <strong>${escapeHtml(d.q.text)}</strong>
            <span>Tu as dit : ${escapeHtml(d.playerAnswer)}</span>
            <span>Bonne réponse : ${escapeHtml(d.correct)}</span>
          </li>`
          )
          .join("");
        detailsEl.hidden = false;
      } else {
        detailsEl.hidden = true;
      }
    }

    lastReviewData = { quiz: currentQuiz, details, score, total, playerName: playState.playerName };
    currentQuiz._lastScore = { score, total, playerName: playState.playerName };
    showScreen("result");
  }

  function renderReview() {
    if (!lastReviewData) return;
    const { quiz, details } = lastReviewData;
    $("#reviewSubtitle").textContent = `Quiz de ${quiz.creator} — ${details.length} questions`;
    $("#reviewList").innerHTML = details
      .map((d, i) => {
        const cls = d.ok ? "review-item--ok" : "review-item--ko";
        return `
        <li class="review-item ${cls}">
          <span class="review-item__num">${i + 1}</span>
          <div>
            <p class="review-item__q">${escapeHtml(d.q.text)}</p>
            <p class="review-item__a">✓ ${escapeHtml(d.correct)}</p>
            ${d.ok ? "" : `<p class="review-item__yours">Toi : ${escapeHtml(d.playerAnswer)}</p>`}
            ${d.q.hint ? `<p class="review-item__hint">${escapeHtml(d.q.hint)}</p>` : ""}
          </div>
        </li>`;
      })
      .join("");
    showScreen("review");
  }

  function shareResultText() {
    const s = currentQuiz._lastScore;
    if (!s) return "";
    return `J'ai fait ${s.score}/${s.total} au quiz de ${currentQuiz.creator} sur QuizMoi ! Es-tu vraiment mon ami ? 😏\n${playUrl(currentQuiz._encoded || encodeQuiz(currentQuiz))}`;
  }

  async function renderLeaderboard(id, creator) {
    const list = $("#leaderboard");
    const empty = $("#leaderboardEmpty");
    const statsPanel = $("#statsPanel");
    $("#manageCreatorLabel").textContent = creator ? `Quiz de ${creator}` : "Classement";
    empty.textContent = isOnlineDb() ? "Personne n'a encore joué." : "Personne n'a encore joué sur cet appareil.";
    list.innerHTML = '<li class="leaderboard__loading">Chargement…</li>';

    const scores = await loadScores(id);
    notifyNewPlayers(id, scores);

    if (statsPanel && currentQuiz?.questions) {
      const stats = computeQuizStats(currentQuiz, scores);
      statsPanel.innerHTML = `
        <div class="stat-card"><span>${stats.totalPlays}</span><small>Joueurs</small></div>
        <div class="stat-card"><span>${stats.avgPercent}%</span><small>Score moyen</small></div>
        ${
          stats.hardest
            ? `<div class="stat-card stat-card--wide"><span>Question la plus ratée</span><small>${escapeHtml(stats.hardest.question.text)} (${stats.hardest.count}×)</small></div>`
            : ""
        }`;
    }

    if (scores.length === 0) {
      list.innerHTML = "";
      empty.hidden = false;
      return;
    }
    empty.hidden = true;
    list.innerHTML = scores
      .map((entry, i) => {
        const rankClass = i === 0 ? " leaderboard__rank--gold" : "";
        const medal = i === 0 ? "🥇" : i === 1 ? "🥈" : i === 2 ? "🥉" : i + 1;
        return `
          <li>
            <span class="leaderboard__rank${rankClass}">${medal}</span>
            <div class="leaderboard__info">
              <div class="leaderboard__name">${escapeHtml(entry.name)}</div>
              <div class="leaderboard__score">${formatDate(entry.date)}</div>
            </div>
            <span class="leaderboard__pts">${entry.score}/${entry.total}</span>
          </li>`;
      })
      .join("");
  }

  function notifyNewPlayers(quizId, scores) {
    if (!("Notification" in window) || Notification.permission !== "granted") return;
    const key = `quizmoi_last_seen_${quizId}`;
    const last = parseInt(localStorage.getItem(key) || "0", 10);
    const newOnes = scores.filter((s) => s.date > last);
    if (newOnes.length && document.hidden) {
      new Notification("QuizMoi", {
        body: `${newOnes.length} nouveau(x) joueur(s) sur ton quiz !`,
      });
    }
    if (scores.length) {
      localStorage.setItem(key, String(Math.max(...scores.map((s) => s.date))));
    }
  }

  async function renderDashboard() {
    const list = $("#dashboardList");
    const empty = $("#dashboardEmpty");
    const user = getCurrentUser();
    $("#dashboardUserLabel").textContent = user?.email
      ? `Connecté : ${user.email}`
      : "Connecte-toi avec Google pour retrouver tes quiz partout.";

    if (!user?.uid || user.isAnonymous) {
      list.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "Connecte-toi avec Google pour voir tes quiz.";
      return;
    }

    const items = isOnlineDb() ? await loadCreatorQuizzes(user.uid) : [];
    if (!items.length) {
      list.innerHTML = "";
      empty.hidden = false;
      empty.textContent = "Aucun quiz enregistré. Crée-en un !";
      return;
    }
    empty.hidden = true;
    list.innerHTML = items
      .map(
        (item) => `
      <li class="dashboard-item">
        <div>
          <strong>${escapeHtml(item.creator)}</strong>
          <span>${item.questionCount} questions · ${formatDate(item.createdAt)}</span>
        </div>
        <div class="dashboard-item__actions">
          <button type="button" class="btn btn--chip" data-action="manage" data-id="${item.id}">Stats</button>
          <button type="button" class="btn btn--chip" data-action="play" data-id="${item.id}">Jouer</button>
        </div>
      </li>`
      )
      .join("");

    list.querySelectorAll("button").forEach((btn) => {
      btn.addEventListener("click", async () => {
        const id = btn.dataset.id;
        let quiz = loadQuizLocally(id);
        if (!quiz && isOnlineDb()) {
          const remote = await loadQuizRemote(id);
          if (remote?.encoded) {
            quiz = decodeQuiz(remote.encoded);
            if (quiz) {
              quiz._encoded = remote.encoded;
              quiz._id = id;
              saveQuizLocally(id, quiz);
            }
          }
        }
        if (btn.dataset.action === "play" && quiz) {
          startPlay(quiz);
        } else {
          window.location.href = manageUrl(id);
        }
      });
    });
  }

  function escapeHtml(str) {
    const d = document.createElement("div");
    d.textContent = str;
    return d.innerHTML;
  }

  function formatDate(ts) {
    const d = new Date(ts);
    return d.toLocaleDateString("fr-FR", { day: "numeric", month: "short", hour: "2-digit", minute: "2-digit" });
  }

  function parseIncomingLink(raw) {
    if (!raw) return null;
    raw = raw.trim();
    try {
      if (raw.includes("?q=") || raw.includes("&q=")) {
        const url = new URL(raw, baseUrl());
        return url.searchParams.get("q");
      }
      if (raw.startsWith("?q=")) return raw.slice(3);
      if (!raw.includes("/") && raw.length > 20) return raw;
    } catch (_) {}
    return null;
  }

  async function initFromUrl() {
    const params = new URLSearchParams(window.location.search);
    const encoded = params.get("q");
    if (encoded) {
      const quiz = decodeQuiz(encoded);
      if (quiz) {
        quiz._encoded = encoded;
        quiz._id = quizId(quiz);
        saveQuizLocally(quiz._id, quiz);
        if (isOnlineDb()) {
          try { await saveQuizRemote(quiz._id, quiz, encoded); } catch (_) {}
        }
        startPlay(quiz);
        return;
      }
    }

    const manageId = params.get("manage");
    if (manageId) {
      let quiz = loadQuizLocally(manageId);
      let creator = quiz ? quiz.creator : null;
      if (!quiz && isOnlineDb()) {
        try {
          const remote = await loadQuizRemote(manageId);
          if (remote) {
            creator = remote.creator || creator;
            if (remote.encoded) {
              quiz = decodeQuiz(remote.encoded);
              if (quiz) {
                quiz._encoded = remote.encoded;
                quiz._id = manageId;
                quiz.intro = remote.intro || quiz.intro;
                quiz.avatar = remote.avatar || quiz.avatar;
                quiz.timer = remote.timer ?? quiz.timer;
                saveQuizLocally(manageId, quiz);
              }
            }
          }
        } catch (_) {}
      }
      if (quiz) {
        currentQuiz = quiz;
        currentQuiz._id = manageId;
        currentQuiz._encoded = currentQuiz._encoded || encodeQuiz(quiz);
      } else if (creator) {
        currentQuiz = { creator, _id: manageId };
      }
      await renderLeaderboard(manageId, creator);
      showScreen("manage");
      return;
    }
    showScreen("home");
  }

  function cacheContent(data) {
    try {
      localStorage.setItem("quizmoi_content_cache", JSON.stringify({ data, ts: Date.now() }));
    } catch (_) {}
  }

  function loadCachedContent() {
    try {
      const raw = localStorage.getItem("quizmoi_content_cache");
      if (!raw) return null;
      const { data, ts } = JSON.parse(raw);
      if (Date.now() - ts > 86400000) return null;
      return data;
    } catch {
      return null;
    }
  }

  function normalizeGamerQuizzes(list) {
    return list.map((g) => {
      if (g.levels?.easy?.questions?.length) return g;
      if (!g.questions?.length) return g;
      return {
        ...g,
        levels: {
          easy: { intro: g.intro, questions: g.questions },
          hard: { intro: g.intro, questions: g.questions },
          expert: { intro: g.intro, questions: g.questions },
        },
      };
    });
  }

  function applyContentData(data) {
    THEMES = data.themes;
    QUESTION_BANK = data.questionBank;
    DEFAULT_COUNT = data.defaultCount || 8;
    QUIZ_TEMPLATES = data.quizTemplates || DEFAULT_TEMPLATES;
    GAMER_QUIZZES = normalizeGamerQuizzes(
      data.gamerQuizzes?.length ? data.gamerQuizzes : FALLBACK_GAMER_QUIZZES
    );
    quizSetup = {
      count: DEFAULT_COUNT,
      themes: Array.isArray(data.defaultThemes) ? [...data.defaultThemes] : [],
      blank: false,
      timer: false,
    };
  }

  async function loadCommunityBank() {
    COMMUNITY_BY_THEME = {};
    if (!isOnlineDb()) return;
    try {
      const list = await loadCommunityQuestions();
      list.forEach((q) => {
        if (!COMMUNITY_BY_THEME[q.theme]) COMMUNITY_BY_THEME[q.theme] = [];
        COMMUNITY_BY_THEME[q.theme].push(q);
      });
    } catch (_) {}
  }

  function bindEvents() {
    $("#btnCreate").addEventListener("click", () => openSetup(false));
    $("#btnQuizGamer")?.addEventListener("click", openGamerHub);
    $("#btnBackGamer")?.addEventListener("click", () => showScreen("home"));
    $("#btnBackGamerLevel")?.addEventListener("click", () => showScreen("gamer"));
    $$(".difficulty-card").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (selectedGamerId) startGamerQuiz(selectedGamerId, btn.dataset.level);
      });
    });
    $("#btnCreateBlank").addEventListener("click", () => openSetup(true));
    $("#btnNavNewQuiz").addEventListener("click", startNewQuiz);
    $("#btnDashboard")?.addEventListener("click", async () => {
      await renderDashboard();
      showScreen("dashboard");
    });
    $("#btnBackDashboard")?.addEventListener("click", () => showScreen("home"));
    $("#btnDashboardCreate")?.addEventListener("click", () => openSetup(false));
    $("#btnGoogleSignIn")?.addEventListener("click", async () => {
      await signInWithGoogle();
      await renderDashboard();
    });

    $("#btnBackSetup").addEventListener("click", () => showScreen("home"));
    $("#btnSetupContinue").addEventListener("click", continueFromSetup);
    $("#countPicker").addEventListener("click", (e) => {
      const btn = e.target.closest(".count-btn");
      if (!btn) return;
      quizSetup.count = parseInt(btn.dataset.count, 10);
      renderCountPicker();
    });

    $("#btnJoin").addEventListener("click", () => {
      $("#joinBox").hidden = !$("#joinBox").hidden;
    });
    $("#btnJoinGo").addEventListener("click", () => {
      const encoded = parseIncomingLink($("#joinInput").value);
      if (!encoded) { $("#joinInput").focus(); return; }
      const quiz = decodeQuiz(encoded);
      if (!quiz) { alert("Lien invalide ou quiz introuvable."); return; }
      quiz._encoded = encoded;
      quiz._id = quizId(quiz);
      startPlay(quiz);
    });

    $("#btnBackCreate").addEventListener("click", () => {
      updateSetupView();
      showScreen(editingQuizId ? "manage" : "setup");
    });
    $("#btnTemplates").addEventListener("click", applyTemplates);
    $("#btnPublish").addEventListener("click", publishQuiz);

    $("#btnCopyLink").addEventListener("click", () => copyText($("#shareLink").value, $("#copyToast")));
    $("#btnCopyManage").addEventListener("click", () => {
      copyText($("#manageLink").value, null);
      alert("Lien classement copié !");
    });

    $("#btnShareWa").addEventListener("click", () => {
      window.open(`https://wa.me/?text=${encodeURIComponent(shareLinkText())}`, "_blank");
    });
    $("#btnShareSms").addEventListener("click", () => {
      window.location.href = `sms:?body=${encodeURIComponent(shareLinkText())}`;
    });
    $("#btnShareMessenger")?.addEventListener("click", () => {
      const url = encodeURIComponent($("#shareLink").value);
      window.open(`https://www.facebook.com/dialog/send?link=${url}&app_id=0&redirect_uri=${url}`, "_blank");
    });
    $("#btnShareNative")?.addEventListener("click", async () => {
      const text = shareLinkText();
      if (navigator.share) {
        try {
          await navigator.share({ title: "QuizMoi", text, url: $("#shareLink").value });
          return;
        } catch (_) {}
      }
      await copyText(text, $("#copyToast"));
    });
    $("#btnNotifyEnable")?.addEventListener("click", async () => {
      if (!("Notification" in window)) return alert("Notifications non supportées.");
      const perm = await Notification.requestPermission();
      alert(perm === "granted" ? "Notifications activées !" : "Notifications refusées.");
    });

    $("#btnPreview").addEventListener("click", () => { if (currentQuiz) startPlay(currentQuiz); });
    $("#btnNewQuiz").addEventListener("click", startNewQuiz);
    $("#btnNewQuizIntro").addEventListener("click", startNewQuiz);
    $("#btnNewQuizResult").addEventListener("click", startNewQuiz);
    $("#btnNewQuizManage").addEventListener("click", startNewQuiz);

    $("#btnStartPlay").addEventListener("click", beginQuestions);
    $("#btnContinue").addEventListener("click", continueToNext);
    $("#btnSubmitText")?.addEventListener("click", () => {
      registerTextAnswer($("#textAnswerInput").value);
    });
    $("#textAnswerInput")?.addEventListener("keydown", (e) => {
      if (e.key === "Enter") registerTextAnswer($("#textAnswerInput").value);
    });

    $("#btnShareResult").addEventListener("click", async () => {
      const text = shareResultText();
      if (navigator.share) {
        try { await navigator.share({ title: "QuizMoi", text }); return; } catch (_) {}
      }
      await copyText(text, null);
      alert("Score copié ! Colle-le en story ou en message.");
    });
    $("#btnReview")?.addEventListener("click", renderReview);
    $("#btnBackReview")?.addEventListener("click", () => showScreen("result"));
    $("#btnReviewHome")?.addEventListener("click", startNewQuiz);
    $("#btnCreateReturn")?.addEventListener("click", () => {
      openSetup(false);
      if ($("#creatorName")) $("#creatorName").value = playState.playerName || "";
    });

    $("#btnPlayAgain").addEventListener("click", () => {
      if (playQuizSource) startPlay(playQuizSource);
      else if (currentQuiz) startPlay(currentQuiz);
    });
    $("#btnGoHome").addEventListener("click", startNewQuiz);

    $("#btnEditQuiz")?.addEventListener("click", () => {
      if (currentQuiz?.questions) openEditQuiz(currentQuiz, currentQuiz._id);
      else alert("Quiz introuvable sur cet appareil.");
    });
    $("#btnPlayFromManage").addEventListener("click", () => {
      if (currentQuiz?.questions) startPlay(currentQuiz);
      else alert("Quiz introuvable sur cet appareil. Utilise le lien de jeu.");
    });
    $("#btnHomeFromManage").addEventListener("click", startNewQuiz);
  }

  function showContentError(message) {
    document.body.innerHTML = `
      <main style="max-width:28rem;margin:4rem auto;padding:1.5rem;font-family:system-ui,sans-serif;text-align:center;">
        <h1 style="font-size:1.25rem;margin-bottom:0.75rem;">QuizMoi</h1>
        <p style="color:#666;line-height:1.5;">${message}</p>
      </main>`;
  }

  async function loadContentFromFirebase() {
    let data = null;
    if (isOnlineDb()) {
      try {
        data = await loadAppContent();
        if (data?.themes?.length) cacheContent(data);
      } catch (_) {}
    }
    if (!data?.themes?.length) data = loadCachedContent();
    if (!data?.themes?.length || !data?.questionBank) {
      showContentError("Impossible de charger les thèmes et questions. Vérifie ta connexion.");
      return false;
    }
    applyContentData(data);
    await loadCommunityBank();
    renderTemplateRow();
    renderGamerGrid();
    return true;
  }

  async function boot() {
    await initFirebase();
    if (!isOnlineDb()) {
      showContentError("Firebase n'est pas configuré ou inaccessible.");
      return;
    }
    if (!(await loadContentFromFirebase())) return;
    renderThemeGrid();
    renderCountPicker();
    bindEvents();
    await initFromUrl();
    if ("serviceWorker" in navigator) {
      window.addEventListener("load", () => {
        navigator.serviceWorker.register("./sw.js").catch(() => {});
      });
    }
  }

  boot();
})();
