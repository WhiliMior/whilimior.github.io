#!/usr/bin/env node
// Verify standalone Cat Atlas resources, including assets referenced only at runtime.
import fs from 'node:fs/promises';
import path from 'node:path';
import vm from 'node:vm';

let directory = 'public';
for (let i=2; i<process.argv.length; i++) {
  if (process.argv[i] !== '--public' || !process.argv[i+1]) throw Error('Usage: node scripts/verify-catatlas.mjs [--public DIRECTORY]');
  directory = process.argv[++i];
}
const root = await fs.realpath(path.resolve(directory));
const origin = 'https://whilimior.github.io';
const failures = [];
const checked = new Set();
const fail = message => { if (failures.length < 80) failures.push(message); };
const relative = file => path.relative(root,file).split(path.sep).join('/');
const within = full => { const r = path.relative(root,full); return !path.isAbsolute(r) && r !== '..' && !r.startsWith(`..${path.sep}`); };

function attributes(source) {
  const result = {};
  for (const match of source.matchAll(/([^\s=/'"<>]+)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s'"=<>`]+)))?/g)) result[match[1].toLowerCase()] = match[2] ?? match[3] ?? match[4] ?? '';
  return result;
}
const decode = value => value.replace(/&(?:amp|quot|apos|lt|gt|#(\d+)|#x([a-f\d]+));/gi,(entity,decimal,hex) => {
  if (decimal || hex) { const number = parseInt(decimal || hex,hex ? 16 : 10); return number <= 0x10ffff ? String.fromCodePoint(number) : entity; }
  return {'&amp;':'&','&quot;':'"','&apos;':"'",'&lt;':'<','&gt;':'>'}[entity.toLowerCase()];
});
const tags = /<([a-z][\w:-]*)\b((?:"[^"]*"|'[^']*'|[^'">])*)>/gi;

async function requireFile(full, context) {
  if (!within(full)) { fail(`${context}: path escapes publication output`); return null; }
  try {
    const actual = await fs.realpath(full);
    const stat = await fs.stat(actual);
    if (!within(actual) || !stat.isFile() || stat.size === 0) { fail(`${context}: invalid or empty file ${relative(full)}`); return null; }
    checked.add(full);
    return actual;
  } catch { fail(`${context}: missing ${relative(full)}`); return null; }
}

async function reference(value, owner, context) {
  value = decode(String(value || '').trim());
  if (!value || value.startsWith('#') || /^(?:data:|blob:|mailto:|tel:|javascript:)/i.test(value)) return null;
  if (value.includes('\\') || /^[a-z]:/i.test(value)) { fail(`${context}: invalid browser path ${value}`); return null; }
  let url;
  try { url = new URL(value,new URL('/'+relative(owner),origin)); } catch { fail(`${context}: invalid URL`); return null; }
  if (url.origin !== origin) return null;
  let pathname;
  try { pathname = decodeURIComponent(url.pathname); } catch { fail(`${context}: invalid URL encoding`); return null; }
  if (pathname.includes('\\') || pathname.includes('\0')) { fail(`${context}: invalid decoded path`); return null; }
  let full = path.resolve(root,'.'+pathname);
  if (!within(full)) { fail(`${context}: URL escapes publication output`); return null; }
  try { if ((await fs.stat(full)).isDirectory()) full = path.join(full,'index.html'); } catch { /* requireFile reports the missing resource. */ }
  return requireFile(full,context);
}

async function walk(directory) {
  const files = [];
  for (const entry of await fs.readdir(directory,{withFileTypes:true})) {
    const full = path.join(directory,entry.name);
    if (entry.isSymbolicLink()) { fail(`Symbolic link in Cat Atlas output: ${relative(full)}`); continue; }
    if (entry.isDirectory()) files.push(...await walk(full));
    else if (entry.isFile()) files.push(full);
  }
  return files;
}

const project = path.join(root,'cat-atlas');
for (const file of ['index.html','en/index.html','config.js','app.js','styles.css','integration.css']) await requireFile(path.join(project,file),'Cat Atlas entry');
const htmlFiles = ['index.html','en/index.html'].map(name=>path.join(project,name));
const projectFiles = await walk(project);
const artwork = ['globe-europe-oil.png','camera-oil.png','postcards-painted.png','stamp-painted.png'];
for (const name of artwork) await requireFile(path.join(project,'assets','art',name),'Cat Atlas composition');

const context = {window:{}};
try { vm.runInNewContext(await fs.readFile(path.join(project,'config.js'),'utf8'),context,{timeout:1000,contextCodeGeneration:{strings:false,wasm:false}}); }
catch { fail('Cat Atlas config.js could not be evaluated'); }
const config = context.window.CAT_ATLAS_CONFIG || {};
let download;
try {
  download = new URL(config.downloadUrl);
  if (download.protocol !== 'https:' || download.username || download.password || download.hostname !== 'github.com' || !/^\/WhiliMior\/CatAtlas-Releases\/releases\/download\/[^/]+\/[^/]+\.zip$/i.test(download.pathname)) throw Error();
} catch { fail('Cat Atlas download must point to the published CatAtlas-Releases ZIP'); }

for (const file of htmlFiles) {
  let html;
  try { html = (await fs.readFile(file,'utf8')).replace(/<!--[\s\S]*?-->/g,''); } catch { continue; }
  for (const match of html.matchAll(tags)) {
    const tag = match[1].toLowerCase();
    const attrs = attributes(match[2]);
    if (attrs.src) await reference(attrs.src,file,`${relative(file)} ${tag}.src`);
    if (attrs.poster) await reference(attrs.poster,file,`${relative(file)} video.poster`);
    if (attrs.href) await reference(attrs.href,file,`${relative(file)} ${tag}.href`);
    if (attrs['xlink:href']) await reference(attrs['xlink:href'],file,`${relative(file)} SVG reference`);
    if (tag === 'meta' && ['og:image','twitter:image'].includes(attrs.property || attrs.name)) await reference(attrs.content,file,`${relative(file)} social image`);
  }
  const links = [...html.matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi)].map(match=>({attrs:attributes(match[1]),body:match[2]})).filter(link=>Object.hasOwn(link.attrs,'data-download'));
  if (links.length !== 2) fail(`${relative(file)}: expected two no-JavaScript download links`);
  for (const link of links) {
    if (!download || decode(link.attrs.href || '') !== download.href) fail(`${relative(file)}: download link does not match configured release`);
    if (!/data-download-label\b/.test(link.body) || /准备中|敬请期待|coming soon|in preparation/i.test(link.body)) fail(`${relative(file)}: download label is still in preparation state`);
  }
  const instructions = [...html.matchAll(/<p\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/p>/gi)].find(match=>attributes(match[1]).id==='download-instructions');
  if (!instructions || Object.hasOwn(attributes(instructions[1]),'hidden') || !/CatAtlas\.exe/.test(instructions[2])) fail(`${relative(file)}: no-JavaScript installation instructions are missing`);
  const platform = [...html.matchAll(/<span\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/span>/gi)].find(match=>Object.hasOwn(attributes(match[1]),'data-download-platform'));
  if (!platform || !/Windows/.test(platform[2]) || /准备|期待|coming soon/i.test(platform[2])) fail(`${relative(file)}: published platform label is missing`);
}

for (const file of projectFiles.filter(file=>file.endsWith('.css'))) {
  const css = (await fs.readFile(file,'utf8')).replace(/\/\*[\s\S]*?\*\//g,'');
  for (const match of css.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^\s)]+))\s*\)/gi)) await reference(match[1] ?? match[2] ?? match[3],file,`${relative(file)} CSS URL`);
}
const trailers = new Set([config.trailerUrl,...Object.values(config.trailerUrls || {})].filter(Boolean));
if (!trailers.size) fail('Cat Atlas trailers are not configured');
for (const trailer of trailers) {
  const file = await reference(trailer,path.join(project,'app.js'),'Cat Atlas configured trailer');
  if (file) {
    const handle = await fs.open(file,'r');
    const header = Buffer.alloc(12);
    try { await handle.read(header,0,12,0); } finally { await handle.close(); }
    if (header.toString('ascii',4,8) !== 'ftyp') fail(`Invalid MP4 header: ${relative(file)}`);
  }
}

function webpSize(bytes) {
  if (bytes.toString('ascii',0,4) !== 'RIFF' || bytes.toString('ascii',8,12) !== 'WEBP') return null;
  for (let offset=12; offset+8<=bytes.length;) {
    const id = bytes.toString('ascii',offset,offset+4), size = bytes.readUInt32LE(offset+4), data=offset+8;
    if (data+size>bytes.length) return null;
    if (id==='VP8X' && size>=10) return [bytes.readUIntLE(data+4,3)+1,bytes.readUIntLE(data+7,3)+1];
    if (id==='VP8L' && size>=5 && bytes[data]===0x2f) { const bits=bytes.readUInt32LE(data+1); return [(bits&0x3fff)+1,((bits>>>14)&0x3fff)+1]; }
    if (id==='VP8 ' && size>=10) return [bytes.readUInt16LE(data+6)&0x3fff,bytes.readUInt16LE(data+8)&0x3fff];
    offset=data+size+(size%2);
  }
  return null;
}
let frameCount=0;
for (const manifestName of ['assets/cats/manifest.json','assets/cats/perch/manifest.json']) {
  const file = await requireFile(path.join(project,manifestName),'Cat Atlas animation manifest');
  if (!file) continue;
  let manifest;
  try { manifest=JSON.parse(await fs.readFile(file,'utf8')); } catch { fail(`Invalid animation manifest: ${manifestName}`); continue; }
  if (!Array.isArray(manifest.frameSize) || manifest.frameSize.length!==2 || !manifest.states || typeof manifest.states!=='object') { fail(`Invalid animation shape: ${manifestName}`); continue; }
  for (const [state,data] of Object.entries(manifest.states)) {
    if (!Array.isArray(data.frames) || !data.frames.length) { fail(`Animation state has no frames: ${state}`); continue; }
    for (const frame of data.frames) {
      const full=await reference(frame,file,`Animation ${manifestName} ${state}`);
      if (!full) continue;
      frameCount++;
      const size=webpSize(await fs.readFile(full));
      if (!size || size.some((value,index)=>value!==manifest.frameSize[index])) fail(`Animation frame dimensions changed: ${relative(full)}`);
    }
  }
}

let previews=0;
for (const file of await walk(root)) {
  if (!/\.(?:html|css|js)$/i.test(file)) continue;
  const source=await fs.readFile(file,'utf8');
  if (/(?:src|href)\s*=\s*["']?[^\s"'<>]*hero-collage\.webp|url\(\s*["']?[^)"']*hero-collage\.webp/i.test(source)) fail(`Obsolete collage image reference: ${relative(file)}`);
  if (!file.endsWith('.html')) continue;
  for (const match of source.matchAll(/<a\b((?:"[^"]*"|'[^']*'|[^'">])*)>([\s\S]*?)<\/a>/gi)) {
    if (!(attributes(match[1]).class || '').split(/\s+/).includes('cat-atlas-preview')) continue;
    previews++;
    for (const name of artwork) if (!match[2].includes(`/cat-atlas/assets/art/${name}`)) fail(`Blog Cat Atlas preview is missing ${name}: ${relative(file)}`);
  }
}
if (failures.length) {
  console.error(`Cat Atlas verification failed (${failures.length} findings):\n${failures.map(message=>'- '+message).join('\n')}`);
  process.exitCode=1;
} else console.log(`Cat Atlas verified: 2 localized pages, ${frameCount} animation frames, ${trailers.size} trailers, ${previews} blog previews, ${checked.size} local resources.`);
