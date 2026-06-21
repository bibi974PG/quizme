import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getAuth,
  signInAnonymously,
  GoogleAuthProvider,
  signInWithPopup,
  onAuthStateChanged,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-auth.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  orderBy,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let app = null;
let db = null;
let auth = null;
let currentUser = null;

export async function initFirebase() {
  if (!isFirebaseConfigured()) return false;
  try {
    app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    auth = getAuth(app);
    onAuthStateChanged(auth, (user) => {
      currentUser = user;
    });
    try {
      await signInAnonymously(auth);
    } catch (_) {}
    return true;
  } catch {
    return false;
  }
}

export function isOnlineDb() {
  return db !== null;
}

export function getCurrentUser() {
  return currentUser;
}

export async function signInWithGoogle() {
  if (!auth) return null;
  const provider = new GoogleAuthProvider();
  try {
    const result = await signInWithPopup(auth, provider);
    currentUser = result.user;
    return result.user;
  } catch {
    return null;
  }
}

export async function saveQuizRemote(id, quiz, encoded) {
  if (!db) return false;
  const data = {
    creator: quiz.creator,
    questionCount: quiz.questions.length,
    encoded,
    createdAt: quiz.createdAt || Date.now(),
    intro: quiz.intro || "",
    avatar: quiz.avatar || "",
    timer: !!quiz.timer,
    timerSec: quiz.timerSec || 15,
    creatorUid: currentUser?.uid || quiz.creatorUid || null,
  };
  await setDoc(doc(db, "quizzes", id), data, { merge: true });
  if (currentUser?.uid) {
    await setDoc(
      doc(db, "userQuizzes", currentUser.uid, "items", id),
      {
        creator: quiz.creator,
        questionCount: quiz.questions.length,
        createdAt: data.createdAt,
      },
      { merge: true }
    );
  }
  return true;
}

export async function loadQuizRemote(id) {
  if (!db) return null;
  const snap = await getDoc(doc(db, "quizzes", id));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function loadCreatorQuizzes(uid) {
  if (!db || !uid) return [];
  const q = query(
    collection(db, "userQuizzes", uid, "items"),
    orderBy("createdAt", "desc"),
    limit(50)
  );
  const snap = await getDocs(q);
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }));
}

export async function saveScoreRemote(quizId, entry) {
  if (!db) return false;
  await addDoc(collection(db, "scores"), {
    quizId,
    name: entry.name,
    score: entry.score,
    total: entry.total,
    date: entry.date,
    answers: entry.answers || null,
    timeBonus: entry.timeBonus || 0,
  });
  return true;
}

export async function loadScoresRemote(quizId) {
  if (!db) return null;
  const q = query(collection(db, "scores"), where("quizId", "==", quizId), limit(200));
  const snap = await getDocs(q);
  const list = snap.docs.map((d) => {
    const x = d.data();
    return {
      name: x.name,
      score: x.score,
      total: x.total,
      date: x.date,
      answers: x.answers || null,
    };
  });
  list.sort((a, b) => b.score - a.score || b.date - a.date);
  return list;
}

export async function loadAppContent() {
  if (!db) return null;
  const snap = await getDoc(doc(db, "content", "app"));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function loadCommunityQuestions() {
  if (!db) return [];
  try {
    const q = query(collection(db, "communityQuestions"), orderBy("createdAt", "desc"), limit(100));
    const snap = await getDocs(q);
    return snap.docs.map((d) => d.data()).filter((x) => x.theme && x.text);
  } catch {
    return [];
  }
}

export async function submitCommunityQuestion(entry) {
  if (!db) return false;
  await addDoc(collection(db, "communityQuestions"), {
    theme: entry.theme,
    text: entry.text,
    options: entry.options,
    correct: entry.correct ?? 0,
    type: entry.type || "choice",
    correctText: entry.correctText || "",
    author: entry.author || "Anonyme",
    createdAt: Date.now(),
  });
  return true;
}

export function computeQuizStats(quiz, scores) {
  const total = scores.length;
  const avg = total ? scores.reduce((s, x) => s + x.score / x.total, 0) / total : 0;
  const missed = {};

  if (quiz?.questions) {
    quiz.questions.forEach((q, qi) => {
      missed[qi] = 0;
    });
    scores.forEach((entry) => {
      if (!Array.isArray(entry.answers)) return;
      entry.answers.forEach((ans, qi) => {
        const q = quiz.questions[qi];
        if (!q) return;
        const ok = q.type === "text"
          ? normalizeText(ans?.text) === normalizeText(q.correctText || q.options[q.correct])
          : ans === q.correct;
        if (!ok) missed[qi] = (missed[qi] || 0) + 1;
      });
    });
  }

  let hardest = null;
  let maxMiss = 0;
  Object.entries(missed).forEach(([qi, count]) => {
    if (count > maxMiss && quiz?.questions[qi]) {
      maxMiss = count;
      hardest = { index: parseInt(qi, 10), question: quiz.questions[qi], count };
    }
  });

  return {
    totalPlays: total,
    avgPercent: Math.round(avg * 100),
    hardest,
  };
}

function normalizeText(str) {
  return String(str || "")
    .trim()
    .toLowerCase()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "");
}
