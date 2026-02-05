@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ========================================
echo Hugo Blog 构建脚本
echo ========================================
echo.

echo [1/3] 清理旧的构建文件...
if exist "public" rmdir /s /q "public"
echo √ 清理完成
echo.

echo [2/3] 开始构建网站...
hugo
if errorlevel 1 (
    echo ✗ 构建失败！
    pause
    exit /b 1
)
echo √ 构建成功！
echo.

echo [3/3] 在浏览器中打开网站...
start http://localhost:1313
hugo server -D --buildDrafts --buildFuture

echo.
echo ========================================
echo 按 Ctrl+C 停止服务器
echo ========================================
