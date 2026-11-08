#!/usr/bin/env node
// Fail the deployment when a referenced local image is missing or an original leaks.
import fs from 'node:fs/promises';
import path from 'node:path';
import { createHash } from 'node:crypto';

const options = { public: 'public', origin: 'https://whilimior.github.io/' };
for (let i = 2; i < process.argv.length; i++) {
  const key = process.argv[i];
  if (!['--public', '--content', '--manifest', '--origin'].includes(key) || !process.argv[i + 1]) {
    throw new Error('Usage: node scripts/verify-site.mjs [--public directory] [--content directory] [--manifest file] [--origin https://site.example/]');
  }
  options[key.slice(2)] = process.argv[++i];
}
const root = path.resolve(options.public);
const contentRoot = options.content ? path.resolve(options.content) : null;
const origin = new URL(options.origin);
if (!['http:', 'https:'].includes(origin.protocol) || origin.search || origin.hash) throw new Error('Invalid site origin.');
if (!origin.pathname.endsWith('/')) origin.pathname += '/';
const failures = [];
const record = message => { if (failures.length < 100) failures.push(message); };
const relative = file => path.relative(root, file).split(path.sep).join('/');
const sha256 = bytes => createHash('sha256').update(bytes).digest('hex');
const exists = async file => { try { return (await fs.stat(file)).isFile(); } catch { return false; } };
const within = (directory, file) => { const rel = path.relative(directory, file); return rel !== '..' && !rel.startsWith(`..${path.sep}`) && !path.isAbsolute(rel); };

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory, { withFileTypes: true })) {
    const full = path.join(directory, entry.name);
    if (entry.isSymbolicLink()) {
      record(`Symbolic link in publish output: ${relative(full)}`);
      continue;
    }
    if (entry.isDirectory()) {
      if (['.git', 'branding', 'originals', 'node_modules'].includes(entry.name.toLowerCase())) record(`Private directory in publish output: ${relative(full)}`);
      files.push(...await walk(full));
    } else if (entry.isFile()) {
      if (['.ds_store', '.env', '.env.local'].includes(entry.name.toLowerCase())) record(`Private file in publish output: ${relative(full)}`);
      files.push(full);
    }
  }
  return files;
}

const files = await walk(root);
for (const entry of ['index.html', 'en/index.html', 'zh-cn/index.html']) {
  if (!await exists(path.join(root, entry))) record(`Missing site entry page: ${entry}`);
}

// Enough HTML tokenization for generated Hugo markup, including > inside quoted captions.
const tagPattern = /<(img-comparison-slider|img|source|a|script|link)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;
function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([^\s=/'"<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/g)) {
    result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  }
  return result;
}
function unescape(value) {
  return value.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([\da-f]+));/gi, (entity, decimal, hex) => {
    if (decimal || hex) {
      const number = Number.parseInt(decimal || hex, hex ? 16 : 10);
      return number <= 0x10ffff ? String.fromCodePoint(number) : entity;
    }
    return { '&amp;': '&', '&quot;': '"', '&apos;': "'", '&lt;': '<', '&gt;': '>' }[entity.toLowerCase()];
  });
}
// A srcset URL is followed by an optional width/density descriptor. Preserve commas in data URLs.
function srcsetUrls(source) {
  const urls = [];
  let remaining = source.trim();
  while (remaining) {
    remaining = remaining.replace(/^[\s,]+/, '');
    if (!remaining) break;
    const token = remaining.match(/^\S+/)[0];
    let url = token.replace(/,+$/, '');
    if (!url.startsWith('data:') && url.includes(',')) {
      url = url.split(',')[0];
      remaining = remaining.slice(url.length);
    } else {
      remaining = remaining.slice(token.length);
      if (!token.endsWith(',')) {
        const delimiter = remaining.indexOf(',');
        remaining = delimiter < 0 ? '' : remaining.slice(delimiter + 1);
      }
    }
    urls.push(url);
  }
  return urls;
}

const checked = new Set();
let imageReferences = 0;
async function checkReference(raw, htmlFile, description) {
  if (!raw) return;
  const value = unescape(raw.trim());
  if (/^(?:data:|https?:\/\/|\/\/)/i.test(value) && !value.startsWith(origin.origin)) {
    // External and inline images remain under their existing hosting arrangements.
    return;
  }
  if (value.includes('\\') || /^[a-z]:/i.test(value)) {
    record(`${relative(htmlFile)}: invalid web path in ${description}`);
    return;
  }
  const pagePath = relative(htmlFile).replace(/index\.html$/, '');
  let url;
  try { url = new URL(value, new URL(pagePath, origin)); } catch { record(`${relative(htmlFile)}: invalid ${description} URL`); return; }
  if (url.origin !== origin.origin) return;
  if (!['https:', 'http:'].includes(url.protocol)) { record(`${relative(htmlFile)}: unsupported ${description} URL`); return; }
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { record(`${relative(htmlFile)}: invalid URL encoding in ${description}`); return; }
  const basePath = decodeURIComponent(origin.pathname);
  if (!pathname.startsWith(basePath)) { record(`${relative(htmlFile)}: ${description} points outside the configured site base`); return; }
  if (pathname.includes('\\') || pathname.includes('\0')) { record(`${relative(htmlFile)}: unsafe ${description} path`); return; }
  const full = path.resolve(root, pathname.slice(basePath.length));
  if (!within(root, full)) { record(`${relative(htmlFile)}: ${description} escapes publish directory`); return; }
  if (checked.has(full)) return;
  checked.add(full);
  if (!await exists(full)) record(`${relative(htmlFile)}: missing ${description}: ${relative(full)}`);
}

const notePath = 'zh-cn/notes/my-level-design-approch/index.html';
let noteSummary = null;
for (const file of files.filter(file => file.endsWith('.html'))) {
  const html = (await fs.readFile(file, 'utf8')).replace(/<!--[\s\S]*?-->/g, '');
  const summary = { comparisons: 0, galleries: 0, compareImages: 0, scripts: [], styles: [] };
  for (const match of html.matchAll(tagPattern)) {
    const tag = match[1].toLowerCase();
    const attrs = attributes(match[2]);
    if (tag === 'img') {
      imageReferences++;
      await checkReference(attrs.src, file, 'image');
      if (attrs.slot === 'first' || attrs.slot === 'second') summary.compareImages++;
    }
    if ((tag === 'img' || tag === 'source') && attrs.srcset) {
      for (const url of srcsetUrls(unescape(attrs.srcset))) await checkReference(url, file, 'responsive image');
    }
    if (tag === 'a' && (attrs.class || '').split(/\s+/).includes('lightgallery')) {
      summary.galleries++;
      await checkReference(attrs.href, file, 'gallery image');
    }
    if (tag === 'img-comparison-slider') summary.comparisons++;
    if (tag === 'script' && attrs.src) { summary.scripts.push(attrs.src); await checkReference(attrs.src, file, 'script'); }
    if (tag === 'link' && (attrs.rel || '').split(/\s+/).includes('stylesheet') && attrs.href) {
      summary.styles.push(attrs.href);
      await checkReference(attrs.href, file, 'stylesheet');
    }
  }
  if (relative(file) === notePath) noteSummary = summary;
}

if (contentRoot && await exists(path.join(contentRoot, 'notes', 'MyLevelDesignApproch', 'index.zh-cn.md')) && !noteSummary) {
  record('Published level-design content is missing its Chinese article page');
}
if (noteSummary) {
  let expected = 4;
  let expectedGalleries = 13;
  if (contentRoot) {
    const source = path.join(contentRoot, 'notes', 'MyLevelDesignApproch', 'index.zh-cn.md');
    if (await exists(source)) {
      const markdown = await fs.readFile(source, 'utf8');
      expected = [...markdown.matchAll(/\{\{<\s*image-compare\b/g)].length;
      expectedGalleries = [...markdown.matchAll(/!\[[^\]]*\]\([^\n]+?\)|\{\{<\s*image\s/g)].length;
    }
  }
  if (noteSummary.comparisons !== expected) record(`Level-design note: expected ${expected} comparison components, found ${noteSummary.comparisons}`);
  if (noteSummary.compareImages !== expected * 2) record('Level-design note: a comparison image is missing');
  if (noteSummary.galleries < expectedGalleries) record('Level-design note: ordinary images are missing gallery previews');
  if (expected && !noteSummary.scripts.some(url => /\/lib\/img-comparison-slider\/index\.js(?:\?|$)/.test(url))) record('Level-design note: local comparison script is missing');
  if (expected && !noteSummary.styles.some(url => /\/lib\/img-comparison-slider\/styles\.css(?:\?|$)/.test(url))) record('Level-design note: comparison base styles are missing');
  if (expected && !noteSummary.styles.some(url => /\/css\/image-compare(?:\.[\da-f]+)?\.css(?:\?|$)/.test(url))) record('Level-design note: comparison layout styles are missing');
}

if (options.manifest) {
  const manifestFile = path.resolve(options.manifest);
  if (within(root, manifestFile)) record('Private processing manifest must not be inside the publish directory');
  const manifest = JSON.parse(await fs.readFile(manifestFile, 'utf8'));
  if (manifest.preview) throw new Error('Local preview content cannot be published.');
  if (![1, 2].includes(manifest.schemaVersion) || !Array.isArray(manifest.images)) throw new Error('Unsupported processing manifest schema.');
  const originalHashes = new Set();
  const intentionalUnmarked = new Map();
  for (const image of manifest.originalImages || []) {
    if (!/^[a-f\d]{64}$/.test(image.sha256)) record('Processing manifest contains an invalid source image hash');
    else originalHashes.add(image.sha256);
  }
  for (const image of manifest.images) {
    const unmarked = manifest.schemaVersion === 2 && image.mode === 'unwatermarked';
    if (manifest.schemaVersion === 2 && !['watermarked', 'unwatermarked'].includes(image.mode)) {
      record('Processing manifest contains an invalid image mode');
      continue;
    }
    if (!/^[a-f\d]{64}$/.test(image.sourceSha256) || !/^[a-f\d]{64}$/.test(image.outputSha256) || (!unmarked && image.sourceSha256 === image.outputSha256)) {
      record('Processing manifest contains an invalid or unchanged image');
      continue;
    }
    originalHashes.add(image.sourceSha256);
    if (unmarked) {
      if (!Array.isArray(image.publicationPaths) || !image.publicationPaths.length) record('Unmarked image has no explicit publication paths');
      else for (const candidate of image.publicationPaths) {
        if (typeof candidate !== 'string' || candidate.includes('\\') || candidate.includes('\0') || candidate.startsWith('/') || candidate.split('/').includes('..')) {
          record('Unmarked image has an unsafe publication path');
          continue;
        }
        const full = path.resolve(root, candidate);
        if (!within(root, full)) record('Unmarked image publication path escapes the publish directory');
        else {
          const allowed = intentionalUnmarked.get(full) || new Set();
          allowed.add(image.outputSha256);
          intentionalUnmarked.set(full, allowed);
        }
      }
    }
    if (contentRoot) {
      const prepared = path.resolve(contentRoot, image.path);
      if (!within(contentRoot, prepared) || !await exists(prepared)) record('Processing manifest references a missing prepared image');
      else if (sha256(await fs.readFile(prepared)) !== image.outputSha256) record('Prepared image does not match its processing manifest');
    }
  }
  for (const file of files.filter(file => /\.(?:png|jpe?g|webp|gif|avif|tiff?|bmp)$/i.test(file))) {
    const hash = sha256(await fs.readFile(file));
    if (originalHashes.has(hash) && !intentionalUnmarked.get(file)?.has(hash)) record(`Unprocessed source image in published output: ${relative(file)}`);
  }
}

if (failures.length) {
  console.error(`Site verification failed (${failures.length} findings):\n${failures.map(message => `- ${message}`).join('\n')}`);
  process.exitCode = 1;
} else {
  console.log(`Site verified: ${files.length} files, ${imageReferences} image references, ${checked.size} unique local resources${noteSummary ? `, ${noteSummary.comparisons} comparisons` : ''}.`);
}
