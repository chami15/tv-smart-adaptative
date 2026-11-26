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

if not exist node_modules (
  echo Instalando dependencias pela primeira vez, aguarde...
  call npm install
  if errorlevel 1 (
    echo Falha ao instalar dependencias.
    pause
    exit /b 1
  )
)

call npm start
pause
