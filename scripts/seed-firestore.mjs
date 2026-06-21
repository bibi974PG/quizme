import { initializeApp } from "firebase/app";
import { getFirestore, doc, setDoc } from "firebase/firestore";
import { firebaseConfig } from "../firebase-config.js";
import { DEFAULT_COUNT, DEFAULT_THEMES, THEMES, QUESTION_BANK, QUIZ_TEMPLATES, GAMER_QUIZZES } from "../content-data.js";

const app = initializeApp(firebaseConfig);
const db = getFirestore(app);

const questionCount = Object.values(QUESTION_BANK).reduce((n, list) => n + list.length, 0);

await setDoc(doc(db, "content", "app"), {
  version: 1,
  defaultCount: DEFAULT_COUNT,
  defaultThemes: DEFAULT_THEMES,
  quizTemplates: QUIZ_TEMPLATES,
  gamerQuizzes: GAMER_QUIZZES,
  themes: THEMES,
  questionBank: QUESTION_BANK,
  themeCount: THEMES.length,
  questionCount,
  updatedAt: Date.now(),
});

console.log(`Firestore content/app : ${THEMES.length} thèmes, ${questionCount} questions.`);
