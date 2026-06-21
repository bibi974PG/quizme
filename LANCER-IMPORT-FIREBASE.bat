@echo off
chcp 65001 >nul
title QuizMoi — Import Firebase

echo.
echo  ========================================
echo   Import des thèmes/questions Firebase
echo  ========================================
echo.
echo  1. Ouvre la console Firebase (règles Firestore)
echo  2. Colle le contenu du fichier firestore.rules
echo  3. Publie les règles
echo  4. Reviens ici et appuie sur une touche
echo.
start "" "https://console.firebase.google.com/project/quizmoi-dc07d/firestore/rules"
pause

echo.
echo  Lancement de l'import Node…
cd /d "%~dp0"
call npm run seed
if errorlevel 1 (
  echo.
  echo  Echec Node. Essaie import-firebase.html dans le navigateur.
  start "" "%~dp0import-firebase.html"
)
echo.
pause
