import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const verifier = fileURLToPath(new URL('./verify-site.mjs', import.meta.url));
const bytes = Buffer.from('iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+jNOkAAAAASUVORK5CYII=', 'base64');
const hash = createHash('sha256').update(bytes).digest('hex');

test('publication verification allows opted-out images only at their declared paths', async t => {
  const root = await fs.mkdtemp(path.join(os.tmpdir(), 'blog-public-policy-'));
  t.after(async () => {
    assert.equal(path.dirname(root), path.resolve(os.tmpdir()));
    assert.ok(path.basename(root).startsWith('blog-public-policy-'));
    await fs.rm(root, { recursive:true, force:true });
  });
  const output = path.join(root,'public');
  const published = 'posts/plain/assets/image.png';
  for (const language of ['', 'en', 'zh-cn']) {
    await fs.mkdir(path.join(output,language),{recursive:true});
    await fs.writeFile(path.join(output,language,'index.html'),`<html><img src="/${published}"></html>`);
  }
  await fs.mkdir(path.dirname(path.join(output,published)),{recursive:true});
  await fs.writeFile(path.join(output,published),bytes);
  const manifestFile = path.join(root,'manifest.json');
  const manifest = {schemaVersion:2, preview:false, originalImages:[
    {path:'posts/plain/assets/image.png',sha256:hash,mode:'unwatermarked'},
    {path:'draft/protected.png',sha256:hash,mode:'watermarked'}
  ],images:[{path:published,mode:'unwatermarked',sourceSha256:hash,outputSha256:hash,publicationPaths:[published]}]};
  const check = async () => {
    await fs.writeFile(manifestFile,JSON.stringify(manifest));
    return spawnSync(process.execPath,[verifier,'--public',output,'--manifest',manifestFile],{encoding:'utf8'});
  };
  assert.equal((await check()).status,0,'Explicit unmarked copy may share bytes with a protected source');
  const leaked = path.join(output,'leaked-original.png');
  await fs.writeFile(leaked,bytes);
  let result = await check();
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/Unprocessed source image/);
  await fs.unlink(leaked);
  manifest.images[0].mode='watermarked';
  assert.notEqual((await check()).status,0,'Marked output must differ from the original');
  manifest.images[0].mode='unwatermarked';
  manifest.preview=true;
  result=await check();
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/preview content cannot be published/i);
  manifest.preview=false;
  manifest.originalImages=[];
  manifest.images[0].sourceSha256=createHash('sha256').update('different private JPEG input').digest('hex');
  assert.equal((await check()).status,0,'Re-encoded opt-out images are also allowed');
  await fs.writeFile(leaked,bytes);
  result=await check();
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/undeclared publication path/);
  await fs.unlink(leaked);
  await fs.writeFile(path.join(output,published),'corrupted image');
  result=await check();
  assert.notEqual(result.status,0);
  assert.match(result.stderr,/differs from its processing manifest/);
});
