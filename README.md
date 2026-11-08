# 我的 Hugo 博客

这是一个使用 [FixIt](https://github.com/hugo-fixit/FixIt) 主题构建的现代化静态网站，支持多语言、评论系统和丰富的交互功能。

## ✨ 特性

- 🌍 **多语言支持** - 英语和简体中文双语切换
- 💬 **评论系统** - 基于 Giscus 的 GitHub Discussions 集成
- 🔍 **搜索功能** - 使用 Pagefind 实现中英文全文搜索
- 🌙 **主题切换** - 自动/亮色/暗黑模式
- 📱 **响应式设计** - 完美适配桌面和移动设备
- 📊 **访问统计** - 不蒜子页面浏览量统计
- 📄 **PDF 嵌入** - 支持 PDF 文件内嵌显示
- 🎬 **剧本展示** - 专门的剧本内容板块
- 🍞 **面包屑导航** - 清晰的页面层级导航
- 📖 **阅读进度** - 顶部阅读进度条指示器

## 🛠️ 本地开发

### 环境要求

- Hugo Extended 版本 >= 0.155.2
- Node.js >= 20 (仅用于主题开发，可选)

### 检查 Hugo 版本

```bash
hugo version
```

### 安装 Hugo

**Windows:**
```bash
choco install hugo-extended
```

**macOS:**
```bash
brew install hugo
```

**Linux:**
```bash
snap install hugo
```

### 启动本地服务器

```bash
# 启动开发服务器
hugo server --disableFastRender

# 包含草稿
hugo server --disableFastRender -D

# 指定端口
hugo server --disableFastRender --port 1314
```

网站将在 http://localhost:1313 上运行，支持热重载。

### 构建生产版本

```bash
# 标准构建
hugo

# 清理缓存并构建（推荐）
hugo --gc --minify

# 构建并清理输出目录
hugo --gc --minify --cleanDestinationDir
```

生成的静态文件将输出到 `public/` 目录。

## 📁 项目结构

```
myblog/
├── content/              # Markdown 内容文件
│   ├── posts/           # 文章
│   ├── screenplays/     # 剧本
│   └── about/           # 关于页面
├── static/               # 静态资源 (图片、PDF、CSS、JS)
│   ├── js/             # 自定义 JavaScript
│   ├── svg/            # SVG 图标
│   ├── screenplays/     # 剧本资源
│   └── twine/           # Twine 交互内容
├── themes/               # 主题文件
│   ├── FixIt/          # FixIt 主题 v0.4.2
├── layouts/              # 自定义布局覆盖
│   ├── _default/       # 默认布局
│   ├── partials/       # 部分模板
│   ├── shortcodes/     # 短代码
│   └── rss.xml         # RSS 配置
├── assets/               # 资源文件 (SCSS, JS)
├── i18n/                 # 多语言翻译文件
├── data/                 # 数据文件
├── archetypes/           # 内容模板
├── hugo.toml            # 站点配置文件
├── README.md            # 项目说明文档
└── public/              # 构建输出目录 (不需要提交到 Git)
```

## 🎨 主题特性

### FixIt v0.4.2 核心功能

- **多语言支持** - 英语和简体中文双语
- **评论系统** - Giscus 集成，基于 GitHub Discussions
- **搜索功能** - Pagefind 中英文全文搜索，支持摘要高亮
- **PDF 嵌入** - 使用自托管 PDF.js 完整阅读器
- **主题切换** - 自动/亮色/暗黑三种模式
- **响应式设计** - 移动优先的现代化 UI

### 已启用的扩展功能

- **不蒜子统计** - 页面浏览量统计
- **Pace 进度条** - 页面加载进度指示
- **阅读进度条** - 文章阅读进度跟踪
- **面包屑导航** - 清晰的层级导航
- **分页功能** - 文章列表分页
- **Typeit 打字机** - 动态打字效果
- **社交链接** - 多平台社交账号展示
- **RSS 订阅** - 支持 RSS 输出

## 🚀 部署

### GitHub Pages 自动部署

此项目配置了 GitHub Actions 自动部署到 GitHub Pages:

1. 将代码推送到 `main` 分支
2. GitHub Actions 会自动构建并部署
3. 访问 https://whilimior.github.io/ 查看网站

### 手动部署

```bash
# 构建网站
hugo --gc --minify

# 将 public/ 目录内容部署到你的服务器
```

## ⚙️ 配置说明

### 主配置文件

主要配置在 `hugo.toml` 文件中：

| 配置项 | 说明 |
|-------|------|
| `baseURL` | 网站的基础 URL |
| `theme` | 使用的主题列表 |
| `defaultTheme` | 默认主题模式 |
| `languageCode` | 默认语言代码 |
| `languages` | 多语言配置 |

### 多语言配置

```toml
[languages.en]
  title = "Holzwege"
  languageName = "English"
  weight = 1

[languages.zh-cn]
  title = "林中路"
  languageName = "简体中文"
  weight = 2
```

### 输出格式

```toml
[outputs]
  home = ["html", "rss", "archives", "offline"]
  page = ["html"]
```

## 📝 添加新内容

> 内容源已迁移到相邻的私有仓库 `../blog-content/content/`。本仓库 `content/` 是自动生成的公开发布副本，请勿在这里写文章或放原图。以下目录结构以私有仓库为准；新建正文可复制现有文章头部。

Cat Atlas 的独立页面源文件、图片、视频和动画位于私有仓库 `../blog-content/projects/cat-atlas/`；本仓库 `static/cat-atlas/` 是自动生成副本。修改项目内容后推送私有仓库即可自动发布。博客预览卡片和通用构建脚本仍在本仓库维护。

私有仓库推送后会根据图片同目录的 `watermark.yaml` 处理图片，检查候选网站，再同步发布内容并触发本仓库构建。没有配置文件的图片不加水印；配置支持上下左中右六个位置的文字或 Logo。草稿和未来日期文章不会同步。运行 `9_StartHugoServer.bat` 可预览私有仓库中的修改（含草稿），使用相同配置。配置写法见私有仓库 `WATERMARKS.md`。

### 添加新文章

```bash
# 英文文章
hugo new content/posts/my-post/index.en.md

# 中文文章
hugo new content/posts/my-post/index.zh-cn.md
```

每篇文章使用独立文件夹（Hugo leaf bundle），中英文正文与素材放在一起：

```text
content/posts/my-post/
├── index.en.md
├── index.zh-cn.md
└── images/
    └── cover.jpg
```

在正文中用 `![图片说明](images/cover.jpg)` 引用同目录素材，中英文可以共用图片。保留正文头部的 `slug`，以保持现有文章网址不变。`content/posts/_index.*.md` 是文章列表页，应保留在上一级目录。

### 添加新剧本

```bash
# 英文剧本
hugo new content/screenplays/my-screenplay/index.en.md

# 中文剧本
hugo new content/screenplays/my-screenplay/index.zh-cn.md
```

### 添加新笔记

```bash
hugo new content/notes/my-note/index.en.md
hugo new content/notes/my-note/index.zh-cn.md
```

剧本和笔记同样采用每篇一个文件夹的结构，素材放入该文件夹，通过相对路径引用；各栏目的 `_index.*.md` 保留在栏目根目录。

### 文章 Front Matter 示例

```yaml
---
title: 文章标题
subtitle: 副标题
date: 2024-01-01T00:00:00+08:00
draft: false
author:
  name: 作者名
description: 文章描述
keywords: ["关键词1", "关键词2"]
tags:
  - 标签1
  - 标签2
categories:
  - 分类
hiddenFromHomePage: false
hiddenFromSearch: false
comment: true
---
```

## 🔧 故障排除

### 构建错误

如果遇到构建错误：

```bash
# 1. 清理缓存
hugo --cleanDestinationDir

# 2. 删除缓存目录
rm -rf resources/ public/

# 3. 重新构建
hugo --gc --minify
```

### 常见问题

**Q: 分类页面显示空白？**
A: FixIt 0.4.2 已修复此问题，确保使用最新版本主题。

**Q: 评论系统不显示？**
A: 检查 Giscus 配置是否正确，确保仓库设置了 Discussions。

**Q: 搜索功能不工作？**
A: 确认已在 Hugo 构建后运行 `npm run search:index`，并通过 HTTP 服务访问构建目录。

**Q: PDF 无法显示？**
A: 确认 static/pdfjs/ 资源完整，并通过 HTTP 服务访问网站。

## 📚 更多资源

- [Hugo 官方文档](https://gohugo.io/documentation/)
- [FixIt 主题文档](https://fixit.lruihao.cn/)
- [Hugo 主题市场](https://themes.gohugo.io/)

## 📄 许可证

本作品采用 [知识共享署名-非商业性使用 4.0 国际许可协议](https://creativecommons.org/licenses/by-nc/4.0/) 进行许可。

---

**网站**: https://whilimior.github.io/  
**主题**: [FixIt](https://github.com/hugo-fixit/FixIt) v0.4.2  
**Hugo**: v0.155.2+

## PDF 阅读器

PDF.js 6.5.438 完整阅读器自托管于 `static/pdfjs/`，保留上游 Apache-2.0 许可。
来源：https://github.com/mozilla/pdf.js/releases/tag/v6.5.438

沿用 `{{< embed-pdf url="/screenplays/example.pdf" >}}`；文件路径会进行 URL 编码。
支持搜索、文字选择、连续滚动、缩放、缩略图及 PDF 自带目录；提供独立阅读、原文件及下载入口。
搜索和复制要求 PDF 包含文本层，目录要求 PDF 包含书签。无需 API 密钥或外部 CDN。

更新时从 Mozilla 官方 Release 下载完整 dist 包，替换 static/pdfjs/，保留 LICENSE 和字体/CMap/worker 等资源。
删除上游示例 compressed.tracemonkey-pldi-09.pdf；使用实际站内 PDF 验证渲染、翻页、搜索、缩放和移动端布局。

## 站内搜索（Pagefind）

依赖 Node.js 22，使用锁文件安装：`npm ci`。
每次 Hugo 构建后运行 `npm run search:index`，随后通过 HTTP 服务访问 `public/`。
例如：`npm run build`，然后 `python -m http.server --directory public 8080`。
`hugo server` 不会自动重建 Pagefind 索引，内容更新后需重新构建索引；验证搜索请使用上述静态构建流程。
GitHub Actions 已在上传 Pages 产物前执行索引生成。

搜索入口为 `/search/` 和 `/zh-cn/search/`，按页面语言检索。只索引公开文章正文及标题、标签、分类，排除导航、页脚、PDF 阅读器和隐藏/加密页面。
PDF 文件内部文字不会自动进入索引。Pagefind 资源在本站托管，无需密钥或后台服务。

中文长句和专有名词的分词可能有局限，建议用空格分隔关键词。普通查询支持词项扩展匹配，若需要精确短语可使用英文双引号。

## Cat Atlas 项目页

`/cat-atlas/` 是中文独立静态宣传页，英文版位于 `/cat-atlas/en/`，源文件在 `static/cat-atlas/`。图片、字体、动画帧和宣传片均为本站资源，不依赖外部服务。
首页通过 `cat-atlas-preview` 短代码展示专属预览卡片，文案分别位于中英文首页，样式在 `static/css/cat-atlas-preview.css`。
首页项目入口仅在第一页展示。中英文项目页含返回对应博客和语言切换入口，正文分别加入 Pagefind 中英文索引。英文页面复用同一组媒体文件；共享脚本根据当前语言切换小猫回应和加载提示。

Windows 游戏包已发布：[下载 ZIP（115.92 MiB）](https://github.com/WhiliMior/CatAtlas-Releases/releases/download/cat-atlas-windows-20261107/CatAtlas-Windows.zip)。中英文页面共用该包体；开发仓库 `WhiliMior/CatAtlas` 保持私有。
后续版本的 Release 上传并验证后，在 `static/cat-atlas/config.js` 中更新 `downloadUrl` / `downloadName` / `downloadSize`。中英文页面会自动切换为可下载按钮，并显示包体大小和解压运行提示；地址留空时继续显示准备中。
游戏包体由独立的 `WhiliMior/CatAtlas-Releases` 仓库通过 GitHub Releases 托管，不在网站仓库创建游戏 Release，也不将包体写入网站 Git 历史。宣传片按点击加载。
字体许可和地图来源说明保留在 `static/cat-atlas/assets/` 下。

英文页面独立文案在 `static/cat-atlas/en/index.html`，两个版本的响应式补充样式位于 `static/cat-atlas/integration.css`。

### Windows 包体发布

已验证的上传包体：121,554,145 字节（115.92 MiB），Windows x64。
SHA-256：`ae54c340b146b0e0078e26b7c5d7245661515f9c0cb15843c7b485414b425848`。
包体不放入 Git；它包含 EXE、PCK、两个 JSON 配置文件及许可证目录，应完整解压到同一目录。

发布工具位于独立 CatAtlas-Releases 发行仓库：`bash scripts/publish-release.sh /path/CatAtlas-Windows.zip --verify-only`，可在本地验证 CRC、结构和 SHA-256。
使用 `--publish` 会通过现有 GitHub CLI 身份在 `WhiliMior/CatAtlas-Releases` 创建 `cat-atlas-windows-20261107` 草稿 Release，上传 ZIP 和校验文件，回读校验后发布并检查公开下载地址。不会覆盖已有同名 Release。
脚本需要 GitHub Releases 写权限，并允许访问 `api.github.com`、`uploads.github.com`、`github.com` 及其 Release 下载域名。
只有实际发布并验证下载后，才填写网页的正式 `downloadUrl`。Windows 运行行为须在 Windows 上另行验证。

### 中英文宣传片

`static/cat-atlas/config.js` 的 `trailerUrls` 可分别指定 `zh-CN` 和 `en` 视频路径，均相对于 `static/cat-atlas/` 解析。未指定的语言会继续使用 `trailerUrl`，避免替换期间出现空白播放器。
收到新视频并验证文件后，再填写 `trailerUrls`；同时更新对应语言 HTML 的 `<noscript>` 视频链接。新版中英文宣传片已接入：各 45.013 秒，1080p / 30fps、H.264 / AAC，并启用 faststart。中文约 19.56 MiB、英文约 19.42 MiB，保留原始画面尺寸，按点击加载；无 JavaScript 时也可打开对应语言视频。旧共享视频已从站点资源中移除。

### 上线前与发布

项目页已补充分享元信息与 sitemap；键盘跳转、减少动画、视频失败回退及手机横屏关闭按钮均有支持。
当前 `downloadUrl` 已指向公开的 CatAtlas-Releases 附件，完整公开下载的字节数、SHA-256 与 ZIP CRC 均已验证。
正式 Release 验证后填写 `downloadUrl`，运行 `npm run build`：Hugo 构建、静态下载状态渲染、Pagefind 索引依次执行。渲染步骤只更新 `public/`，同步生成两种语言的原生下载链接、文案和安装提示，保证无脚本环境可下载，也保证搜索索引包含正式发布状态。GitHub Actions 使用相同顺序。
发布顺序：先在独立 CatAtlas-Releases 发行仓库发布并验证附件，再配置网站下载地址，完成构建后部署博客。脚本不会自动覆盖同名 Release。
