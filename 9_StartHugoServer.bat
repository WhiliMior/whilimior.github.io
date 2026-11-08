@echo off
chcp 65001 > nul
cd /d "%~dp0"

echo ========================================
echo Hugo Blog 构建脚本
echo ========================================
echo.
where node >nul 2>nul
if errorlevel 1 (
    echo 未找到 Node.js，请安装 Node.js 22 或更新版本。
    pause
    exit /b 1
)

echo [1/2] 检查 Hugo...
where hugo >nul 2>nul
if errorlevel 1 (
    echo 未找到 Hugo，请先安装 Hugo Extended 并重新打开终端。
    pause
    exit /b 1
)
echo.

echo [2/2] 启动本地预览（包含草稿和未来日期文章）...
echo 请先停止其他 Hugo 预览窗口，避免 1313 端口被占用。
echo 预览地址：http://localhost:1313/zh-cn/
echo 从相邻 blog-content 私有仓库读取文章和 Cat Atlas，按文件夹配置生成预览。
echo 按 Ctrl+C 停止服务器
echo ========================================
node scripts/preview-content.mjs
if errorlevel 1 (
    echo 预览服务启动或运行失败，请检查上方错误信息。
    pause
    exit /b 1
)
