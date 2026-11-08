@echo off
chcp 65001 >nul
cd /d "%~dp0"
node scripts/new-content.mjs
if errorlevel 1 (
  echo 创建失败，请检查私有仓库路径和 Node.js。
)
pause
