import fs from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { randomBytes } from 'node:crypto';
import { createInterface } from 'node:readline/promises';

const site = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.resolve(process.env.BLOG_CONTENT_DIR || path.join(site, '..', 'blog-content'));
await fs.access(path.join(source, '.git'));
const input = createInterface({ input: process.stdin, output: process.stdout });
try {
  const section = (await input.question('类型（posts / notes / screenplays，默认 posts）：')).trim() || 'posts';
  if (!['posts','notes','screenplays'].includes(section)) throw Error('类型无效');
  const name = (await input.question('文章文件夹名称（例如 MyNewPost）：')).trim();
  if (!/^[\p{L}\p{N}_-]+$/u.test(name)) throw Error('文件夹名称仅支持字母、汉字、数字、下划线和连字符');
  const directory = path.join(source,'content',section,name);
  await fs.mkdir(directory, { recursive:false });
  const slug = randomBytes(4).toString('hex');
  const text = `---\ntitle: ${JSON.stringify(name)}\ndate: ${new Date().toISOString()}\nslug: ${slug}\ndraft: true\ntags: []\ncategories: []\n---\n\n`;
  for (const language of ['en','zh-cn']) await fs.writeFile(path.join(directory,`index.${language}.md`),text,{flag:'wx'});
  await fs.mkdir(path.join(directory,'assets'));
  console.log(`已在私有仓库创建文章：${directory}`);
} finally { input.close(); }
