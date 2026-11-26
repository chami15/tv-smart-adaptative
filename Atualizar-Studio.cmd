@echo off
chcp 65001 >nul
title TV Smart Adaptative - Atualizar
cd /d "%~dp0"

where git >nul 2>nul
if errorlevel 1 (
  echo  O Git nao foi encontrado. Baixe o projeto de novo pelo GitHub ^(Code - Download ZIP^).
  pause
  exit /b 1
)

echo Feche a janela do Studio antes de continuar, se ela estiver aberta.
pause

rem O npm as vezes reescreve o package-lock.json sozinho; essa mudanca nao e sua e pode ser descartada.
git checkout -- package-lock.json 2>nul

git pull
if errorlevel 1 (
  echo.
  echo  Nao foi possivel atualizar. Se voce alterou arquivos do projeto, o Git mostrou quais acima.
  pause
  exit /b 1
)

call npm ci --no-audit --no-fund
if errorlevel 1 (
  echo  Falha ao instalar as dependencias. Verifique a internet e tente de novo.
  pause
  exit /b 1
)

echo.
echo  Atualizado! Agora abra o Iniciar-Studio.
pause
