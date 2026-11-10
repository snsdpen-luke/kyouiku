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
function open(store, mode = 'drill', test) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.test/seigyo100/',
    beforeParse(w) {
      if (store) w.localStorage.setItem('seigyo100-v4', store);
      if (mode) w.localStorage.setItem('seigyo100-mode', mode);
      if (test) w.localStorage.setItem('seigyo100-test-v2', test);
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
  // フィードバック制御・シーケンス制御・偏差は授業でやったので使う（2026-11-11 剛さん）。Arduino とラダー（PLC）は出さない
  const banned = /PLC|ラダー|PID|インターロック|自己保持|掃除機|接点|積分|微分|ゲイン|クリープ|すえ切り|Arduino|Trig|pulseIn|HC-SR04/;
  const hit = Q.filter(q => banned.test([q.w, q.q, q.e, ...q.o].join(' '))).map(q => q.id + ':' + q.w);
  ok('Arduino・ラダー（PLC）・制御でない用語の問題がない', hit.length === 0 && !Q.some(q => q.w === '切り返し'), hit);
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
  const saved = w.localStorage.getItem('seigyo100-v4');
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
  ok('保存できなくても最初はメニュー', !!d.getElementById('mDrill') && !!d.getElementById('mTest'));
  d.getElementById('mDrill').click();
  d.getElementById('go').click();
  ok('保存できなくても解ける', d.getElementById('count').textContent === '1 / 150' && d.querySelectorAll('.opt').length === 5);
}

console.log('■ メニュー');
{
  const w = open(null, null); const d = w.document;
  ok('初めて開くとメニュー', !!d.getElementById('mDrill') && !!d.getElementById('mTest') && d.getElementById('menuBtn').hidden);
  click(w, '#mDrill');
  ok('練習を選ぶと練習の最初の画面', !!d.getElementById('go') && !d.getElementById('no') && !d.getElementById('menuBtn').hidden);
  click(w, '#tomenu'); click(w, '#mTest');
  ok('小テストを選ぶと出席番号の欄', !!d.getElementById('no'));
  ok('選んだほうを覚える', w.localStorage.getItem('seigyo100-mode') === 'test');
  w.close();
}

console.log('■ 小テスト：組み立て');
{
  for (let t = 0; t < 20; t++) {
    const w = open(null, 'test'); const d = w.document;
    d.getElementById('no').value = '２１０５'; click(w, '#go');
    const ts = w.eval('ts'), Q = w.eval('Q'), QID = Object.fromEntries(Q.map(q => [q.id, q]));
    const bad = [];
    if (ts.no !== '2105') bad.push('全角の出席番号 ' + ts.no);
    if (ts.stages.length !== 6) bad.push('ステージ数');
    const total = ts.stages.reduce((a, S) => a + S.qs.length, 0);
    if (total !== 50) bad.push('合計 ' + total);
    ts.stages.forEach((S, s) => {
      const qs = S.qs.map(id => QID[id]), ans = qs.map(q => q.o[0]);
      if (new Set(ans).size !== ans.length) bad.push(s + ':正解が重なる');
      if (!ans.every(a => S.bank.includes(a))) bad.push(s + ':正解が語群にない');
      if (S.bank.length !== S.qs.length + 4 || new Set(S.bank).size !== S.bank.length) bad.push(s + ':語群の数');
      // 誤りの語は、どれかの問題で「誤り」として作られた言葉だけ（別の問題の正解になりうる言葉を入れない）
      const extra = S.bank.filter(b => !ans.includes(b));
      if (!extra.every(b => qs.some(q => q.o.slice(1).includes(b)))) bad.push(s + ':語群の出どころ');
      if (s < 5 && !(S.qs.length === 8 && qs.every(q => q.g === S.g && q.t === 'r'))) bad.push(s + ':分野ステージ');
      if (s === 5 && !(S.qs.length === 10 && qs.every(q => q.t !== 'r'))) bad.push('ボス');
    });
    if (ts.stages[0].sec !== 240 || ts.stages[5].sec !== 300) bad.push('制限時間');
    if (bad.length) { ok('20回組み立てて崩れない', false, bad.join(' ')); break; }
    if (t === 19) ok('20回組み立てて崩れない（6ステージ・50問・語群は正解＋4語・正解の重なりなし）', true);
    w.close();
  }
}

console.log('■ 小テスト：通しで受ける');
(async () => {
  const w = open(null, 'test'); const d = w.document;
  click(w, '#go');
  ok('出席番号が4けたでないと始まらない', d.getElementById('nomsg').textContent.includes('4けた') && !w.eval('ts.stages'));
  d.getElementById('no').value = '2105'; click(w, '#go');
  ok('始めるとSTAGE 1 の説明（時間はまだ動かない）', d.querySelector('.big').textContent === 'STAGE 1' && w.eval('ts.phase') === 'intro');
  click(w, '#play');
  ok('スタートで制限時間 4:00', d.getElementById('tm').textContent === '4:00' && w.eval('ts.phase') === 'play');
  ok('問題中はメニューボタンを出さない', d.getElementById('menuBtn').hidden);
  ok('語群が12語', d.querySelectorAll('.bank .opt').length === 12);
  const QID = w.eval('QID');
  const right = (s, k) => QID[w.eval('ts').stages[s].qs[k]].o[0];
  const pick = word => [...d.querySelectorAll('.bank .opt')].find(b => b.dataset.w === word).click();
  pick(right(0, 0));
  ok('選ぶと次の問題へ進む', w.eval('ts.i') === 1 && d.querySelector('.dots button.fill')?.dataset.j === '0');
  pick(right(0, 0));
  ok('ほかの問題で使った語を選ぶと、こちらへ移る', w.eval('ts.ans[0][1]') === right(0, 0) && w.eval('ts.ans[0][0]') == null);
  d.querySelector('.dots button[data-j="0"]').click();
  ok('番号を押すとその問題へ', w.eval('ts.i') === 0);
  pick(right(0, 0));
  d.querySelector('.dots button[data-j="0"]').click();
  ok('同じ語をもう一度押すと空欄にもどる', (pick(right(0, 0)), w.eval('ts.ans[0][0]') == null));
  d.querySelector('.dots button[data-j="0"]').click(); pick(right(0, 0));
  // ステージ1：8問中6問正解（2問は空欄）で終える
  for (let k = 1; k < 6; k++) { d.querySelector(`.dots button[data-j="${k}"]`).click(); pick(right(0, k)); }
  click(w, '#fin');
  ok('空欄があると1回目の「終える」では終わらない', w.eval('ts.phase') === 'play' && d.getElementById('fin').textContent.includes('まだ2問'));
  click(w, '#fin');
  ok('2回目で採点：6/8・★★', d.querySelector('.res-total').textContent === '6' && d.querySelectorAll('.stars .off')[0]?.textContent === '★' && d.querySelector('.big').textContent === 'STAGE CLEAR!');
  ok('答え合わせに未回答と正解が出る', d.querySelector('.card').textContent.includes('未回答') && d.querySelectorAll('.rv').length === 8);
  click(w, '#nextS');
  ok('次はSTAGE 2', d.querySelector('.big').textContent === 'STAGE 2');
  // ステージ2：全問正解
  click(w, '#play');
  for (let k = 0; k < 8; k++) { d.querySelector(`.dots button[data-j="${k}"]`).click(); pick(right(1, k)); }
  ok('全部答えるとボタンが「採点する」', d.getElementById('fin').textContent === '採点する');
  click(w, '#fin');
  ok('全問正解で PERFECT!', d.querySelector('.big').textContent === 'PERFECT!' && d.querySelector('.stars .off').textContent === '');
  click(w, '#nextS');
  // ステージ3：時間切れ（3問正解したところで締め切りを過ぎる）
  click(w, '#play');
  for (let k = 0; k < 3; k++) pick(right(2, k));
  const saved = w.localStorage.getItem('seigyo100-test-v2');
  const late = JSON.parse(saved); late.dl = Date.now() - 1;
  const w2 = open(null, 'test', JSON.stringify(late)); const d2 = w2.document;
  ok('開き直して締め切りを過ぎていたら、そこまでで採点（TIME UP）', d2.querySelector('.warn')?.textContent.includes('TIME UP') && d2.querySelector('.res-total').textContent === '3');
  ok('3/8 は ★なし・もう一歩', d2.querySelector('.big').textContent.startsWith('もう一歩') && d2.querySelectorAll('.stars .off')[0].textContent === '★★★');
  // 開き直しても時間は戻らない
  const mid = JSON.parse(saved); mid.dl = Date.now() + 61000;
  const w3 = open(null, 'test', JSON.stringify(mid));
  ok('開き直しても残り時間は締め切りから計算（1:01）', w3.document.getElementById('tm').textContent === '1:01' && !w3.document.getElementById('tbar').classList.contains('hot'));
  w3.close();
  // w2 で続ける：ステージ4・5 は答えずに終える、ボスは全問正解
  const W = w2, D = d2; const right2 = (s, k) => W.eval('QID')[W.eval('ts').stages[s].qs[k]].o[0];
  const pick2 = word => [...D.querySelectorAll('.bank .opt')].find(b => b.dataset.w === word).click();
  click(W, '#nextS');
  for (const s of [3, 4]) { click(W, '#play'); click(W, '#fin'); click(W, '#fin'); click(W, '#nextS'); }
  ok('最後はボスステージ（5分・10問・語群14語）', D.querySelector('.big').textContent === 'BOSS STAGE');
  click(W, '#play');
  ok('ボスの制限時間 5:00', D.getElementById('tm').textContent === '5:00' && D.querySelectorAll('.bank .opt').length === 14);
  for (let k = 0; k < 10; k++) { D.querySelector(`.dots button[data-j="${k}"]`).click(); pick2(right2(5, k)); }
  click(W, '#fin');
  ok('ボスを全問正解', D.querySelector('.res-total').textContent === '10');
  ok('最後のステージのあとは「提出へ」', D.getElementById('nextS').textContent === '提出へ');
  click(W, '#nextS');
  ok('提出の画面に出席番号と点数（6+8+3+0+0+10=27）', !!D.getElementById('send') && D.querySelector('.card').textContent.includes('2105') && D.querySelector('.card').textContent.includes('27 / 50 点'));
  ok('ランクは出さない', !D.querySelector('.card').textContent.includes('ランク'));
  click(W, '#send');
  ok('提出を押すと「送信しています」', D.querySelector('.card').textContent.includes('送信しています'));
  await new Promise(r => setTimeout(r, 1700));
  ok('しばらくすると「提出しました」', D.querySelector('.cert .big')?.textContent === '提出しました' && D.querySelector('.cert .score').textContent === '27');
  ok('ランク・回数・受け直しがない', !D.querySelector('.card').textContent.includes('ランク') && !D.querySelector('.card').textContent.includes('回目') && !D.getElementById('retry'));
  ok('ステージごとのバーが6本で、合計が点数と同じ', D.querySelectorAll('.cert .bar').length === 6 && [...D.querySelectorAll('.cert .num')].reduce((a, e) => a + parseInt(e.textContent, 10), 0) === 27);
  ok('時間切れのステージに印', D.querySelectorAll('.cert .num')[2].textContent.includes('⏱'));
  const w4 = open(null, 'test', W.localStorage.getItem('seigyo100-test-v2'));
  ok('開き直しても「提出しました」のまま（受け直せない）', w4.document.querySelector('.cert .score')?.textContent === '27' && !w4.document.getElementById('no'));
  w4.close();
  click(W, '#tomenu');
  ok('メニューに「提出済み」と点', D.getElementById('mTest').textContent.includes('提出済み（27 / 50 点）'));
  click(W, '#mTest');
  ok('メニューから入っても提出済みの画面', !!D.querySelector('.cert') && !D.getElementById('go'));
  ok('練習の記録は小テストで変わらない', W.eval('Object.keys(st.ans).length') === 0);
  w.close(); W.close();

  done();
})();
function done() {
console.log(`\n合格 ${pass}　不合格 ${fail}`);
console.log(fail ? '不合格があります' : 'すべて合格');
process.exit(fail ? 1 : 0);
}
