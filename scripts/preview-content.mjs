// Local preview prepares a copy using each image folder's watermark.yaml policy.
import fs from 'node:fs/promises';
import { watch } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn, spawnSync } from 'node:child_process';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.BLOG_CONTENT_DIR || path.join(site, '..', 'blog-content'));
const processor = path.join(source, 'scripts', 'prepare-content.mjs');
const projectProcessor = path.join(source, 'scripts', 'prepare-projects.mjs');
const privateProject = path.join(source, 'projects', 'cat-atlas');
const publicStatic = path.join(site, 'static');
const port = process.env.HUGO_PREVIEW_PORT || '1313';
if (!/^\d+$/.test(port) || Number(port) < 1024 || Number(port) > 65535) throw Error('Invalid preview port');
const workspace = path.join(site, '.migration', `preview-${port}`);
const current = path.join(workspace, 'content');
const currentStatic = path.join(workspace, 'static');
const staticConfig = path.join(workspace, 'static.toml');
await fs.access(processor).catch(() => { throw Error(`Private content repository not ready: ${source}`); });
await fs.mkdir(workspace, { recursive: true });
await fs.writeFile(staticConfig, `staticDir = [${JSON.stringify(currentStatic.replaceAll('\\', '/'))}]\n`);
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
async function reconcile(next, destinationRoot) {
  // Keep Hugo's watched directories in place; replacing the root loses Windows watchers.
  const nextFiles = await files(next);
  const wanted = new Set(nextFiles);
  await fs.mkdir(destinationRoot,{recursive:true});
  for (const relative of await files(destinationRoot)) {
    if (!wanted.has(relative)) await fs.unlink(path.join(destinationRoot,relative));
  }
  for (const relative of nextFiles) {
    const destination = path.join(destinationRoot,relative);
    const bytes = await fs.readFile(path.join(next,relative));
    let previous;
    try { previous = await fs.readFile(destination); } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (!previous?.equals(bytes)) {
      await fs.mkdir(path.dirname(destination),{recursive:true});
      await fs.writeFile(destination,bytes);
    }
  }
}
async function prepare() {
  const next = path.join(workspace, `next-${Date.now()}-${sequence++}`);
  const nextStatic = `${next}-static`;
  try {
    const result = spawnSync(process.execPath, [processor, '--source', source, '--output', next, '--manifest', next+'-manifest.json', '--include-drafts'], { cwd: site, stdio: 'inherit' });
    if (result.status !== 0) throw Error('Image preparation failed; keeping the previous preview.');
    let hasProject = false;
    try {
      const stat = await fs.lstat(privateProject);
      if (stat.isSymbolicLink() || !stat.isDirectory()) throw Error('Private Cat Atlas source must be a real directory.');
      hasProject = true;
    } catch (error) { if (error.code !== 'ENOENT') throw error; }
    if (hasProject) {
      await fs.access(projectProcessor).catch(() => { throw Error('Private project processor is missing; keeping the previous preview.'); });
      const projectResult = spawnSync(process.execPath, [projectProcessor, '--source', source, '--output', nextStatic, '--manifest', `${next}-projects-manifest.json`], { cwd: site, stdio:'inherit' });
      if (projectResult.status !== 0) throw Error('Cat Atlas preparation failed; keeping the previous preview.');
      if (!(await fs.stat(path.join(nextStatic,'cat-atlas','index.html'))).isFile()) throw Error('Prepared Cat Atlas homepage is missing.');
    }
    await fs.mkdir(nextStatic,{recursive:true});
    // Other static website resources remain public-code assets. Never overlay an
    // old public Cat Atlas file on the authoritative private project or resurrect deletions.
    for (const relative of await files(publicStatic)) {
      if (hasProject && relative.split(path.sep)[0] === 'cat-atlas') continue;
      const destination = path.join(nextStatic,relative);
      await fs.mkdir(path.dirname(destination),{recursive:true});
      await fs.copyFile(path.join(publicStatic,relative),destination);
    }
    // Validate both processors before changing either watched publication tree.
    await reconcile(next,current);
    await reconcile(nextStatic,currentStatic);
  } finally {
    await removePreview(next);
    await removePreview(nextStatic);
  }
}
await prepare();
const configFiles = [path.join(site,'hugo.toml'),staticConfig].join(',');
const hugo = spawn('hugo', ['server', '--config', configFiles, '--contentDir', current, '--buildDrafts', '--buildFuture', '--disableFastRender', '--ignoreCache', '--port', port, '--baseURL', `http://localhost:${port}/`, '--navigateToChanged'], {cwd:site,stdio:'inherit'});
let timer;
let preparing = false, pending = false, stopping = false;
async function refresh() {
  if (preparing) { pending = true; return; }
  preparing = true;
  try {
    do {
      pending = false;
      try { await prepare(); } catch (error) { console.error(error.message); }
    } while (pending && !stopping);
  } finally { preparing = false; }
}
const changed = () => { if (stopping) return; clearTimeout(timer); timer = setTimeout(refresh,600); };
const watchers = [watch(source, {recursive:true}, (_event, filename) => {
  const relative = String(filename || '').replaceAll('\\','/');
  if (!relative) return;
  if (relative.split('/').some(part => part.startsWith('.') || part === 'node_modules')) return;
  if (relative === 'content' || relative.startsWith('content/') || relative === 'branding' || relative.startsWith('branding/') || relative === 'projects' || relative.startsWith('projects/') || /\.(?:svg|png|jpe?g|webp|avif|yaml)$/i.test(relative) || ['scripts/prepare-content.mjs','scripts/prepare-projects.mjs'].includes(relative)) changed();
}), watch(publicStatic,{recursive:true},changed)];
hugo.on('error', error => { stopping = true; clearTimeout(timer); console.error(error.message); process.exitCode = 1; for (const watcher of watchers) watcher.close(); });
hugo.on('exit', code => { stopping = true; clearTimeout(timer); for (const watcher of watchers) watcher.close(); process.exitCode = code || 0; });
process.on('SIGINT', () => { stopping = true; clearTimeout(timer); for (const watcher of watchers) watcher.close(); hugo.kill('SIGINT'); });
