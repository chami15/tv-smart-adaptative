@echo off
chcp 65001 >nul
title TV Smart Adaptative - Studio
cd /d "%~dp0"

where node >nul 2>nul
if errorlevel 1 (
  echo.
  echo  O Node.js nao foi encontrado.
  echo  Instale a versao LTS 22 ou mais nova em https://nodejs.org e abra este arquivo de novo.
  echo.
  pause
  exit /b 1
)

rem O "npm start" confere e instala sozinho o que faltar (sem alterar o package-lock.json).
call npm start
pause
