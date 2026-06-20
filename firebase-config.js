/**
 * Configuration Firebase — QuizMoi
 *
 * 1. Va sur https://console.firebase.google.com
 * 2. Crée un projet → Firestore Database → mode test
 * 3. Ajoute une app Web → copie les valeurs ci-dessous
 * 4. Firestore → Règles → colle les règles du commentaire en bas
 */

export const firebaseConfig = {
  apiKey: "AIzaSyCHucrc7QPtSc9d0B0dHKP7ihX-LWGPC_4",
  authDomain: "quizmoi-dc07d.firebaseapp.com",
  projectId: "quizmoi-dc07d",
  storageBucket: "quizmoi-dc07d.firebasestorage.app",
  messagingSenderId: "772235620824",
  appId: "1:772235620824:web:57f15d41c742a93d6f42ad",
  measurementId: "G-S55H8L4BVB",
};

export function isFirebaseConfigured() {
  const { apiKey, projectId } = firebaseConfig;
  if (!apiKey || !projectId) return false;
  if (apiKey.startsWith("VOTRE")) return false;
  if (projectId.startsWith("VOTRE")) return false;
  return true;
}

/*
  Règles Firestore (mode test — à affiner plus tard) :

  rules_version = '2';
  service cloud.firestore {
    match /databases/{database}/documents {
      match /quizzes/{quizId} {
        allow read: if true;
        allow write: if true;
      }
      match /scores/{scoreId} {
        allow read: if true;
        allow create: if true;
        allow update, delete: if false;
      }
    }
  }
*/
