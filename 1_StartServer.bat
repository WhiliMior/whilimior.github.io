@echo off
chcp 65001 >nul
REM ============================================
REM 可用选项配置 - 添加新类型时在此处扩展
REM ============================================
set "OPTIONS=1:posts 2:notes 3:screenplays"
set "OPTION_COUNT=3"

REM ============================================
REM 显示菜单 - 使用 call 和 shift 遍历所有选项
REM ============================================
echo 可用类型:
call :show_options %OPTIONS%

REM ============================================
REM 用户选择类型
REM ============================================
set /p choice=请选择类型 (1-%OPTION_COUNT%): 

REM ============================================
REM 验证选择并获取对应路径
REM ============================================
set "type_path="
call :get_type_path %choice% %OPTIONS%

if "%type_path%"=="" (
    echo 无效的选择！
    pause
    exit /b 1
)

REM ============================================
REM 输入标题并创建文件
REM ============================================
set /p title=请输入标题: 

REM 先创建中文文件
hugo new content/%type_path%/%title%.zh-cn.md
if errorlevel 1 (
    echo 创建文件失败！
    pause
    exit /b 1
)

REM 获取刚创建文件的路径，复制为英文版本
set "src_file=content/%type_path%/%title%.zh-cn.md"
set "dst_file=content/%type_path%/%title%.en.md"

REM 从中文文件中提取 slug
for /f "tokens=2 delims=: " %%a in ('powershell -Command "Select-String -Path '%src_file%' -Pattern '^slug:'"') do set "slug_value=%%a"
set "slug_value=%slug_value: =%"

REM 复制文件并替换语言字段，同时保持 slug 不变
powershell -Command "$content = Get-Content '%src_file%'; $content -replace 'zh-cn', 'en' | Set-Content '%dst_file%'"

echo 中文文件: %src_file%
echo 英文文件: %dst_file%
echo 统一 slug: %slug_value%

explorer /select,"content\%type_path%\%title%.zh-cn.md"

echo 创建完成！
pause
exit /b

REM ============================================
REM 子程序：显示所有选项
REM ============================================
:show_options
if "%~1"=="" exit /b
for /f "tokens=1,2 delims=:" %%a in ("%~1") do (
    echo   %%a - %%b
)
shift
goto show_options

REM ============================================
REM 子程序：根据选择获取类型路径
REM ============================================
:get_type_path
set "target_choice=%~1"
shift
:loop
if "%~1"=="" exit /b
for /f "tokens=1,2 delims=:" %%a in ("%~1") do (
    if "%%a"=="%target_choice%" (
        set "type_path=%%b"
        exit /b
    )
)
shift
goto loop
