// 教材のリンクを Classroom に「資料」として載せる（既定は下書き）。受け口は apps-script/Classroom投稿.gs。
// 受け口の URL と合言葉は、公開の repo に置かない。この Mac の ~/.config/kyouiku/classroom.json にだけ置く。
//
//   node classroom.mjs setup <受け口のURL> <合言葉>     最初に1回（剛さんがターミナルで。合言葉を会話に貼らない）
//   node classroom.mjs courses                          受け持っているクラスの一覧（id と、付けた呼び名）
//   node classroom.mjs map <呼び名> <クラスのid> [<id> …]  呼び名を付ける。1つの呼び名にクラスをいくつでも（足していく）
//        例: node classroom.mjs map 電子計測制御 111 112      （3年1組と2組。post するとどちらにも載る）
//   node classroom.mjs unmap <呼び名> [<id>]              外す（id を省くと呼び名ごと）
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
  // 引数がなければ聞く（合言葉は画面に出さない・シェルの履歴にも残らない）
  const ask = async q => {
    const rl = (await import('readline')).createInterface({ input: process.stdin, output: process.stdout, terminal: true });
    const v = await new Promise(r => rl.question(q, r));
    rl.close();
    return v.trim().replace(/^['"]|['"]$/g, '');
  };
  // 合言葉は1文字も画面に出さない。readline を使わず、端末の生の入力を自分で読む（readline は行を描き直すときに中身を出してしまう）
  const askHidden = q => new Promise(res => {
    process.stdout.write(q);
    const inp = process.stdin;
    if (!inp.isTTY) { let b = ''; inp.setEncoding('utf8'); inp.on('data', d => { b += d; }); inp.on('end', () => res(b.split(/\r?\n/)[0] || '')); inp.resume(); return; }
    inp.setRawMode(true); inp.setEncoding('utf8'); inp.resume();
    let buf = '';
    const on = d => {
      for (const ch of d) {
        if (ch === '\u0003') { inp.setRawMode(false); process.stdout.write('\n'); process.exit(130); }
        if (ch === '\r' || ch === '\n') {
          if (!buf.replace(/\x1b\[[0-9;]*[~A-Za-z]/g, '').trim()) continue;   // 貼る前の空の Enter は数えない
          inp.off('data', on); inp.setRawMode(false); inp.pause();
          process.stdout.write('（入力しました・画面には出しません）\n'); res(buf); return;
        }
        if (ch === '\u007f' || ch === '\b') buf = buf.slice(0, -1); else buf += ch;
      }
    };
    inp.on('data', on);
  });
  let [url, key] = a;
  if (!url) url = await ask('ウェブアプリの URL を貼って Enter: ');
  if (!/^https:\/\/script\.google\.com\/(a\/macros\/[\w.-]+\/s|macros\/s)\/[\w-]+\/exec$/.test(url || '')) die('URL の形がちがう。https://script.google.com/macros/s/…/exec の形（最後が /exec）を貼る。もう一度 setup から', 2);
  if (!key) key = await askHidden('合言葉（実行ログの KEY）を貼って Enter（貼っても何も出ません。1回だけ貼る）: ');
  // 貼りつけで混ざる物を落とす：「合言葉（KEY）:」ごとコピーした頭、貼りつけの制御文字（ESC[200~ など）、空白。
  // 合言葉は setup() が作る 64 文字の 0-9a-f
  key = String(key || '').replace(/\x1b\[[0-9;]*[~A-Za-z]/g, '').replace(/^.*[:：]/, '').replace(/[^0-9a-fA-F]/g, '').toLowerCase();
  // 何回か貼ってしまったとき（同じ 64 文字のくり返し）は1つにする
  if (key.length > 64 && key.length % 64 === 0 && key === key.slice(0, 64).repeat(key.length / 64)) key = key.slice(0, 64);
  if (key.length !== 64) die(`合言葉の長さが ${key.length} 文字（正しくは 64 文字の英数字）。実行ログの「合言葉（KEY）:」の後ろだけをコピーして、もう一度 setup から`, 2);
  const c = { ...(load() || {}), url, key, courses: (load() || {}).courses || {} };
  const r = await call(c, { action: 'courses' });
  if (!r.ok && /合言葉/.test(r.err)) die('つながらない: 合言葉がちがう（長さは 64 文字で合っている）。\n考えられること：URL と合言葉が別のプロジェクトの物／setup のあとに resetKey を押した。\nURL を出したのと同じ Apps Script で、⚙ プロジェクトの設定 → スクリプト プロパティの KEY を見て、もう一度 setup から', 1);
  if (!r.ok) die('つながらない: ' + r.err);
  save(c);
  console.log(`ok   受け口につながった。受け持っているクラス ${r.courses.length}。設定は ${CONF}（この Mac だけ）`);
  console.log('次: node .claude/skills/koukai/classroom.mjs courses で一覧を見て、map で呼び名を付ける');
} else {
  const c = load();
  if (!c) die('まだ設定がない（Classroom 投稿は使えない）。手順は apps-script/README-Classroom.md', 3);
  const ids = name => [].concat(c.courses[name] || []);   // 呼び名1つに、クラスをいくつでも（3年1組・2組など）
  if (cmd === 'status') {
    console.log(`ok   受け口あり。呼び名: ${Object.keys(c.courses).map(k => `${k}（${ids(k).length}クラス）`).join('・') || 'なし'}`);
  } else if (cmd === 'courses') {
    const r = await call(c, { action: 'courses' });
    if (!r.ok) die('NG   ' + r.err);
    for (const x of r.courses) {
      const nm = Object.keys(c.courses).filter(k => ids(k).includes(x.id));
      console.log(`${x.id}\t${x.name}${x.section ? '（' + x.section + '）' : ''}${nm.length ? '\t← 呼び名: ' + nm.join('・') : ''}`);
    }
    const live = new Set(r.courses.map(x => x.id));
    for (const k of Object.keys(c.courses)) for (const id of ids(k)) if (!live.has(id)) console.log(`注意 呼び名「${k}」の ${id} は、今は受け持っていない（アーカイブ済みかも）。unmap で外す`);
  } else if (cmd === 'map') {
    const [name, ...list] = a;
    if (!name || !list.length || !list.every(id => /^\d+$/.test(id))) die('使い方: node classroom.mjs map <呼び名> <クラスのid> [<id> …]（足していく）', 2);
    c.courses[name] = [...new Set([...ids(name), ...list])]; save(c);
    console.log(`ok   ${name} → ${c.courses[name].join('・')}`);
  } else if (cmd === 'unmap') {
    const [name, id] = a;
    if (!c.courses[name]) die(`呼び名「${name}」がない`, 2);
    if (id) c.courses[name] = ids(name).filter(x => x !== id); else delete c.courses[name];
    if (c.courses[name] && !c.courses[name].length) delete c.courses[name];
    save(c); console.log(`ok   ${name} → ${c.courses[name] ? c.courses[name].join('・') : '（消した）'}`);
  } else if (cmd === 'post') {
    const [name, target] = a;
    if (!ids(name).length) die(`呼び名「${name}」がない。あるのは: ${Object.keys(c.courses).join('・') || 'なし'}（map で付ける）`, 2);
    if (!target) die('使い方: node classroom.mjs post <呼び名> <フォルダ|URL> [--title 題] [--desc 説明] [--publish]', 2);
    const url = /^https?:\/\//.test(target) ? target : BASE + target.replace(/^\/|\/$/g, '') + '/';
    if (!url.startsWith(BASE)) die('kyouiku の教材の URL だけ載せられる: ' + url, 2);
    if (url.includes('#')) die('先生用の入口（# のついた URL）は生徒に配らない: ' + url, 2);
    const folder = url.slice(BASE.length).replace(/\/$/, '').split('/')[0];
    const title = flag('--title') || titleFromReadme(folder) || folder;
    const publish = a.includes('--publish');
    let bad = 0;
    for (const id of ids(name)) {
      const r = await call(c, { action: 'post', courseId: id, url, title, description: flag('--desc') || '', publish });
      if (!r.ok) { bad++; console.log(`NG   ${name}（${id}）: ${r.err}`); continue; }
      if (r.dup) console.log(`ok   ${name}（${id}）にもう載っている（${r.state === 'DRAFT' ? '下書き' : '公開中'}）「${r.title}」 ${r.link}`);
      else console.log(`ok   ${name}（${id}）に「${r.title}」を${r.state === 'DRAFT' ? '下書きで' : '生徒に公開して'}載せた ${r.link}`);
    }
    if (bad) process.exit(1);
  } else {
    die('使い方: node classroom.mjs setup|status|courses|map|unmap|post（ファイルの先頭を見る）', 2);
  }
}
