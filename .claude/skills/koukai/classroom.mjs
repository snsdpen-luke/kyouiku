// 教材のリンクを Classroom に「資料」として載せる（既定は下書き）。受け口は apps-script/Classroom投稿.gs。
// 受け口の URL と合言葉は、公開の repo に置かない。この Mac の ~/.config/kyouiku/classroom.json にだけ置く。
//
//   node classroom.mjs setup <受け口のURL> <合言葉>     最初に1回（剛さんがターミナルで。合言葉を会話に貼らない）
//   node classroom.mjs courses                          受け持っているクラスの一覧（id と、付けた呼び名）
//   node classroom.mjs map <呼び名> <クラスのid>         呼び名を付ける（例: 電子計測制御3年）
//   node classroom.mjs post <呼び名> <フォルダ|URL> [--title 題] [--desc 説明] [--publish]
//        例: node classroom.mjs post 電子計測制御3年 seigyo100
//        題を省くと README の「生徒に配るURL」の表の名前を使う。--publish がなければ下書き
//   node classroom.mjs status                           設定があるか（受け口と呼び名の数。合言葉は出さない）
import fs from 'fs';
import os from 'os';
import path from 'path';

const CONF = path.join(os.homedir(), '.config', 'kyouiku', 'classroom.json');
const BASE = 'https://snsdpen-luke.github.io/kyouiku/';
const load = () => { try { return JSON.parse(fs.readFileSync(CONF, 'utf8')); } catch { return null; } };
const save = c => { fs.mkdirSync(path.dirname(CONF), { recursive: true }); fs.writeFileSync(CONF, JSON.stringify(c, null, 2)); fs.chmodSync(CONF, 0o600); };
const die = (m, code = 1) => { console.error(m); process.exit(code); };

async function call(c, body) {
  // Apps Script の Web アプリは POST に 302 を返し、行き先を GET で読むと返事がある（fetch が自動でたどる）
  const r = await fetch(c.url, { method: 'POST', body: JSON.stringify({ key: c.key, ...body }), redirect: 'follow' });
  const t = await r.text();
  try { return JSON.parse(t); } catch { die('受け口の返事が JSON でない（デプロイの「アクセスできるユーザー」が「全員」か確かめる）:\n' + t.slice(0, 300)); }
}

function titleFromReadme(folder) {
  // README の「生徒に配るURL」の表：| 名前 | <https://…/kyouiku/<folder>/> … |
  try {
    const md = fs.readFileSync(path.resolve('README.md'), 'utf8');
    const re = new RegExp('^\\|\\s*([^|]+?)\\s*\\|\\s*<' + (BASE + folder + '/').replace(/[.*+?^${}()|[\]\\/]/g, '\\$&') + '>', 'm');
    const m = md.match(re);
    return m ? m[1].replace(/\*\*/g, '') : null;
  } catch { return null; }
}

const [cmd, ...a] = process.argv.slice(2);
const flag = n => { const i = a.indexOf(n); return i < 0 ? null : a[i + 1]; };

if (cmd === 'setup') {
  const [url, key] = a;
  if (!/^https:\/\/script\.google\.com\/macros\/s\/[\w-]+\/exec$/.test(url || '') || !key) die('使い方: node classroom.mjs setup <https://script.google.com/macros/s/…/exec> <合言葉>', 2);
  const c = { ...(load() || {}), url, key, courses: (load() || {}).courses || {} };
  const r = await call(c, { action: 'courses' });
  if (!r.ok) die('つながらない: ' + r.err);
  save(c);
  console.log(`ok   受け口につながった。受け持っているクラス ${r.courses.length}。設定は ${CONF}（この Mac だけ）`);
  console.log('次: node .claude/skills/koukai/classroom.mjs courses で一覧を見て、map で呼び名を付ける');
} else {
  const c = load();
  if (!c) die('まだ設定がない（Classroom 投稿は使えない）。手順は apps-script/README-Classroom.md', 3);
  if (cmd === 'status') {
    console.log(`ok   受け口あり。呼び名: ${Object.keys(c.courses).join('・') || 'なし'}`);
  } else if (cmd === 'courses') {
    const r = await call(c, { action: 'courses' });
    if (!r.ok) die('NG   ' + r.err);
    const names = Object.fromEntries(Object.entries(c.courses).map(([k, v]) => [v, k]));
    for (const x of r.courses) console.log(`${x.id}\t${x.name}${x.section ? '（' + x.section + '）' : ''}${names[x.id] ? '\t← 呼び名: ' + names[x.id] : ''}`);
  } else if (cmd === 'map') {
    const [name, id] = a;
    if (!name || !/^\d+$/.test(id || '')) die('使い方: node classroom.mjs map <呼び名> <クラスのid（数字）>', 2);
    c.courses[name] = id; save(c);
    console.log(`ok   ${name} → ${id}`);
  } else if (cmd === 'post') {
    const [name, target] = a;
    const id = c.courses[name];
    if (!id) die(`呼び名「${name}」がない。あるのは: ${Object.keys(c.courses).join('・') || 'なし'}（map で付ける）`, 2);
    if (!target) die('使い方: node classroom.mjs post <呼び名> <フォルダ|URL> [--title 題] [--desc 説明] [--publish]', 2);
    const url = /^https?:\/\//.test(target) ? target : BASE + target.replace(/^\/|\/$/g, '') + '/';
    if (!url.startsWith(BASE)) die('kyouiku の教材の URL だけ載せられる: ' + url, 2);
    if (url.includes('#')) die('先生用の入口（# のついた URL）は生徒に配らない: ' + url, 2);
    const folder = url.slice(BASE.length).replace(/\/$/, '').split('/')[0];
    const title = flag('--title') || titleFromReadme(folder) || folder;
    const publish = a.includes('--publish');
    const r = await call(c, { action: 'post', courseId: id, url, title, description: flag('--desc') || '', publish });
    if (!r.ok) die('NG   ' + r.err);
    if (r.dup) console.log(`ok   もう載っている（${r.state === 'DRAFT' ? '下書き' : '公開中'}）「${r.title}」 ${r.link}`);
    else console.log(`ok   ${name} に「${r.title}」を${r.state === 'DRAFT' ? '下書きで' : '生徒に公開して'}載せた ${r.link}`);
  } else {
    die('使い方: node classroom.mjs setup|status|courses|map|post（ファイルの先頭を見る）', 2);
  }
}
