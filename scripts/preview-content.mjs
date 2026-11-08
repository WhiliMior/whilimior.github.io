// Local preview prepares a copy using each image folder's watermark.yaml policy.
import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.BLOG_CONTENT_DIR || path.join(site, '..', 'blog-content'));
const processor = path.join(source, 'scripts', 'prepare-content.mjs');
const port = process.env.HUGO_PREVIEW_PORT || '1313';
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw Error('Invalid preview port');
const workspace = path.join(site, '.migration', `preview-${port}`);
const current = path.join(workspace, 'content');
await fs.access(processor).catch(() => { throw Error(`Private content repository not ready: ${source}`); });
await fs.mkdir(workspace, { recursive: true });
async function removePreview(directory) {
  const relative = path.relative(workspace, directory);
  if (!relative || relative.startsWith('..') || path.isAbsolute(relative)) throw Error('Unsafe preview cleanup path');
  await fs.rm(directory, { recursive: true, force: true });
}
let sequence = 0;
async function files(directory, relative = '') {
  let entries;
  try { entries = await fs.readdir(path.join(directory, relative), {withFileTypes:true}); }
  catch (error) { if (error.code === 'ENOENT') return []; throw error; }
  const result = [];
  for (const entry of entries) {
    if (entry.isSymbolicLink()) throw Error('Unexpected symbolic link in preview output');
    const name = path.join(relative,entry.name);
    if (entry.isDirectory()) result.push(...await files(directory,name));
    else if (entry.isFile()) result.push(name);
  }
  return result;
}
async function prepare() {
  const next = path.join(workspace, `next-${Date.now()}-${sequence++}`);
  const result = spawnSync(process.execPath, [processor, '--source', source, '--output', next, '--manifest', next+'-manifest.json', '--include-drafts'], { cwd: site, stdio: 'inherit' });
  if (result.status !== 0) { await removePreview(next); throw Error('Image preparation failed; keeping the previous preview.'); }
  // Keep Hugo's watched directories in place; replacing the root loses Windows watchers.
  const nextFiles = await files(next);
  const wanted = new Set(nextFiles);
  await fs.mkdir(current,{recursive:true});
  for (const relative of await files(current)) {
    if (!wanted.has(relative)) await fs.unlink(path.join(current,relative));
  }
  for (const relative of nextFiles) {
    const destination = path.join(current,relative);
    const bytes = await fs.readFile(path.join(next,relative));
    let previous;
    try { previous = await fs.readFile(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!previous?.equals(bytes)) {
      await fs.mkdir(path.dirname(destination),{recursive:true});
      await fs.writeFile(destination,bytes);
    }
  }
  await removePreview(next);
}
await prepare();
const hugo = spawn('hugo', ['server', '--contentDir', current, '--buildDrafts', '--buildFuture', '--disableFastRender', '--ignoreCache', '--port', port, '--baseURL', `http://localhost:${port}/`, '--navigateToChanged'], {cwd:site,stdio:'inherit'});
let timer;
const changed = () => { clearTimeout(timer); timer = setTimeout(() => { prepare().catch(error => console.error(error.message)); }, 600); };
const watchers = [watch(source, {recursive:true}, (_event, filename) => {
  const relative = String(filename || '').replaceAll('\\','/');
  if (!relative) return;
  if (relative.split('/').some(part => part.startsWith('.') || part === 'node_modules')) return;
  if (relative === 'content' || relative.startsWith('content/') || relative === 'branding' || relative.startsWith('branding/') || /\.(?:svg|png|jpe?g|webp|avif|yaml)$/i.test(relative) || relative === 'scripts/prepare-content.mjs') changed();
})];
hugo.on('error', error => { console.error(error.message); process.exitCode = 1; for (const watcher of watchers) watcher.close(); });
hugo.on('exit', code => { clearTimeout(timer); for (const watcher of watchers) watcher.close(); process.exitCode = code || 0; });
process.on('SIGINT', () => { clearTimeout(timer); for (const watcher of watchers) watcher.close(); hugo.kill('SIGINT'); });
