@echo off
chcp 65001 >nul
title QuizMoi - Es-tu vraiment mon ami ?
cd /d "%~dp0"

echo.
echo  ============================================
echo   QuizMoi - Lancement
echo  ============================================
echo.

echo [1/2] Generation des icones...
python generate-icons.py

echo [2/2] Demarrage du serveur...
for /f "tokens=5" %%a in ('netstat -ano ^| findstr ":8766 " ^| findstr "LISTENING"') do (
    taskkill /F /PID %%a >nul 2>&1
)
timeout /t 1 /nobreak >nul

start "Serveur QuizMoi" /MIN cmd /c "cd /d "%~dp0" && python -m http.server 8766"
timeout /t 2 /nobreak >nul

start "" "http://localhost:8766/"

echo  Site lance : http://localhost:8766/
echo.
echo  Cree ton quiz, copie le lien, envoie-le a tes amis !
echo  NE FERMEZ PAS la fenetre "Serveur QuizMoi" (minimisee).
echo.
pause
