import {
  initFirebase,
  isOnlineDb,
  saveQuizRemote,
  loadQuizRemote,
  saveScoreRemote,
  loadScoresRemote,
} from "./firebase-db.js";

(function () {
  "use strict";

  const DEFAULT_COUNT = 8;

  const THEMES = [
    { id: "gouts", icon: "🎯", label: "Goûts & style", desc: "Couleurs, mode, emoji…" },
    { id: "food", icon: "🍕", label: "Food & boisson", desc: "Plats, restos, cuisine…" },
    { id: "musique", icon: "🎵", label: "Musique & culture", desc: "Artistes, films, séries…" },
    { id: "amitie", icon: "💛", label: "Amitié", desc: "Entre nous, nos habitudes…" },
    { id: "amour", icon: "💕", label: "Amour & couple", desc: "Dates, cadeaux, romance…" },
    { id: "famille", icon: "👨‍👩‍👧", label: "Famille", desc: "Parents, fratrie, traditions…" },
    { id: "fun", icon: "😂", label: "Fun & personnalité", desc: "Défauts, peurs, super-pouvoirs…" },
    { id: "habitudes", icon: "⚡", label: "Habitudes", desc: "Matin, sport, sommeil…" },
    { id: "souvenirs", icon: "📸", label: "Souvenirs", desc: "Voyages, école, moments…" },
  ];

  const QUESTION_BANK = {
    gouts: [
      { text: "Ma couleur préférée ?", options: ["Bleu", "Rouge", "Vert", "Violet"] },
      { text: "Mon emoji signature ?", options: ["😎", "🔥", "✨", "💀"] },
      { text: "Mon style vestimentaire ?", options: ["Casual", "Sport", "Chic", "Streetwear"] },
      { text: "Ma saison préférée ?", options: ["Printemps", "Été", "Automne", "Hiver"] },
      { text: "Mon animal totem ?", options: ["Chat", "Chien", "Loup", "Panda"] },
      { text: "Ce que je collectionne ?", options: ["Rien", "Livres", "Sneakers", "Photos"] },
      { text: "Mon parfum / odeur favorite ?", options: ["Vanille", "Citron", "Boisé", "Floral"] },
      { text: "Mon accessoire fétiche ?", options: ["Montre", "Casquette", "Bijoux", "Sac"] },
      { text: "Ma marque préférée ?", options: ["Nike", "Zara", "Apple", "Aucune en vrai"] },
      { text: "Mon décor de chambre ?", options: ["Minimaliste", "Cosy", "Coloré", "Chaos organisé"] },
    ],
    food: [
      { text: "Mon plat préféré ?", options: ["Pizza", "Sushi", "Tacos", "Pâtes"] },
      { text: "Ma boisson préférée ?", options: ["Café", "Thé", "Jus", "Eau pétillante"] },
      { text: "Mon fast-food ?", options: ["McDo", "KFC", "Subway", "Burger maison"] },
      { text: "Mon dessert ultime ?", options: ["Gâteau", "Glace", "Tiramisu", "Crêpes"] },
      { text: "Mon snack tard le soir ?", options: ["Chips", "Chocolat", "Fruits", "Rien du tout"] },
      { text: "Mon type de cuisine ?", options: ["Italienne", "Asiatique", "Française", "Mexicaine"] },
      { text: "Comment je prends mon café ?", options: ["Noir", "Latté", "Cappuccino", "Je ne bois pas"] },
      { text: "Mon topping pizza ?", options: ["Pepperoni", "4 fromages", "Végétarienne", "Ananas"] },
      { text: "Mon resto préféré ?", options: ["Italien", "Sushi bar", "Brunch", "Street food"] },
      { text: "Mon plat à cuisiner ?", options: ["Pâtes", "Omelette", "Curry", "Je brûle tout"] },
    ],
    musique: [
      { text: "Mon style de musique ?", options: ["Pop", "Rap", "Rock", "Electro"] },
      { text: "Mon style d'artiste préféré ?", options: ["Rappeur", "Popstar", "Groupe de rock", "DJ / électro"] },
      { text: "Mon film préféré ?", options: ["Comédie", "Action", "Romance", "Horreur"] },
      { text: "Ma série du moment ?", options: ["Drama", "Comédie", "Thriller", "Animé"] },
      { text: "Mon endroit pour un concert ?", options: ["Stade", "Petite salle", "Festival", "Canapé"] },
      { text: "Mon genre YouTube ?", options: ["Humour", "Musique", "Gaming", "Vlogs"] },
      { text: "Mon réseau social préféré ?", options: ["TikTok", "Instagram", "Snap", "Aucun"] },
      { text: "Mon type de jeu vidéo ?", options: ["Sport", "Battle royale", "Aventure", "Je ne joue pas"] },
      { text: "Mon livre / manga ?", options: ["Roman", "BD", "Manga", "Je ne lis pas"] },
      { text: "Ma plateforme de streaming ?", options: ["Netflix", "Disney+", "Spotify", "YouTube"] },
    ],
    amitie: [
      { text: "Où on se retrouve le plus ?", options: ["Au café", "Chez moi", "En ville", "En ligne"] },
      { text: "Mon rôle dans le groupe ?", options: ["Le drôle", "Le sage", "L'organisateur", "Le fou"] },
      { text: "Comment je dis bonjour ?", options: ["La bise", "Le check", "Un cri", "Un message"] },
      { text: "Mon activité entre amis ?", options: ["Sortir", "Gaming", "Ciné", "Rien, on cause"] },
      { text: "Mon délire avec les potes ?", options: ["Blagues", "Memes", "Chansons", "Débats"] },
      { text: "Comment je réagis quand on m'appelle ?", options: ["Direct", "Je rappelle plus tard", "Message vocal", "Ghost 2h"] },
      { text: "Mon cadeau d'anniversaire idéal ?", options: ["Expérience", "Objet", "Argent", "Surprise"] },
      { text: "Mon groupe WhatsApp ?", options: ["Actif", "Muet", "Que des memes", "Plans de dernière minute"] },
      { text: "Mon meilleur ami sait que je…", options: ["Mange mal", "Dors tard", "Chante mal", "Procrastine"] },
      { text: "Notre inside joke ?", options: ["Un surnom", "Une phrase", "Un son", "Un regard"] },
    ],
    amour: [
      { text: "Mon date idéal ?", options: ["Resto", "Balade", "Ciné", "Netflix"] },
      { text: "Mon langage de l'amour ?", options: ["Cadeaux", "Temps", "Mots", "Câlins"] },
      { text: "Ma fleur préférée ?", options: ["Rose", "Tulipe", "Lys", "Aucune"] },
      { text: "Mon cadeau romantique ?", options: ["Lettre", "Bijou", "Surprise", "Repas maison"] },
      { text: "Ma chanson de couple ?", options: ["Slow", "Pop", "Rap", "On n'en a pas"] },
      { text: "Mon film romantique ?", options: ["Classique", "Comédie", "Drama", "Pas mon truc"] },
      { text: "Comment je dis je t'aime ?", options: ["Direct", "Par actions", "Par emoji", "Rarement"] },
      { text: "Mon endroit romantique ?", options: ["Plage", "Montagne", "Ville", "Chez nous"] },
      { text: "Mon petit-déjeuner en amoureux ?", options: ["Croissants", "Pancakes", "Fruits", "Café seulement"] },
      { text: "Ma soirée parfaite à deux ?", options: ["Resto", "Série", "Balade", "Soirée jeux"] },
    ],
    famille: [
      { text: "Mon plat de famille ?", options: ["Gratin", "Raclette", "Tajine", "Barbecue"] },
      { text: "Mon rôle en famille ?", options: ["Le calme", "Le boute-en-train", "Le mediator", "Le rebelle"] },
      { text: "Ma tradition familiale ?", options: ["Repas du dimanche", "Vacances", "Noël", "Aucune fixe"] },
      { text: "Qui je ressemble le plus ?", options: ["Maman", "Papa", "Personne", "Mon frère/sœur"] },
      { text: "Mon surnom en famille ?", options: ["Bébé", "Champion", "Le petit", "Aucun"] },
      { text: "Mon endroit chez les parents ?", options: ["Canapé", "Cuisine", "Ma chambre", "Jardin"] },
      { text: "Ce que ma famille dit toujours ?", options: ["Mange !", "Range !", "Tu dors ?", "Appelle plus"] },
      { text: "Mon cadeau pour Papa/Maman ?", options: ["Parfum", "Expérience", "Fait main", "Carte"] },
      { text: "Notre activité en famille ?", options: ["Jeux", "Balade", "Ciné", "On se dispute"] },
      { text: "Mon plat appris en famille ?", options: ["Gâteau", "Sauce", "Soupe", "Rien, Uber Eats"] },
    ],
    fun: [
      { text: "Mon pire défaut ?", options: ["Trop en retard", "Trop bavard", "Perfectionniste", "Distrait"] },
      { text: "Mon super-pouvoir secret ?", options: ["Dormir partout", "Manger énormément", "Retenir les dates", "Faire rire"] },
      { text: "Ma plus grande peur ?", options: ["Araignées", "Vide", "Examen oral", "Rater le réveil"] },
      { text: "Mon talent caché ?", options: ["Chant", "Dessin", "Imitations", "Aucun"] },
      { text: "Mon emoji quand je suis énervé ?", options: ["😤", "💀", "🙃", "🤐"] },
      { text: "Ma réaction au stress ?", options: ["Je mange", "Je dors", "Je parle", "Je disparais"] },
      { text: "Mon mensonge préféré ?", options: ["J'arrive", "5 minutes", "J'ai pas vu", "Demain je m'y mets"] },
      { text: "Mon délire absurde ?", options: ["Blagues nulles", "Voix bizarres", "Danses", "Théories"] },
      { text: "Mon personnage Disney ?", options: ["Princesse", "Méchant", "Sidekick", "Héros"] },
      { text: "Ce qui me fait rire à fond ?", options: ["Chutes", "Memes", "Blagues nulles", "Mes potes"] },
    ],
    habitudes: [
      { text: "Plutôt lève-tôt ou couche-tard ?", options: ["Lève-tôt", "Couche-tard", "Les deux", "Dépend"] },
      { text: "Mon sport ?", options: ["Foot", "Muscu", "Course", "Aucun"] },
      { text: "Mon rituel du matin ?", options: ["Café", "Douche", "Scroll", "Rien"] },
      { text: "Combien d'alarmes le matin ?", options: ["1", "3", "10", "Je n'ai pas besoin"] },
      { text: "Mon rangement ?", options: ["Impeccable", "Organisé", "Bordélique", "Chaos"] },
      { text: "Mon temps d'écran ?", options: ["Trop", "Normal", "Peu", "Je nie"] },
      { text: "Ma sieste ?", options: ["Tous les jours", "Week-end", "Jamais", "Au boulot en cachette"] },
      { text: "Mon moyen de transport ?", options: ["Voiture", "Vélo", "Transports", "À pied"] },
      { text: "Mon organisation ?", options: ["Agenda", "Listes", "Dans ma tête", "Aucune"] },
      { text: "Ma boisson du matin ?", options: ["Café", "Thé", "Jus", "Rien"] },
    ],
    souvenirs: [
      { text: "Mon meilleur voyage ?", options: ["Plage", "Montagne", "Ville", "Camping"] },
      { text: "Mon souvenir d'école ?", options: ["Rentrée", "Sortie", "Prof", "Récré"] },
      { text: "Mon moment le plus drôle ?", options: ["Soirée", "Vacances", "École", "Random"] },
      { text: "Mon cadeau le plus mémorable ?", options: ["Surprise", "Fait main", "Gadget", "Voyage"] },
      { text: "Mon endroit d'enfance ?", options: ["Parc", "Mer", "Campagne", "Ma chambre"] },
      { text: "Ma photo préférée ?", options: ["Entre amis", "En famille", "En voyage", "Selfie"] },
      { text: "Mon concert mémorable ?", options: ["Stade", "Petite salle", "Festival", "Jamais été"] },
      { text: "Mon anniversaire idéal ?", options: ["Grande fête", "Intime", "Surprise", "Discret"] },
      { text: "Mon souvenir avec toi ?", options: ["Une soirée", "Un voyage", "Une blague", "On se connaît pas assez"] },
      { text: "Mon objectif cette année ?", options: ["Voyage", "Sport", "Projet", "Profiter"] },
    ],
  };

  let currentQuiz = null;
  let playState = { index: 0, answers: [], playerName: "", locked: false };
  let quizSetup = { count: DEFAULT_COUNT, themes: ["gouts", "amitie", "fun"], blank: false };

  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => document.querySelectorAll(sel);

  function showScreen(name) {
    $$(".screen").forEach((el) => el.classList.remove("screen--active"));
    const screen = document.querySelector(`[data-screen="${name}"]`);
    if (screen) screen.classList.add("screen--active");
    const navBtn = $("#btnNavNewQuiz");
    if (navBtn) navBtn.hidden = name === "home";
  }

  function openSetup(blank) {
    quizSetup = {
      count: DEFAULT_COUNT,
      themes: blank ? [] : ["gouts", "amitie", "fun"],
      blank: !!blank,
    };
    renderThemeGrid();
    renderCountPicker();
    updateSetupView();
    $("#setupError").hidden = true;
    showScreen("setup");
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
    playState = { index: 0, answers: [], playerName: "", locked: false };
    if (window.location.search) {
      window.location.href = baseUrl();
      return;
    }
    showScreen("home");
  }

  function blankQuestions(count) {
    return Array.from({ length: count }, () => ({
      text: "",
      options: ["", "", "", ""],
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

  function pickQuestions(count, themeIds) {
    const pool = [];
    themeIds.forEach((id) => {
      (QUESTION_BANK[id] || []).forEach((q) => {
        pool.push({ ...q, theme: id });
      });
    });

    if (pool.length === 0) return [];

    const shuffled = shuffle(pool);
    const picked = [];
    const usedTexts = new Set();

    for (const q of shuffled) {
      if (picked.length >= count) break;
      if (!usedTexts.has(q.text)) {
        usedTexts.add(q.text);
        picked.push(q);
      }
    }

    while (picked.length < count) {
      const q = shuffled[picked.length % shuffled.length];
      picked.push({ ...q, theme: q.theme });
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
      `;
      $("#createSubtitle").textContent = `${quizSetup.count} questions vides — à remplir par toi.`;
      return;
    }
    const themeTags = quizSetup.themes.map((id) => `<span class="setup-tag">${themeLabel(id)}</span>`).join("");
    summary.innerHTML = `
      <span class="setup-tag">${quizSetup.count} questions</span>
      ${themeTags}
    `;
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
      try {
        await saveScoreRemote(id, entry);
      } catch (_) {}
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

  function getTier(score, total, creator) {
    const pct = total ? score / total : 0;
    if (score === total) {
      return { title: "Légende absolue", msg: `Score parfait. ${creator} devrait t'adopter.` };
    }
    if (pct >= 0.75) {
      return { title: "Âme sœur", msg: `Tu connais ${creator} mieux que ${creator} ne se connaît !` };
    }
    if (pct >= 0.5) {
      return { title: "Bon ami", msg: "Pas mal ! Tu fais partie du cercle proche." };
    }
    if (pct >= 0.25) {
      return { title: "Connaissance de surface", msg: `Tu as croisé ${creator} deux fois dans un couloir.` };
    }
    return { title: "Stranger danger", msg: "On se présente ? Tu connais à peine le prénom…" };
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
      const block = document.createElement("div");
      block.className = "q-block";
      block.dataset.index = i;
      const themeBadge = tpl.theme ? `<span class="q-block__theme">${themeLabel(tpl.theme)}</span>` : "";
      block.innerHTML = `
        <div class="q-block__head">
          <span class="q-block__num">${i + 1}</span>
          <label>Question ${i + 1}</label>
          ${themeBadge}
        </div>
        <input type="text" class="input q-text" placeholder="Ta question…" value="${escapeAttr(tpl.text)}" maxlength="120" />
        <div class="q-options">
          ${tpl.options
            .map(
              (opt, j) => `
            <div class="q-option">
              <input type="radio" name="correct-${i}" value="${j}" ${j === 0 ? "checked" : ""} title="Bonne réponse" />
              <input type="text" class="q-opt-text" placeholder="Réponse ${j + 1}" value="${escapeAttr(opt)}" maxlength="60" />
            </div>`
            )
            .join("")}
        </div>
      `;
      container.appendChild(block);
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
    const blocks = $$(".q-block");
    const questions = [];

    blocks.forEach((block) => {
      const text = block.querySelector(".q-text").value.trim();
      const options = [...block.querySelectorAll(".q-opt-text")].map((inp) => inp.value.trim());
      const correctRadio = block.querySelector('input[type="radio"]:checked');
      const correct = correctRadio ? parseInt(correctRadio.value, 10) : 0;
      questions.push({ text, options, correct });
    });

    return { creator, questions, themes: [...quizSetup.themes], count: questions.length };
  }

  function validateQuiz(quiz) {
    if (!quiz.creator) return "Entre ton prénom.";
    if (quiz.creator.length < 2) return "Prénom trop court.";
    if (quiz.questions.length < 3) return "Il faut au moins 3 questions.";

    for (let i = 0; i < quiz.questions.length; i++) {
      const q = quiz.questions[i];
      if (!q.text) return `Question ${i + 1} : texte manquant.`;
      for (let j = 0; j < q.options.length; j++) {
        if (!q.options[j]) return `Question ${i + 1} : réponse ${j + 1} manquante.`;
      }
      const unique = new Set(q.options.map((o) => o.toLowerCase()));
      if (unique.size < q.options.length) return `Question ${i + 1} : deux réponses identiques.`;
    }
    return null;
  }

  function applyTemplates() {
    if (quizSetup.blank) return;
    renderQuestionEditor();
  }

  function continueFromSetup() {
    const errEl = $("#setupError");
    errEl.hidden = true;

    if (!quizSetup.blank && quizSetup.themes.length === 0) {
      errEl.textContent = "Choisis au moins un thème.";
      errEl.hidden = false;
      return;
    }

    updateSetupSummary();
    updateCreateView();
    renderQuestionEditor();
    $("#creatorName").value = "";
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

    const encoded = encodeQuiz(quiz);
    const id = quizId(quiz);
    saveQuizLocally(id, quiz);

    if (isOnlineDb()) {
      try {
        await saveQuizRemote(id, quiz, encoded);
      } catch (_) {}
    }

    currentQuiz = quiz;
    currentQuiz._encoded = encoded;
    currentQuiz._id = id;

    $("#shareLink").value = playUrl(encoded);
    $("#manageLink").value = manageUrl(id);
    showScreen("share");
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

  function startPlay(quiz) {
    currentQuiz = quiz;
    playState = { index: 0, answers: [], playerName: "", locked: false };
    const total = quiz.questions.length;

    $("#playCreatorLabel").textContent = `Quiz de ${quiz.creator}`;
    $("#playCreatorLabelQ").textContent = `Quiz de ${quiz.creator}`;
    $("#introCreatorName").textContent = quiz.creator;
    $("#introQuestionCount").textContent = total;
    $("#playerName").value = "";
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
    showQuestionPage();
  }

  function hideFeedback() {
    $("#answerFeedback").hidden = true;
    $("#feedbackCorrect").hidden = true;
    $("#feedbackBox").className = "answer-feedback__box";
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
    list.innerHTML = "";

    q.options.forEach((opt, i) => {
      const li = document.createElement("li");
      const btn = document.createElement("button");
      btn.type = "button";
      btn.className = "option-btn";
      btn.textContent = opt;
      btn.dataset.index = i;
      btn.addEventListener("click", () => selectAnswer(i));
      li.appendChild(btn);
      list.appendChild(li);
    });

    const page = $("#questionPage");
    page.classList.remove("q-page--out");
    void page.offsetWidth;
    page.style.animation = "none";
    void page.offsetWidth;
    page.style.animation = "";

    showScreen("play-question");
  }

  function selectAnswer(choice) {
    if (playState.locked) return;

    const q = currentQuiz.questions[playState.index];
    const isCorrect = choice === q.correct;
    playState.answers.push(choice);
    playState.locked = true;

    const buttons = $$("#optionsList .option-btn");
    buttons.forEach((btn, i) => {
      btn.disabled = true;
      btn.classList.add("option-btn--disabled");
      if (i === q.correct) {
        btn.classList.add("option-btn--correct");
      } else if (i === choice && !isCorrect) {
        btn.classList.add("option-btn--wrong");
      }
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
      feedbackTitle.textContent = "✗ Mauvaise réponse";
      feedbackCorrect.textContent = `La bonne réponse : ${q.options[q.correct]}`;
      feedbackCorrect.hidden = false;
    }

    const isLast = playState.index + 1 >= currentQuiz.questions.length;
    $("#btnContinue").textContent = isLast ? "Voir mon résultat →" : `Question ${playState.index + 2} →`;
    $("#answerFeedback").hidden = false;
  }

  function continueToNext() {
    const page = $("#questionPage");
    const isLast = playState.index + 1 >= currentQuiz.questions.length;

    page.classList.add("q-page--out");

    setTimeout(() => {
      playState.index += 1;
      if (isLast) {
        finishQuiz();
      } else {
        showQuestionPage();
      }
    }, 250);
  }

  async function finishQuiz() {
    const total = currentQuiz.questions.length;
    let score = 0;
    currentQuiz.questions.forEach((q, i) => {
      if (playState.answers[i] === q.correct) score += 1;
    });

    const tier = getTier(score, total, currentQuiz.creator);
    const id = currentQuiz._id || quizId(currentQuiz);

    await saveScore(id, {
      name: playState.playerName,
      score,
      total,
      date: Date.now(),
    });

    $("#resultScore").textContent = `${score} / ${total}`;
    $("#resultTitle").textContent = tier.title;
    $("#resultMsg").textContent = tier.msg;
    $("#resultCreator").textContent = `Quiz de ${currentQuiz.creator}`;

    currentQuiz._lastScore = { score, total, playerName: playState.playerName };
    showScreen("result");
  }

  function shareResultText() {
    const s = currentQuiz._lastScore;
    if (!s) return "";
    return `J'ai fait ${s.score}/${s.total} au quiz de ${currentQuiz.creator} sur QuizMoi ! Es-tu vraiment mon ami ? 😏\n${playUrl(currentQuiz._encoded || encodeQuiz(currentQuiz))}`;
  }

  async function renderLeaderboard(id, creator) {
    const list = $("#leaderboard");
    const empty = $("#leaderboardEmpty");

    $("#manageCreatorLabel").textContent = creator ? `Quiz de ${creator}` : "Classement";

    empty.textContent = isOnlineDb()
      ? "Personne n'a encore joué."
      : "Personne n'a encore joué sur cet appareil.";

    list.innerHTML = '<li class="leaderboard__loading">Chargement…</li>';

    const scores = await loadScores(id);

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
          try {
            await saveQuizRemote(quiz._id, quiz, encoded);
          } catch (_) {}
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

  function bindEvents() {
    $("#btnCreate").addEventListener("click", () => openSetup(false));
    $("#btnCreateBlank").addEventListener("click", () => openSetup(true));
    $("#btnNavNewQuiz").addEventListener("click", startNewQuiz);

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
      if (!encoded) {
        $("#joinInput").focus();
        return;
      }
      const quiz = decodeQuiz(encoded);
      if (!quiz) {
        alert("Lien invalide ou quiz introuvable.");
        return;
      }
      quiz._encoded = encoded;
      quiz._id = quizId(quiz);
      startPlay(quiz);
    });

    $("#btnBackCreate").addEventListener("click", () => {
      updateSetupView();
      showScreen("setup");
    });
    $("#btnTemplates").addEventListener("click", applyTemplates);
    $("#btnPublish").addEventListener("click", publishQuiz);

    $("#btnCopyLink").addEventListener("click", () => {
      copyText($("#shareLink").value, $("#copyToast"));
    });

    $("#btnCopyManage").addEventListener("click", () => {
      copyText($("#manageLink").value, null);
      alert("Lien classement copié !");
    });

    $("#btnShareWa").addEventListener("click", () => {
      const text = encodeURIComponent(`Fais mon quiz « Es-tu vraiment mon ami ? » 👀\n${$("#shareLink").value}`);
      window.open(`https://wa.me/?text=${text}`, "_blank");
    });

    $("#btnShareSms").addEventListener("click", () => {
      const text = encodeURIComponent(`Fais mon quiz ! ${$("#shareLink").value}`);
      window.location.href = `sms:?body=${text}`;
    });

    $("#btnPreview").addEventListener("click", () => {
      if (currentQuiz) startPlay(currentQuiz);
    });

    $("#btnNewQuiz").addEventListener("click", startNewQuiz);

    $("#btnNewQuizIntro").addEventListener("click", startNewQuiz);
    $("#btnNewQuizResult").addEventListener("click", startNewQuiz);
    $("#btnNewQuizManage").addEventListener("click", startNewQuiz);

    $("#btnStartPlay").addEventListener("click", beginQuestions);
    $("#btnContinue").addEventListener("click", continueToNext);

    $("#btnShareResult").addEventListener("click", async () => {
      const text = shareResultText();
      if (navigator.share) {
        try {
          await navigator.share({ title: "QuizMoi", text });
          return;
        } catch (_) {}
      }
      await copyText(text, null);
      alert("Score copié ! Colle-le en story ou en message.");
    });

    $("#btnPlayAgain").addEventListener("click", () => {
      if (currentQuiz) startPlay(currentQuiz);
    });

    $("#btnGoHome").addEventListener("click", startNewQuiz);

    $("#btnPlayFromManage").addEventListener("click", () => {
      if (currentQuiz) {
        startPlay(currentQuiz);
      } else {
        alert("Quiz introuvable sur cet appareil. Utilise le lien de jeu.");
      }
    });

    $("#btnHomeFromManage").addEventListener("click", startNewQuiz);
  }

  async function boot() {
    await initFirebase();
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
