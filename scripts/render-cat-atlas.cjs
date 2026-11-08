#!/usr/bin/env node
'use strict';

// Render the configured release into built HTML as well as the interactive UI.
// This keeps links, installation guidance and the search index usable without JS.
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const crypto = require('node:crypto');

const output = path.resolve(process.argv[2] || 'public');
const project = path.join(output, 'cat-atlas');
const window = {};
const configSource = fs.readFileSync(path.join(project, 'config.js'), 'utf8');
const configVersion = crypto.createHash('sha256').update(configSource).digest('hex').slice(0, 12);
vm.runInNewContext(configSource, { window }, { timeout: 1000 });
const config = window.CAT_ATLAS_CONFIG || {};
const configuredUrl = typeof config.downloadUrl === 'string' ? config.downloadUrl.trim() : '';
if (!configuredUrl) {
  console.log('Cat Atlas: no published release configured; preparation state preserved.');
  process.exit(0);
}

const chinesePath = path.join(project, 'index.html');
const chinese = fs.readFileSync(chinesePath, 'utf8');
const canonical = chinese.match(/<link\b(?=[^>]*\brel=["']canonical["'])[^>]*\bhref=["']([^"']+)["']/i);
if (!canonical) throw new Error('Cat Atlas canonical URL is required to resolve release links.');
const base = new URL(canonical[1]);
let release;
try { release = new URL(configuredUrl, base); } catch { throw new Error('Cat Atlas downloadUrl is invalid.'); }
if (!['http:', 'https:'].includes(release.protocol) || release.username || release.password) {
  throw new Error('Cat Atlas downloadUrl must be HTTP(S) and contain no credentials.');
}
const sameOrigin = release.origin === base.origin;
const href = sameOrigin ? release.pathname + release.search + release.hash : release.href;
const escape = value => String(value).replace(/[&<>"']/g, character => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[character]);
const stripAttribute = (attributes, name) => attributes.replace(new RegExp(`\\s+${name}(?=\\s|=|$)(?:\\s*=\\s*(?:"[^"]*"|'[^']*'|[^\\s>]+))?`, 'gi'), '');
const attribute = (attributes, name, value) => stripAttribute(attributes, name) + ` ${name}="${escape(value)}"`;
const copy = {
  zh: {
    hero: '下载游戏', bottom: '下载 Windows 版', heading: '让小猫从今天开始陪你。',
    install: '下载后解压全部文件到同一文件夹，运行 CatAtlas.exe。',
  },
  en: {
    hero: 'Download game', bottom: 'Download for Windows', heading: 'Your little companion is ready.',
    install: 'Extract all files into the same folder, then run CatAtlas.exe.',
  },
};
const size = typeof config.downloadSize === 'string' ? config.downloadSize.trim() : '';
const platform = ['Windows', size].filter(Boolean).join(' · ');
const name = typeof config.downloadName === 'string' && config.downloadName ? config.downloadName : 'CatAtlas-Windows.zip';

for (const [language, file] of [['zh', chinesePath], ['en', path.join(project, 'en', 'index.html')]]) {
  let html = fs.readFileSync(file, 'utf8');
  let links = 0;
  html = html.replace(/<a\b([^>]*\bdata-download\b[^>]*)>([\s\S]*?)<\/a>/gi, (match, attributes, content) => {
    links++;
    attributes = attribute(attributes, 'href', href);
    attributes = stripAttribute(stripAttribute(stripAttribute(attributes, 'download'), 'target'), 'rel');
    if (sameOrigin) attributes = attribute(attributes, 'download', name);
    else attributes = attribute(attribute(attributes, 'target', '_blank'), 'rel', 'noopener noreferrer');
    const label = /\bhero-download\b/.test(attributes) ? copy[language].hero : copy[language].bottom;
    if (!/<span\b[^>]*\bdata-download-label\b/.test(content)) throw new Error(`Cat Atlas ${language} download label is missing.`);
    content = content.replace(/(<span\b[^>]*\bdata-download-label\b[^>]*>)[\s\S]*?(<\/span>)/i, `$1${escape(label)}$2`);
    return `<a${attributes}>${content}</a>`;
  });
  if (links !== 2) throw new Error(`Expected two ${language} download links; found ${links}.`);
  let heading = 0, platforms = 0, instructions = 0;
  html = html.replace(/(<h2\b[^>]*\bid=["']download-title["'][^>]*>)[\s\S]*?(<\/h2>)/i, (_, start, end) => { heading++; return start + escape(copy[language].heading) + end; });
  html = html.replace(/(<span\b[^>]*\bdata-download-platform\b[^>]*>)[\s\S]*?(<\/span>)/i, (_, start, end) => { platforms++; return start + escape(platform) + end; });
  html = html.replace(/<p\b([^>]*\bid=["']download-instructions["'][^>]*)>[\s\S]*?<\/p>/i, (_, attributes) => { instructions++; return `<p${stripAttribute(attributes, 'hidden')}>${escape(copy[language].install)}</p>`; });
  if (heading !== 1 || platforms !== 1 || instructions !== 1) throw new Error(`Cat Atlas ${language} download structure changed.`);
  // Do not let a cached preparation config disable newly published download links.
  html = html.replace(/(<script\b[^>]*\bsrc=["'])([^"']*config\.js)(?:\?[^"']*)?(["'][^>]*>)/i, (_, start, source, end) => `${start}${source}?v=${configVersion}${end}`);
  fs.writeFileSync(file, html);
}
console.log('Cat Atlas: rendered published release links and installation guidance for both languages.');
