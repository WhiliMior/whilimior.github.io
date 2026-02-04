@echo off
set /p title=type in your title: 
hugo new content/posts/%title%.en.md
hugo new content/posts/%title%.zh-cn.md
explorer /select,"content\posts\%title%.zh-cn.md"
pause