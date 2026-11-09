// ふりかえり演習（/review1/）のリグレッション（jsdom）。問題データの点検と、最初から最後まで解く操作・採点を確かめる。
//   node regression-review1.js ふりかえり演習.html
const fs = require('fs');
const { JSDOM } = require('jsdom');
const file = process.argv[2] || 'ふりかえり演習.html';
const html = fs.readFileSync(file, 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra) : '')); }
}
function open(store) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.test/review1/',
    beforeParse(w) {
      if (store) w.localStorage.setItem('fukushu-v5', store);
      // 実環境（Classroom のサンドボックス）では confirm が常に false を返す
      w.confirm = () => false; w.alert = () => { throw new Error('alert は使わない'); };
    },
  });
  return dom.window;
}
const vars = w => w.eval('({Q,CH,BANK,KEY,st,LET})');
const $ = (w, sel) => w.document.querySelector(sel);
const click = (w, sel) => { const el = $(w, sel); if (!el) throw new Error('ない: ' + sel); el.click(); };

console.log('■ 問題データ');
{
  const w = open(); const { Q, CH, BANK } = vars(w);
  const cnt = t => Q.filter(q => q.t === t).length;
  ok('全部で100問（用語31・選択63・記述6）', Q.length === 100 && cnt('term') === 31 && cnt('one') + cnt('multi') === 63 && cnt('w') === 6,
    { all: Q.length, term: cnt('term'), choice: cnt('one') + cnt('multi'), w: cnt('w') });
  ok('どの問題も章（A〜F）がある', Q.every(q => CH[q.s]));
  ok('章Fの問題がある（用語5・選択13・記述1）',
    Q.filter(q => q.s === 'F' && q.t === 'term').length === 5 &&
    Q.filter(q => q.s === 'F' && (q.t === 'one' || q.t === 'multi')).length === 13 &&
    Q.filter(q => q.s === 'F' && q.t === 'w').length === 1);
  ok('部の順（用語→選択→記述）に並んでいる', Q.every((q, i) => i === 0 || { term: 1, one: 2, multi: 2, w: 3 }[Q[i - 1].t] <= { term: 1, one: 2, multi: 2, w: 3 }[q.t]));
  ok('用語の一覧に重複がない', new Set(BANK).size === BANK.length, BANK.filter((s, i, a) => a.indexOf(s) !== i));
  ok('用語の正解はすべて一覧にある', Q.filter(q => q.t === 'term').every(q => BANK.includes(q.a[0])));
  ok('用語の説明に、答えの言葉そのものが入っていない', Q.filter(q => q.t === 'term').every(q => !q.q.includes(q.a[0])),
    Q.filter(q => q.t === 'term' && q.q.includes(q.a[0])).map(q => q.a[0]));
  const ch = Q.filter(q => q.t === 'one' || q.t === 'multi');
  ok('1つ選ぶ問題の正解は選択肢の範囲内', ch.filter(q => q.t === 'one').every(q => Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length));
  ok('すべて選ぶ問題の正解は2つ以上・選択肢の範囲内・全部ではない', ch.filter(q => q.t === 'multi').every(q => q.a.length >= 2 && q.a.length < q.o.length && q.a.every(k => k >= 0 && k < q.o.length)));
  ok('選択肢は4〜6つ（ア〜カで足りる）', ch.every(q => q.o.length >= 4 && q.o.length <= 6));
  ok('同じ問題の中に同じ選択肢がない', ch.every(q => new Set(q.o).size === q.o.length), ch.filter(q => new Set(q.o).size !== q.o.length).map(q => q.q.slice(0, 20)));
  ok('選択問題には解説がある', ch.every(q => q.e && q.e.length > 5));
  ok('記述問題には模範解答と観点2つがある', Q.filter(q => q.t === 'w').every(q => q.m && q.k.length === 2));
  const dup = Q.map(q => q.q).filter((s, i, a) => a.indexOf(s) !== i);
  ok('問題文の重複がない', dup.length === 0, dup);
  ok('家の中用の住所（10.x）を外の住所として使っていない', !Q.some(q => /10\.20\.30\.40/.test(q.q + (q.o || []).join())));
  ok('confirm / alert を使っていない', !/\bconfirm\(|\balert\(/.test(html.replace(/w\.confirm|w\.alert/g, '')));
  ok('ダークモードの色の切りかえがない（ライト固定）', !/prefers-color-scheme:\s*dark|data-theme="dark"/.test(html) && html.includes('content="light"'));
  ok('外への通信がない', !/fetch\(|XMLHttpRequest|sendBeacon/.test(html));
}

console.log('■ 開始画面');
{
  const w = open();
  const t = $(w, '#card').textContent;
  ok('「6回の授業」と出る', t.includes('これまでの6回の授業'), t.slice(0, 40));
  const { BANK } = vars(w);
  ok('用語の数が一覧の数と合う', t.includes(BANK.length + '個の用語'));
  ok('出席番号の欄がない', !$(w, '#no') && !t.includes('出席番号'));
  click(w, '#go');
  ok('「はじめる」で1問目へ', vars(w).st.i === 0);
}

// 全問を解く。good=true なら全部正解、false なら全部まちがえる
function playAll(good) {
  const w = open(); click(w, '#go');
  const { Q, LET } = vars(w);
  for (let i = 0; i < Q.length; i++) {
    const q = Q[i]; const st = w.eval('st');
    if (st.i !== i) throw new Error('進んでいない: ' + i);
    if (q.t === 'term') {
      const want = good ? q.a[0] : [...w.document.querySelectorAll('.bank .opt')].map(b => b.dataset.w).find(x => x !== q.a[0]);
      [...w.document.querySelectorAll('.bank .opt')].find(b => b.dataset.w === want).click();
    } else if (q.t === 'one') {
      const k = good ? q.a : (q.a + 1) % q.o.length;
      click(w, `.opt[data-k="${k}"]`);
    } else if (q.t === 'multi') {
      const ks = good ? q.a : [q.a[0]];
      ks.forEach(k => click(w, `.opt[data-k="${k}"]`));
      click(w, '#go');
    } else {
      $(w, '#ta').value = 'ここに自分の答えを書きました。'; $(w, '#ta').dispatchEvent(new w.Event('input'));
      click(w, '#show'); click(w, '.self .opt[data-k="0"]');
    }
    const fb = $(w, '.fb');
    if (q.t !== 'w') {
      const ok1 = fb && fb.classList.contains(good ? 'ok' : 'ng');
      if (!ok1) throw new Error(`判定がおかしい: ${i} ${q.q.slice(0, 20)}`);
      if (!good && q.t !== 'term') {
        // 「正解は「…」です」の記号が、緑の枠の選択肢と合っている
        const right = [...w.document.querySelectorAll('.opt.right, .opt.miss')].map(b => b.querySelector('.mk').textContent).sort().join('・');
        if (!fb.textContent.includes('正解は「' + right + '」')) throw new Error(`正解の表示がずれている: ${i}`);
      }
    }
    click(w, '#next');
  }
  return w;
}
console.log('■ 全部正解で解く');
{
  let w, err;
  try { w = playAll(true); } catch (e) { err = e.message; }
  ok('最後まで進める（全部正解）', !err, err);
  if (w) {
    const t = $(w, '#card').textContent;
    ok('結果が 94 / 94', t.includes('94 / 94 問 正解'), t.slice(0, 60));
    ok('結果に出席番号が出ない', !t.includes('出席番号'));
    ok('結果に6つの章のバーがある', w.document.querySelectorAll('.bar').length === 6);
    ok('サトシ・ナカモト事件ファイルのバーが 18/18', [...w.document.querySelectorAll('.bar')].some(b => b.textContent.includes('サトシ') && b.textContent.includes('18/18')));
    ok('記述は6問とも「できた」', (t.match(/できた/g) || []).length >= 6);
  }
}
console.log('■ 全部まちがえて解く');
{
  let w, err;
  try { w = playAll(false); } catch (e) { err = e.message; }
  ok('最後まで進める（全部不正解・正解の表示がずれない）', !err, err);
  if (w) ok('結果が 0 / 94', $(w, '#card').textContent.includes('0 / 94 問 正解'));
}
console.log('■ 保存と再開');
{
  const w1 = open(); click(w1, '#go');
  const q0 = vars(w1).Q[0];
  [...w1.document.querySelectorAll('.bank .opt')].find(b => b.dataset.w === q0.a[0]).click(); click(w1, '#next');
  const saved = w1.localStorage.getItem('fukushu-v5');
  const w2 = open(saved);
  ok('開き直すと続きから（2問目）', vars(w2).st.i === 1);
  const w3 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/review1/', beforeParse(w) {
    Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } }); } }).window;
  ok('localStorage が使えなくても開始画面が出る', $(w3, '#go') !== null);
}
console.log(`\n合格 ${pass} / 不合格 ${fail}`);
process.exit(fail ? 1 : 0);
