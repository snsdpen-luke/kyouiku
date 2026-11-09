// 制御クイズ100 のリグレッション（jsdom）。問題データの点検と、最初から最後まで解く操作を確かめる。
//   node regression-seigyo100.js 制御クイズ100.html
const fs = require('fs');
const { JSDOM } = require('jsdom');
const file = process.argv[2] || '制御クイズ100.html';
const html = fs.readFileSync(file, 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra ? '  → ' + extra : '')); }
}
function open(store) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.test/seigyo100/',
    beforeParse(w) {
      if (store) w.localStorage.setItem('seigyo100-v3', store);
      // 実環境（Classroom のサンドボックス）では confirm が常に false を返す
      w.confirm = () => false; w.alert = () => { throw new Error('alert は使わない'); };
    },
  });
  return dom.window;
}
const vars = w => w.eval('({Q,RAW,GLOSS,CH,KIND,st,LET})');
const click = (w, sel) => { const el = w.document.querySelector(sel); if (!el) throw new Error('ない: ' + sel); el.click(); };

console.log('■ 問題データ');
{
  const w = open(); const { Q, RAW, GLOSS, CH, KIND } = vars(w);
  ok('問題は150問', Q.length === 150, Q.length);
  ok('出題順に全問が1回ずつ入っている', new Set(Q.map(q => q.id)).size === 150);
  ok('どの問題も選択肢は5つ', Q.every(q => q.o.length === 5));
  ok('同じ問題の中に同じ選択肢がない', Q.every(q => new Set(q.o).size === 5), Q.filter(q => new Set(q.o).size !== 5).map(q => q.id));
  ok('空の文字がない', Q.every(q => q.q && q.e && q.w && q.o.every(Boolean)));
  const dup = Q.map(q => q.q).filter((s, i, a) => a.indexOf(s) !== i);
  ok('問題文の重複がない', dup.length === 0, dup);
  // 正解の文がそのまま別の問題の正解になっていないか（同じことを2回聞いていないか）
  const dupA = Q.map(q => q.o[0]).filter((s, i, a) => a.indexOf(s) !== i);
  // センサ名や機能名だけの短い答えは、別の問いで重なってよい
  ok('正解の文の重複がない', dupA.filter(s => s.length > 14).length === 0, dupA);
  ok('どの問題の用語にも説明がある', Q.every(q => GLOSS[q.w]), Q.filter(q => !GLOSS[q.w]).map(q => q.w));
  const banned = /PLC|ラダー|シーケンス|フィードバック|PID|インターロック|自己保持|掃除機|接点|積分|微分|偏差|ゲイン|クリープ|すえ切り|Arduino|Trig/;
  const hit = Q.filter(q => banned.test([q.w, q.q, q.e, ...q.o].join(' '))).map(q => q.id + ':' + q.w);
  ok('PLC・フィードバック制御・制御でない用語の問題がない', hit.length === 0 && !Q.some(q => q.w === '切り返し'), hit);
  ok('使われていない用語の説明がない', Object.keys(GLOSS).every(k => Q.some(q => q.w === k)), Object.keys(GLOSS).filter(k => !Q.some(q => q.w === k)));
  ok('解説が短い（70文字まで）', Q.every(q => q.e.length <= 70), Q.filter(q => q.e.length > 70).map(q => q.id + ':' + q.e.length));
  ok('解説が です・ます で終わる', Q.every(q => /(す|した|ます)。$/.test(q.e) || /[。）]$/.test(q.e)));
  ok('「すべて」「どれでもない」系の選択肢がない', !Q.some(q => q.o.some(o => /上のすべて|どれでもない|いずれでもない/.test(o))));
  const cnt = (f) => { const c = {}; Q.forEach(q => { const k = f(q); c[k] = (c[k] || 0) + 1; }); return c; };
  const byG = cnt(q => q.g), byT = cnt(q => q.t), byD = cnt(q => q.d);
  console.log('    分野', JSON.stringify(byG), '種類', JSON.stringify(byT), '難しさ', JSON.stringify(byD));
  ok('分野は30問ずつ', Object.keys(CH).every(g => byG[g] === 30));
  ok('4種類がそろう（意味40・用語40・使いどころ35・場面35）', byT.m === 40 && byT.r === 40 && byT.u === 35 && byT.b === 35, JSON.stringify(byT));
  ok('難しさ：やさしい問題が少なく、難しい問題が多い', byD[1] <= 30 && byD[3] >= 35, JSON.stringify(byD));
  ok('どの分野にも4種類が7問以上', Object.keys(CH).every(g => Object.keys(KIND).every(t => Q.filter(q => q.g === g && q.t === t).length >= 7)));
  ok('どの分野にも3段階がある', Object.keys(CH).every(g => [1, 2, 3].every(d => Q.filter(q => q.g === g && q.d === d).length >= 2)));
  ok('同じ分野が続かない', Q.every((q, i) => i === 0 || Q[i - 1].g !== q.g));
  // 長さで正解が分かってしまわないか
  const longest = Q.filter(q => q.o[0].length > Math.max(...q.o.slice(1).map(s => s.length)));
  console.log('    正解が単独でいちばん長い問題', longest.length);
  ok('正解だけが長い問題が多すぎない（全体の35%まで）', longest.length <= Q.length * 0.35, longest.length);
  // 用語を当てる問題（r）は用語名の長さが元からばらばらなので、文で答える問題だけを見る
  const far = Q.filter(q => q.t !== 'r' && q.o[0].length > 1.5 * Math.max(...q.o.slice(1).map(s => s.length)));
  ok('正解だけが極端に長い問題がない', far.length === 0, far.map(q => q.id));
}

console.log('■ 正解の位置');
{
  const totals = [0, 0, 0, 0, 0]; let sameAll = true, first = null;
  for (let t = 0; t < 30; t++) {
    const w = open(); click(w, '#go');
    const pos = [];
    w.eval('Q').forEach((q, i) => { const a = w.eval(`order(${i})`); pos.push(a.indexOf(0)); });
    const c = [0, 0, 0, 0, 0]; pos.forEach(p => { c[p]++; totals[p]++; });
    if (!c.every(n => n === 30)) ok('ア〜オが30問ずつ', false, c);
    if (!pos.every((v, k) => k < 2 || !(v === pos[k - 1] && v === pos[k - 2]))) ok('同じ位置が3問続かない', false, pos.join(''));
    if (first == null) first = pos.join(''); else if (first !== pos.join('')) sameAll = false;
    w.close();
  }
  ok('30人分すべて ア〜オが30問ずつ・3問続かない', totals.every(n => n === 900), totals);
  ok('解く人ごとに正解の位置が違う', !sameAll);
}

console.log('■ 最初から最後まで解く');
{
  const w = open(); const d = w.document;
  ok('出席番号の欄がない', !d.getElementById('no') && !d.querySelector('.card').textContent.includes('出席番号'));
  click(w, '#go');
  ok('始めると1問目', d.getElementById('count').textContent === '1 / 150');
  ok('選択肢のボタンが5つ', d.querySelectorAll('.opt').length === 5);
  ok('答える前は「次へ」がない', !d.getElementById('next'));
  ok('答える前は解説が出ない', !d.querySelector('.fb'));
  ok('答える前は用語欄に答えが出ない', !!d.querySelector('.gloss .wait'));
  const Q = w.eval('Q');
  // 5問おきにわざと間違える（＝120問正解）
  for (let i = 0; i < 150; i++) {
    const pickRight = i % 5 !== 0;
    const btn = [...d.querySelectorAll('.opt')].find(b => (b.dataset.k === '0') === pickRight);
    btn.click();
    if (i === 0) {
      ok('間違えると 正解は「」です と解説', /正解は「[アイウエオ]」です。/.test(d.querySelector('.fb.ng').textContent) && d.querySelector('.fb').textContent.includes(Q[0].e));
      ok('正解のボタンが緑・選んだボタンが赤', !!d.querySelector('.opt.right[data-k="0"]') && !!d.querySelector('.opt.wrong'));
      ok('答えたら用語欄に説明', d.querySelector('.gloss dt').textContent === Q[0].w);
      ok('答えたらボタンを押せなくなる', [...d.querySelectorAll('.opt')].every(b => b.disabled));
    }
    if (i === 1) ok('正解すると「正解です。」', d.querySelector('.fb.ok').textContent.startsWith('正解です。'));
    click(w, '#next');
  }
  ok('150問のあとは結果の画面', !!d.querySelector('.res-total'));
  ok('採点：150問中120問正解', d.querySelector('.res-total').textContent === '120');
  ok('分野ごとのバーが5本', d.querySelectorAll('.bars .bar').length === 5);
  const barSum = [...d.querySelectorAll('.bar .num')].reduce((s, e) => s + parseInt(e.textContent, 10), 0);
  ok('バーの合計が総得点と同じ', barSum === 120, barSum);
  ok('まちがえた問題の番号が30個', d.querySelectorAll('.miss button').length === 30);
  ok('先生に見せる案内がない', !d.querySelector('.card').textContent.includes('先生'));
  ok('全問解いたら「続きをとく」は出ない', !d.getElementById('cont'));
  d.querySelector('.miss button').click();
  ok('番号を押すとその問題へ', d.getElementById('count').textContent === '1 / 150' && !!d.querySelector('.fb.ng'));
  click(w, '#toRes');
  // 開き直しても残る
  const saved = w.localStorage.getItem('seigyo100-v3');
  const w2 = open(saved);
  ok('開き直しても結果が残る', w2.document.querySelector('.res-total')?.textContent === '120');
  // やり直しは2回押し（confirm が false でも動く）
  click(w, '#reset');
  ok('やり直しの1回目では消えない', !!d.querySelector('.res-total'));
  click(w, '#reset');
  ok('2回目で消えて最初の画面へ', !!d.getElementById('go') && !d.querySelector('.res-total'));
  ok('やり直すと答えが空', Object.keys(w.eval('st').ans).length === 0);
}

console.log('■ 途中で結果を見る');
{
  const w = open(); const d = w.document;
  click(w, '#go');
  for (let i = 0; i < 3; i++) { d.querySelector('.opt[data-k="0"]').click(); click(w, '#next'); }
  click(w, '#toRes');
  ok('途中でも採点が出る', d.querySelector('.res-total').textContent === '3');
  ok('解いた数が出る', d.querySelector('.card').textContent.includes('解いたのは 3 問'));
  click(w, '#cont');
  ok('続きをとくと4問目', d.getElementById('count').textContent === '4 / 150');
}

console.log('■ localStorage が使えないとき');
{
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.test/',
    beforeParse(w) { Object.defineProperty(w, 'localStorage', { get() { throw new Error('blocked'); } }); },
  });
  const d = dom.window.document;
  d.getElementById('go').click();
  ok('保存できなくても解ける', d.getElementById('count').textContent === '1 / 150' && d.querySelectorAll('.opt').length === 5);
}

console.log(`\n合格 ${pass}　不合格 ${fail}`);
console.log(fail ? '不合格があります' : 'すべて合格');
process.exit(fail ? 1 : 0);
