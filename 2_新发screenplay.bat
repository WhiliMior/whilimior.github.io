@echo off
set /p title=type in your title: 
hugo new content/screenplays/%title%.en.md
hugo new content/screenplays/%title%.zh-cn.md
explorer /select,"content\screenplays\%title%.zh-cn.md"
pause