import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.0/firebase-app.js";
import {
  getFirestore,
  collection,
  addDoc,
  getDocs,
  query,
  where,
  limit,
  doc,
  setDoc,
  getDoc,
} from "https://www.gstatic.com/firebasejs/11.6.0/firebase-firestore.js";
import { firebaseConfig, isFirebaseConfigured } from "./firebase-config.js";

let db = null;

export async function initFirebase() {
  if (!isFirebaseConfigured()) return false;
  try {
    const app = initializeApp(firebaseConfig);
    db = getFirestore(app);
    return true;
  } catch {
    return false;
  }
}

export function isOnlineDb() {
  return db !== null;
}

export async function saveQuizRemote(id, quiz, encoded) {
  if (!db) return false;
  await setDoc(
    doc(db, "quizzes", id),
    {
      creator: quiz.creator,
      questionCount: quiz.questions.length,
      encoded,
      createdAt: Date.now(),
    },
    { merge: true }
  );
  return true;
}

export async function loadQuizRemote(id) {
  if (!db) return null;
  const snap = await getDoc(doc(db, "quizzes", id));
  if (!snap.exists()) return null;
  return snap.data();
}

export async function saveScoreRemote(quizId, entry) {
  if (!db) return false;
  await addDoc(collection(db, "scores"), {
    quizId,
    name: entry.name,
    score: entry.score,
    total: entry.total,
    date: entry.date,
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
    };
  });
  list.sort((a, b) => b.score - a.score || b.date - a.date);
  return list;
}
