@echo off
chcp 65001 >nul
setlocal enabledelayedexpansion

:: ==========================================
:: Hugo 博客一键推送脚本
:: 功能：添加 content、构建 Hugo、提交并推送到 GitHub
:: ==========================================

set "PROJECT_DIR=C:\Users\zhuolong.li\OneDrive\Projects\Blog_hugo\myblog"
set "BRANCH=main"

echo.
echo ========================================
echo     Hugo 博客一键推送工具
echo ========================================
echo.

:: 切换到项目目录
cd /d "%PROJECT_DIR%"
if errorlevel 1 (
    echo [错误] 无法切换到项目目录: %PROJECT_DIR%
    pause
    exit /b 1
)

echo [1/5] 检查 Git 状态...
git status --short
if errorlevel 1 (
    echo [错误] Git 状态检查失败
    pause
    exit /b 1
)
echo.

:: 提示用户输入提交信息
echo [2/5] 请输入提交信息（默认：Update content）：
set /p COMMIT_MSG=
if "!COMMIT_MSG!"=="" set "COMMIT_MSG=Update content"
echo.

echo [3/5] 添加所有更改（包括 content）...
git add .
if errorlevel 1 (
    echo [错误] Git add 失败
    pause
    exit /b 1
)
echo.

echo [4/5] 创建提交...
git commit -m "!COMMIT_MSG!"
if errorlevel 1 (
    echo [警告] 没有更改需要提交，或提交失败
    echo.
    set /p CONTINUE="是否继续推送？(y/n): "
    if /i not "!CONTINUE!"=="y" (
        echo 取消推送
        pause
        exit /b 0
    )
) else (
    echo 提交成功！
)
echo.

echo [5/5] 推送到 GitHub (分支: %BRANCH%)...
git push origin %BRANCH%
if errorlevel 1 (
    echo.
    echo [错误] 推送失败！
    echo.
    echo 可能的解决方案：
    echo 1. 检查网络连接
    echo 2. 尝试设置代理
    echo 3. 使用 SSH 方式推送
    echo.
    echo 重试推送（使用 --force 选项）？(y/n):
    set /p RETRY=
    if /i "!RETRY!"=="y" (
        echo.
        echo 尝试强制推送...
        git push origin %BRANCH% --force
        if errorlevel 1 (
            echo [错误] 强制推送仍然失败
            pause
            exit /b 1
        )
    ) else (
        pause
        exit /b 1
    )
)

echo.
echo ========================================
echo     推送成功！
echo ========================================
echo.
echo 博客已更新到: https://whilimior.github.io/
echo.

pause
