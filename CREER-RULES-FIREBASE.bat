@echo off
chcp 65001 >nul
title QuizMoi — Créer les règles Firestore
cd /d "%~dp0"

echo.
echo  ========================================
echo   Déploiement des règles Firestore
echo  ========================================
echo.
echo  Une fenêtre va s'ouvrir pour te connecter à Google.
echo  Choisis le compte qui possède le projet quizmoi-dc07d.
echo.

npx firebase login
if errorlevel 1 goto fail

echo.
echo  Publication des règles…
npx firebase deploy --only firestore:rules --project quizmoi-dc07d
if errorlevel 1 goto fail

echo.
echo  OK — règles publiées sur Firebase.
echo  Lance maintenant LANCER-IMPORT-FIREBASE.bat pour importer les données.
goto end

:fail
echo.
echo  Echec. Colle manuellement firestore.rules ici :
start "" "https://console.firebase.google.com/project/quizmoi-dc07d/firestore/rules"
notepad firestore.rules

:end
echo.
pause
