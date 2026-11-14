// 問題の査定用の一覧を作る。剛さんが自分の目で問題を見て、消す・直す番号を返すためのもの。
//   node .claude/skills/mondai/ichiran.mjs <本体>.html <問題の配列の名前> [<名前> …] > 一覧.md
//   例: node .claude/skills/mondai/ichiran.mjs 制御クイズ100.html Q
//       node .claude/skills/mondai/ichiran.mjs ふりかえり演習.html Q U
// 本体を jsdom で開き、配列を Markdown にする。形の違う問題（5択・語群・すべて選ぶ・数・記述・組み合わせ）を
// できるだけそのまま出す。選択肢の正解に ◎。正解の書き方の約束：
//   a が数 → その番号の選択肢 / a が数の配列 → その番号全部 / a がない → 先頭（正解を先頭に書く約束）
//   a が文字（の配列）→ 答えとして書く
import fs from 'fs';
import path from 'path';
import { createRequire } from 'module';
const require = createRequire(path.resolve('package.json'));
const { JSDOM } = require('jsdom');

const [file, ...names] = process.argv.slice(2);
if (!file || !names.length) { console.error('使い方: node ichiran.mjs <本体>.html <配列の名前> [...]'); process.exit(2); }
const w = new JSDOM(fs.readFileSync(file, 'utf8'), {
  runScripts: 'dangerously', url: 'https://example.test/ichiran/',
  beforeParse(w) { w.confirm = () => false; w.alert = () => {}; w.prompt = () => null; },
}).window;

const KNOWN = new Set(['id', 'g', 's', 't', 'd', 'w', 'q', 'o', 'a', 'e', 'sc']);
const one = s => String(s).replace(/\s*\n\s*/g, ' ');
const out = [`# 問題の一覧（査定用）— ${path.basename(file)}`, '', '消す・直す問題は番号で返してください。◎ が正解です。', ''];

for (const name of names) {
  let arr;
  try { arr = w.eval(name); } catch { console.error(`${name} が見つからない`); process.exit(1); }
  if (!Array.isArray(arr)) { console.error(`${name} は配列でない`); process.exit(1); }
  out.push(`## ${name}（${arr.length}問）`, '');
  arr.forEach((x, i) => {
    const no = i + 1;
    if (Array.isArray(x)) { out.push(`${no}. ${x.map(v => typeof v === 'object' ? JSON.stringify(v) : one(v)).join(' ｜ ')}`, ''); return; }
    if (typeof x !== 'object' || !x) { out.push(`${no}. ${one(x)}`, ''); return; }
    const tag = ['id', 'g', 's', 't', 'd'].filter(k => x[k] != null).map(k => `${k}:${x[k]}`).join(' ');
    out.push(`${no}. **${one(x.q ?? x.w ?? '')}**${tag ? `　〔${tag}${x.w && x.q ? ' 用語:' + x.w : ''}〕` : ''}`);
    if (x.sc) out.push(`   - 場面：${one(x.sc)}`);
    if (Array.isArray(x.o)) {
      const right = typeof x.a === 'number' ? [x.a] : Array.isArray(x.a) && x.a.every(v => typeof v === 'number') ? x.a : x.a == null ? [0] : [];
      x.o.forEach((o, j) => out.push(`   - ${right.includes(j) ? '◎' : '　'} ${one(typeof o === 'object' ? JSON.stringify(o) : o)}`));
      if (!right.length && x.a != null) out.push(`   - 答え：${[].concat(x.a).join(' / ')}`);
    } else if (x.a != null) {
      out.push(`   - 答え：${[].concat(x.a).map(v => typeof v === 'object' ? JSON.stringify(v) : v).join(' / ')}`);
    }
    for (const k of Object.keys(x)) if (!KNOWN.has(k)) out.push(`   - ${k}：${one(JSON.stringify(x[k]))}`);
    if (x.e) out.push(`   - 解説：${one(x.e)}`);
    out.push('');
  });
}
process.stdout.write(out.join('\n') + '\n');
