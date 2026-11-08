import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const site=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..');
const verifier=path.join(site,'scripts','verify-catatlas.mjs');
test('Cat Atlas publication catches missing runtime/CSS assets and requires rendered download links',async t=>{
  const root=await fs.mkdtemp(path.join(os.tmpdir(),'cat-atlas-public-test-'));
  t.after(async()=>{
    assert.equal(path.dirname(root),path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('cat-atlas-public-test-'));
    await fs.rm(root,{recursive:true,force:true});
  });
  const project=path.join(root,'cat-atlas');
  await fs.mkdir(path.join(root,'zh-cn'),{recursive:true});
  await fs.writeFile(path.join(root,'index.html'),'<html></html>');
  await fs.writeFile(path.join(root,'zh-cn','index.html'),'<html></html>');
  await fs.cp(path.join(site,'static','cat-atlas'),project,{recursive:true});
  const run=()=>spawnSync(process.execPath,[verifier,'--public',root],{encoding:'utf8'});
  let result=run();
  assert.notEqual(result.status,0,'Unrendered preparation links must fail before publication');
  assert.match(result.stderr,/download link|preparation state|installation instructions/);
  result=spawnSync(process.execPath,[path.join(site,'scripts','render-cat-atlas.cjs'),root],{encoding:'utf8'});
  assert.equal(result.status,0,result.stderr);
  result=run();
  assert.equal(result.status,0,result.stderr);
  assert.match(result.stdout,/30 animation frames/);

  for (const [relative,message] of [
    ['assets/fonts/atlas-latin.woff2',/missing.*atlas-latin\.woff2/],
    ['assets/cats/idle/frame-04.webp',/missing.*idle\/frame-04\.webp/]
  ]) {
    const full=path.join(project,relative);
    const backup=await fs.readFile(full);
    await fs.unlink(full);
    result=run();
    assert.notEqual(result.status,0,`Missing ${relative} must stop publication`);
    assert.match(result.stderr,message);
    await fs.writeFile(full,backup);
  }
  const index=path.join(project,'index.html');
  const html=await fs.readFile(index,'utf8');
  const broken=html.replace(/(<a\b[^>]*\bdata-download\b[^>]*\bhref=")[^"]+/, '$1https://github.com/WhiliMior/CatAtlas-Releases/releases/download/wrong/game.zip');
  assert.notEqual(broken,html,'Fixture contains a rendered download link');
  await fs.writeFile(index,broken);
  // The renderer puts href at the end, so modifying the release URL is detectable independently of JS.
  result=run();
  assert.notEqual(result.status,0,'Mismatched no-JavaScript download must stop publication');
  assert.match(result.stderr,/download link does not match/);
});
