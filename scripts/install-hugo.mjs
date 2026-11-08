#!/usr/bin/env node
// Download the official Hugo release through GitHub's release-assets API.
// No administrator privileges or third-party distribution mirrors are required.
import fs from 'node:fs/promises';
import path from 'node:path';
import os from 'node:os';
import { createHash } from 'node:crypto';
import { spawnSync } from 'node:child_process';

const version = process.env.HUGO_VERSION || '0.169.0';
if (!/^\d+\.\d+\.\d+$/.test(version)) throw new Error('HUGO_VERSION must be a numeric release version.');
if (process.platform !== 'linux' || process.arch !== 'x64') throw new Error('This CI installer supports Linux x64 only.');

const userAgent = 'whilimior-blog-hugo-installer';
const token = process.env.GH_TOKEN;
const apiRoot = 'https://api.github.com';
const metadataUrl = `${apiRoot}/repos/gohugoio/hugo/releases/tags/v${version}`;
const maxArchiveBytes = 128 * 1024 * 1024;
const timeoutMs = 60_000;
const downloadHosts = new Set(['api.github.com', 'release-assets.githubusercontent.com', 'objects.githubusercontent.com', 'github.com']);

function safeError(message) {
  // Never echo signed redirect URLs, response bodies, or authorization headers.
  return new Error(message);
}

async function withRetries(description, action) {
  for (let attempt = 1; attempt <= 3; attempt++) {
    try { return await action(); } catch (error) {
      if (attempt === 3) throw safeError(`${description} failed after three attempts: ${error.name === 'TimeoutError' ? 'request timed out' : 'request or validation failed'}.`);
      console.warn(`${description}: retrying (${attempt}/3).`);
      await new Promise(resolve => setTimeout(resolve, attempt * 1000));
    }
  }
}

async function request(url, accept, signal) {
  let target = new URL(url);
  for (let redirects = 0; redirects <= 5; redirects++) {
    if (target.protocol !== 'https:' || target.username || target.password || !downloadHosts.has(target.hostname)) {
      throw safeError('Unexpected release download location.');
    }
    const headers = { Accept: accept, 'User-Agent': userAgent };
    if (target.origin === apiRoot) {
      headers['X-GitHub-Api-Version'] = '2022-11-28';
      if (token) headers.Authorization = `Bearer ${token}`;
    }
    const response = await fetch(target, { headers, redirect: 'manual', signal });
    if ([301, 302, 303, 307, 308].includes(response.status)) {
      const location = response.headers.get('location');
      await response.body?.cancel();
      if (!location) throw safeError('Release download redirect has no destination.');
      target = new URL(location, target);
      continue;
    }
    if (!response.ok) {
      await response.body?.cancel();
      throw safeError(`GitHub returned HTTP ${response.status}.`);
    }
    return response;
  }
  throw safeError('Too many release download redirects.');
}

async function readLimited(response, limit) {
  const chunks = [];
  let length = 0;
  for await (const chunk of response.body) {
    length += chunk.byteLength;
    if (length > limit) throw safeError('Release metadata exceeds the size limit.');
    chunks.push(chunk);
  }
  return Buffer.concat(chunks);
}

const release = await withRetries('Hugo release metadata', async () => {
  const response = await request(metadataUrl, 'application/vnd.github+json', AbortSignal.timeout(timeoutMs));
  return JSON.parse((await readLimited(response, 4 * 1024 * 1024)).toString('utf8'));
});
const filename = `hugo_extended_${version}_linux-amd64.tar.gz`;
const asset = release.assets?.find(item => item.name === filename);
if (!asset || !/^https:\/\/api\.github\.com\/repos\/gohugoio\/hugo\/releases\/assets\/\d+$/.test(asset.url)) {
  throw safeError('The official Hugo Extended Linux archive was not found.');
}
if (!/^sha256:[a-f\d]{64}$/i.test(asset.digest || '')) throw safeError('Official release asset is missing its SHA-256 digest.');
if (!Number.isSafeInteger(asset.size) || asset.size <= 0 || asset.size > maxArchiveBytes) throw safeError('Official release asset size is invalid.');
const expectedHash = asset.digest.slice('sha256:'.length).toLowerCase();

const temporaryRoot = path.resolve(process.env.RUNNER_TEMP || os.tmpdir());
if (/[\r\n]/.test(temporaryRoot)) throw safeError('Invalid temporary directory.');
await fs.mkdir(temporaryRoot, { recursive: true });
const directory = await fs.mkdtemp(path.join(temporaryRoot, `hugo-${version}-`));
const archive = path.join(directory, 'hugo.tar.gz');
await withRetries('Hugo archive download', async () => {
  const response = await request(asset.url, 'application/octet-stream', AbortSignal.timeout(timeoutMs));
  const output = await fs.open(archive, 'w', 0o600);
  const hash = createHash('sha256');
  let bytes = 0;
  try {
    for await (const chunk of response.body) {
      bytes += chunk.byteLength;
      if (bytes > maxArchiveBytes) throw safeError('Hugo archive exceeds the size limit.');
      hash.update(chunk);
      await output.writeFile(chunk);
    }
  } finally {
    await output.close();
  }
  if (bytes !== asset.size || hash.digest('hex') !== expectedHash) throw safeError('Hugo archive does not match the official size and SHA-256 digest.');
});

// Extract only the executable, never other archive paths.
const extraction = spawnSync('tar', ['-xzf', archive, '-C', directory, '--no-same-owner', '--no-same-permissions', 'hugo'], { encoding: 'utf8', timeout: 30_000, maxBuffer: 1024 * 1024 });
if (extraction.status !== 0 || extraction.error) throw safeError('Could not extract the verified Hugo executable.');
const executable = path.join(directory, 'hugo');
const binaryStat = await fs.lstat(executable);
if (!binaryStat.isFile() || binaryStat.isSymbolicLink()) throw safeError('Hugo executable is not a regular file.');
await fs.chmod(executable, 0o755);
const check = spawnSync(executable, ['version'], { encoding: 'utf8', timeout: 15_000, maxBuffer: 1024 * 1024 });
const escapedVersion = version.replaceAll('.', '\\.');
if (check.status !== 0 || check.error || !new RegExp(`^hugo v${escapedVersion}(?:[-+]|\\s)`).test(check.stdout) || !check.stdout.includes('+extended')) {
  throw safeError('The installed binary is not the requested Hugo Extended version.');
}
await fs.unlink(archive);
if (process.env.GITHUB_PATH) await fs.appendFile(process.env.GITHUB_PATH, `${directory}\n`);
console.log(`Installed verified Hugo Extended ${version} in ${directory}.`);
