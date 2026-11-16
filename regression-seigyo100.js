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
const vars = w => w.eval('({Q:QALL,RAW,GLOSS,CH,KIND,st,LET})');
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

console.log('■ 練習の選択問題（厳選50問）');
{
  // 2026-11-16 剛さん「本番の中間考査範囲としてふさわしい、難易度の得点バランスを考えた厳選50問」
  const w = open(); const P = w.eval('Q'), CH = w.eval('CH');
  const c = f => { const o = {}; P.forEach(q => { const k = f(q); o[k] = (o[k] || 0) + 1; }); return o; };
  const byG = c(q => q.g), byD = c(q => q.d), byT = c(q => q.t);
  console.log('    分野', JSON.stringify(byG), '難しさ', JSON.stringify(byD), '種類', JSON.stringify(byT));
  ok('50問・すべて150問の中にある', P.length === 50 && P.every(q => w.eval('QALL').includes(q)));
  ok('分野ごとに10問', Object.keys(CH).every(g => byG[g] === 10));
  ok('むずかしさ ★1:★2:★3 ＝ 12:23:15（どの分野にも ★1 2問以上・★3 3問）', byD[1] === 12 && byD[2] === 23 && byD[3] === 15 && Object.keys(CH).every(g => P.filter(q => q.g === g && q.d === 1).length >= 2 && P.filter(q => q.g === g && q.d === 3).length === 3));
  ok('どの分野にも、意味・用語・使いどころ・場面のうち3種類以上', Object.keys(CH).every(g => new Set(P.filter(q => q.g === g).map(q => q.t)).size >= 3));
  ok('同じ用語は1分野に2問まで（大事な用語は、ちがう問い方で2回）', Object.keys(CH).every(g => { const a = P.filter(q => q.g === g).map(q => q.w); return a.every(x => a.filter(y => y === x).length <= 2); }), Object.keys(CH).map(g => P.filter(q => q.g === g).map(q => q.w).filter((x, i, a) => a.indexOf(x) !== i)));
  ok('同じ分野が続かない', P.every((q, i) => i === 0 || P[i - 1].g !== q.g));
}

console.log('■ 練習：分野をえらぶ・記述の練習');
{
  const w = open(); const d = w.document;
  { const m = open(null, 'menu'); const tx = m.document.getElementById('mDrill').textContent;
    ok('メニューの練習に、合計と内訳（全58問：選択50＋記述8）が出る', tx.includes('全58問') && tx.includes('選択問題（5択）50問') && tx.includes('記述問題8問'), tx); m.close(); }
  ok('練習の最初の画面にも、合計と内訳が出る', d.querySelector('.card .q').textContent.includes('全58問') && d.querySelector('.card').textContent.includes('選択問題（5択）50問') && d.querySelector('.card').textContent.includes('記述問題 8問'));
  ok('練習の最初に、選択問題の分野ボタン5つ＋すべて、記述の分野ボタン5つ', !!d.getElementById('go') && d.querySelectorAll('[data-sg]').length === 5 && d.querySelectorAll('[data-kg]').length === 5);
  d.querySelector('[data-sg="C"]').click();
  ok('分野をえらぶと、その分野の10問だけ（1 / 10）', d.getElementById('count').textContent === '1 / 10' && w.eval('Q[st.i].g') === 'C');
  for (let i = 0; i < 10; i++) { d.querySelector('.opt[data-k="0"]').click(); click(w, '#next'); }
  ok('10問のあとは、その分野の結果（10 / 10・バー1本）', d.querySelector('.res-total').textContent === '10' && d.querySelectorAll('.bars .bar').length === 1 && d.querySelector('.card').textContent.includes('回転と速さを測る'));
  click(w, '#reset'); click(w, '#reset');
  ok('「この分野をやり直す」は、その分野の答えだけ消す', Object.keys(w.eval('st').ans).length === 0 && !!d.getElementById('go'));
  d.querySelector('[data-sg="A"]').click(); d.querySelector('.opt[data-k="0"]').click(); click(w, '#pick');
  d.querySelector('[data-kg="D"]').click();
  const KJ = w.eval('KJ');
  // 2026-11-16 剛さん「小テスト2回で出した問題を中心に絞ろう」
  ok('記述：小テスト第2回の記述8問と同じ（どの分野にも1問以上）', KJ.length === 8 && KJ.every(p => w.eval('T2')[p.n - 1].q === p.q) && ['A','B','C','D','E'].every(g => KJ.some(p => p.g === g)));
  ok('記述：観点の点の合計＝その問題の点・模範解答に指定語句が入る・字数の目安に入る', KJ.every(p => p.c.reduce((s, c) => s + c[2], 0) === p.pt && p.w.every(x => p.m.includes(x)) && [...p.m.replace(/\s/g, '')].length >= p.len[0] && [...p.m.replace(/\s/g, '')].length <= p.len[1]),
    KJ.filter(p => !(p.w.every(x => p.m.includes(x)) && [...p.m.replace(/\s/g, '')].length >= p.len[0] && [...p.m.replace(/\s/g, '')].length <= p.len[1])).map(p => p.id + ':' + [...p.m.replace(/\s/g, '')].length));
  const banned = /PLC|ラダー|PID|インターロック|自己保持|掃除機|接点|積分|微分|ゲイン|クリープ|すえ切り|Arduino|Trig|pulseIn|HC-SR04/;
  ok('記述：範囲の外の語がない・です・ます', !KJ.some(p => banned.test(JSON.stringify(p))) && KJ.every(p => /(なさい|ですか)。$/.test(p.q) && /す。$|）。$/.test(p.m) && /す。$/.test(p.kh)));
  ok('記述：レーダーの1問目・採点の基準と書き方のヒントが出て、答えはまだ出ない', d.getElementById('count').textContent === '1 / 1' && !!d.querySelector('.kijun') && !d.querySelector('.kans'));
  const ta = d.getElementById('kta'); ta.value = '得意と苦手。雨に強い'; ta.dispatchEvent(new w.Event('input'));
  ok('記述：指定語句が入るとしるしがつく', [...d.querySelectorAll('.wd.in')].length === 3);
  click(w, '#kshow');
  ok('記述：答え合わせで模範解答と自己採点の項目が出る', !!d.querySelector('.kans') && d.querySelectorAll('.kc').length === 3 && d.getElementById('kpt').textContent === '0');
  d.querySelectorAll('.kc')[0].click(); d.querySelectorAll('.kc')[2].click();
  ok('記述：押した項目の点が足される（2 / 3）', d.getElementById('kpt').textContent === '2');
  const w2 = open(w.localStorage.getItem('seigyo100-v4'));
  ok('記述：開き直しても、書いた答えと自己採点が残る', w2.document.getElementById('kta')?.value === '得意と苦手。雨に強い' && w2.document.getElementById('kpt')?.textContent === '2');
  click(w, '#kback2');
  ok('記述：分野をえらぶ画面にもどると、答え合わせ 1 / 1', d.querySelector('[data-kg="D"]').textContent.includes('1 / 1'));
}

console.log('■ 正解の位置');
{
  const totals = [0, 0, 0, 0, 0]; let sameAll = true, first = null;
  for (let t = 0; t < 30; t++) {
    const w = open(); click(w, '#go');
    const pos = [];
    w.eval('Q').forEach((q, i) => { const a = w.eval(`order(${i})`); pos.push(a.indexOf(0)); });
    const c = [0, 0, 0, 0, 0]; pos.forEach(p => { c[p]++; totals[p]++; });
    if (!c.every(n => n === 10)) ok('ア〜オが10問ずつ', false, c);
    if (!pos.every((v, k) => k < 2 || !(v === pos[k - 1] && v === pos[k - 2]))) ok('同じ位置が3問続かない', false, pos.join(''));
    if (first == null) first = pos.join(''); else if (first !== pos.join('')) sameAll = false;
    w.close();
  }
  ok('30人分すべて ア〜オが10問ずつ・3問続かない', totals.every(n => n === 300), totals);
  ok('解く人ごとに正解の位置が違う', !sameAll);
}

console.log('■ 最初から最後まで解く');
{
  const w = open(); const d = w.document;
  ok('出席番号の欄がない', !d.getElementById('no') && !d.querySelector('.card').textContent.includes('出席番号'));
  click(w, '#go');
  ok('始めると1問目', d.getElementById('count').textContent === '1 / 50');
  ok('選択肢のボタンが5つ', d.querySelectorAll('.opt').length === 5);
  ok('答える前は「次へ」がない', !d.getElementById('next'));
  ok('答える前は解説が出ない', !d.querySelector('.fb'));
  ok('答える前は用語欄に答えが出ない', !!d.querySelector('.gloss .wait'));
  const Q = w.eval('Q');
  // 5問おきにわざと間違える（＝40問正解）
  for (let i = 0; i < 50; i++) {
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
  ok('50問のあとは結果の画面', !!d.querySelector('.res-total'));
  ok('採点：50問中40問正解', d.querySelector('.res-total').textContent === '40');
  ok('分野ごとのバーが5本', d.querySelectorAll('.bars .bar').length === 5);
  const barSum = [...d.querySelectorAll('.bar .num')].reduce((s, e) => s + parseInt(e.textContent, 10), 0);
  ok('バーの合計が総得点と同じ', barSum === 40, barSum);
  ok('まちがえた問題の番号が10個', d.querySelectorAll('.miss button').length === 10);
  ok('先生に見せる案内がない', !d.querySelector('.card').textContent.includes('先生'));
  ok('全問解いたら「続きをとく」は出ない', !d.getElementById('cont'));
  d.querySelector('.miss button').click();
  ok('番号を押すとその問題へ', d.getElementById('count').textContent === '1 / 50' && !!d.querySelector('.fb.ng'));
  click(w, '#toRes');
  // 開き直しても残る
  const saved = w.localStorage.getItem('seigyo100-v4');
  const w2 = open(saved);
  ok('開き直しても結果が残る', w2.document.querySelector('.res-total')?.textContent === '40');
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
  ok('続きをとくと4問目', d.getElementById('count').textContent === '4 / 50');
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
  ok('保存できなくても解ける', d.getElementById('count').textContent === '1 / 50' && d.querySelectorAll('.opt').length === 5);
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
    const ts = w.eval('ts'), Q = w.eval('QALL'), QID = Object.fromEntries(Q.map(q => [q.id, q]));
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

  // 先生用デモ（#demo）：生徒の箱とは別。何度でも受け直せる
  const studentBox = W.localStorage.getItem('seigyo100-test-v2');
  const dom = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/seigyo100/#demo',
    beforeParse(x) { x.localStorage.setItem('seigyo100-mode', 'test'); x.localStorage.setItem('seigyo100-test-v2', studentBox); } });
  const dw = dom.window, dd = dw.document;
  ok('#demo で開くと、提出済みの生徒でも最初の画面（別の箱）', !!dd.getElementById('no') && !!dd.querySelector('.demo') && dd.getElementById('ttl').textContent.includes('先生用デモ'));
  dd.getElementById('no').value = '0000'; dd.getElementById('go').click();
  for (let s = 0; s < 6; s++) { dd.getElementById('dSkip').click(); dd.getElementById('nextS').click(); }
  ok('デモは「このステージをとばす」で最後まで進める', !!dd.getElementById('send'));
  dd.getElementById('send').click();
  await new Promise(r => setTimeout(r, 1700));
  ok('デモでも提出しました（0点）', dd.querySelector('.cert .score')?.textContent === '0');
  dd.getElementById('dReset').click();
  ok('デモは提出後も「最初からやり直す」で受け直せる', !!dd.getElementById('no') && dw.eval('ts.done') === null);
  ok('デモは生徒の箱を変えない', dw.localStorage.getItem('seigyo100-test-v2') === studentBox && !!dw.localStorage.getItem('seigyo100-test-demo'));
  const nd = open(null, 'test', studentBox);
  ok('#demo なしでは、デモの帯もやり直しボタンも出ない', !nd.document.querySelector('.demo') && !nd.document.getElementById('dReset'));
  nd.close(); dw.close();
  w.close(); W.close();

  // ===== 小テスト第2回（記述中心・40分） =====
  console.log('■ 小テスト第2回：問題データ');
  {
    const w = open(null, 'menu'); const { T2, T2MAX, T2AUTO } = w.eval('({T2,T2MAX,T2AUTO})');
    ok('13問・50点満点', T2.length === 13 && T2MAX === 50, T2.length + '問 ' + T2MAX + '点');
    ok('5分野がそろう（各2問以上）', Object.keys(w.eval('CH')).every(g => T2.filter(p => p.g === g).length >= 2));
    const nt = T2.filter(p => p.t === 'text').length, nn = T2.filter(p => p.t === 'num').length;
    ok('記述8問・計算4問・図1問', nt === 8 && nn === 4 && T2.filter(p => p.t === 'fig').length === 1, `${nt} ${nn}`);
    ok('記述が点の半分以上（記述が中心）', T2MAX - T2AUTO >= 25, T2MAX - T2AUTO);
    ok('記述の観点の点の合計が、その問題の点と同じ', T2.filter(p => p.t === 'text').every(p => p.c.reduce((a, c) => a + c[1], 0) === p.pt),
      T2.filter(p => p.t === 'text' && p.c.reduce((a, c) => a + c[1], 0) !== p.pt).map(p => p.q.slice(0, 12)));
    ok('指定語句は形の変わらない言葉（動詞でない）', T2.filter(p => p.t === 'text').every(p => p.w.every(x => !/(る|て|める|する)$/.test(x))), T2.flatMap(p => p.w || []).filter(x => /(る|て)$/.test(x)));
    ok('模範解答に指定語句がそのまま入っている', T2.filter(p => p.t === 'text').every(p => p.w.every(x => p.m.includes(x))),
      T2.filter(p => p.t === 'text' && !p.w.every(x => p.m.includes(x))).map(p => p.w.filter(x => !p.m.includes(x))));
    const len = t => [...t.replace(/\s/g, '')].length;
    ok('模範解答の長さが目安の字数に入る', T2.filter(p => p.t === 'text').every(p => len(p.m) >= p.len[0] && len(p.m) <= p.len[1]),
      T2.filter(p => p.t === 'text').map(p => len(p.m) + '/' + p.len).join(' '));
    const fig = T2.find(p => p.t === 'fig');
    ok('図：正解が語群に1回ずつあり、語群に重なりがない', fig.slots.every(s => fig.bank.filter(b => b === s[2]).length === 1) && new Set(fig.bank).size === fig.bank.length);
    // 計算の答えは教材のコードを使わずに計算し直す
    const indep = [340 * 0.008 / 2, 1.8 / 40 * 500 * 3.6, 90 / 3.6 * 2, 30 / ((72 - 54) / 3.6)];
    const nums = T2.filter(p => p.t === 'num');
    ok('計算の答えが計算し直した値と同じ（1.36 m・81 km/h・50 m・6 秒）', nums.every((p, j) => Math.abs(p.a - indep[j]) < 1e-9), nums.map(p => p.a).join(' '));
    ok('計算の問題文に、使う数がすべて出ている', nums.every(p => p.nums.every(n => p.q.includes(n[0]) || n[0] === '3.6')));
    ok('計算にヒントと模範の式がある', nums.every(p => p.hint && p.m));
    const banned = /PLC|ラダー|PID|インターロック|自己保持|掃除機|接点|積分|微分|ゲイン|クリープ|すえ切り|Arduino|Trig|pulseIn|HC-SR04/;
    ok('Arduino・ラダー（PLC）・範囲の外の語がない', !T2.some(p => banned.test(JSON.stringify(p))));
    // 2026-11-16 剛さん「専門用語については、補足をいれてほしい」。図の問題は空らんの説明が答えの手がかりなので付けない
    ok('図以外の問題に「ことば」の補足がある', T2.every(p => p.t === 'fig' ? !p.y : Array.isArray(p.y) && p.y.length && p.y.every(x => x[0] && x[1] && x[1].length <= 60)));
    ok('「ことば」の補足が答えを書いていない（計算の答えの数がない）', T2.filter(p => p.t === 'num').every(p => !p.y.some(x => x[1].includes(String(p.a)))));
    // 2026-11-16 剛さん「記述問題は採点の基準を生徒に明示しよう」「書き方のヒントを与えよう」
    ok('記述：生徒向けの採点の基準が、先生の観点と同じ数・同じ点', T2.filter(p => p.t === 'text').every(p => Array.isArray(p.k) && p.k.length === p.c.length && p.k.every((x, i) => x[1] === p.c[i][1])));
    ok('記述：書き方のヒントがある（です・ます）', T2.filter(p => p.t === 'text').every(p => p.kh && /す。$/.test(p.kh)));
    ok('記述：生徒向けの基準に指定語句以外の答えの言葉を出しすぎない（「短く出る」などの結論を書かない）', !T2.some(p => (p.k || []).some(x => /短く出ます|速くなります|ゆるめ/.test(x[0]))));
    ok('第13問は上り坂のクルーズコントロール（剛さん「13問目がむずかしい」2026-11-16）', /上り坂/.test(T2[12].q) && !/雪/.test(T2[12].q));
    ok('文が です・ます（問題文は「〜なさい。」「〜ですか。」）', T2.every(p => /(なさい|ですか|ますか|ます)。$|）。$/.test(p.q.replace(/（TTC）/, ''))));
    w.close();
  }

  console.log('■ 小テスト第2回：通しで受ける');
  {
    const w = open(null, 'test2'); const d = w.document;
    ok('メニューの「小テスト第2回」から開ける形（ボタンがある）', (() => { const m = open(null, 'menu'); const r = !!m.document.getElementById('mTest2') && m.document.getElementById('mTest').textContent.includes('第1回'); m.close(); return r; })());
    click(w, '#go');
    ok('出席番号が4けたでないと始まらない', d.getElementById('nomsg').textContent.includes('4けた') && w.eval('u2.dl') === 0);
    d.getElementById('no').value = '２１０５'; click(w, '#go');
    ok('全角の番号も受け付け、40分の締め切りが入る', w.eval('u2.no') === '2105' && Math.abs(w.eval('u2.dl') - Date.now() - 2400000) < 5000 && d.getElementById('tm').textContent === '40:00');
    ok('問題中はメニューボタンを出さない', d.getElementById('menuBtn').hidden);
    // 第1問：図。①②を正しく、③をまちがえる
    const T2 = w.eval('T2');
    const tap = w2 => [...d.querySelectorAll('.bank .opt')].find(b => b.dataset.w === w2).click();
    tap('ミリ波レーダー'); tap('ECU'); tap('車間時間');
    ok('図：選ぶと次の空らんへ進む', w.eval('u2.act') === 3 && w.eval('u2.ans[0][2]') === '車間時間');
    d.querySelector('.slot[data-j="2"]').click(); tap('TTC（衝突余裕時間）');
    ok('空らんを選び直して入れかえられる', w.eval('u2.ans[0][2]') === 'TTC（衝突余裕時間）');
    ok('図は4つ入れるまで「答えた」にならない', !w.eval('u2Has(0)'));
    // 第3問：計算（1.36）を電卓で出して入れる
    d.querySelector('.dots button[data-j="2"]').click();
    ok('計算の問題に電卓とヒントのボタン', !!d.getElementById('calc') && !!d.getElementById('hintBtn'));
    d.querySelector('.dots button[data-j="1"]').click();
    ok('記述の画面に採点の基準と書き方のヒントが出る', /採点の基準（5点）/.test(d.querySelector('.kijun')?.textContent || '') && /書き方のヒント/.test(d.querySelector('.kijun').textContent));
    d.querySelector('.dots button[data-j="2"]').click();
    ok('問題の下に「ことば」の補足が出る（第3問：超音波センサ）', (d.querySelector('.yogo')?.textContent || '').includes('超音波センサ'));
    const key = k => [...d.querySelectorAll('#calc [data-k]')].find(b => b.dataset.k === k).click();
    d.querySelector('#calc [data-n="1"]').click(); key('×'); d.querySelector('#calc [data-n="0"]').click(); key('÷'); key('2'); key('=');
    ok('電卓：340×0.008÷2 ＝ 1.36', d.getElementById('cmain').textContent === '1.36');
    click(w, '#toAns');
    ok('「答えの欄に入れる」で答えが入る', w.eval('u2.ans[2]') === '1.36' && w.eval('u2Auto(2)') === 3);
    click(w, '#hintBtn');
    ok('ヒントを見られる（記録される）', !!d.querySelector('.hbox') && w.eval('u2.hint[2]') === 1);
    // 第6問：計算をまちがえる（全角で入れる）
    d.querySelector('.dots button[data-j="5"]').click();
    const ni = d.getElementById('ni'); ni.value = '２２．５'; ni.dispatchEvent(new w.Event('input'));
    ok('全角の数も数として読み、まちがいは0点', w.eval('u2Has(5)') && w.eval('u2Auto(5)') === 0);
    // 第2問：記述。指定語句の印
    d.querySelector('.dots button[data-j="1"]').click();
    const ta = d.getElementById('ta'); ta.value = 'フィードバック制御は目標値とくらべて偏差を直す。'; ta.dispatchEvent(new w.Event('input'));
    const wd = [...d.querySelectorAll('.wd')];
    ok('記述：入れた指定語句だけに印（目標値・偏差 ✓、順番 なし）', wd[0].classList.contains('in') && wd[1].classList.contains('in') && !wd[2].classList.contains('in'));
    ok('記述：字数を数える', d.getElementById('cnt').textContent.startsWith('24 字'));
    ok('記述は自動で点をつけない', w.eval('u2Auto(1)') === null);
    // 開き直しても時間は戻らず、答えも残る
    const saved = JSON.parse(w.localStorage.getItem('seigyo100-test2-v1')); saved.dl = Date.now() + 61000;
    const w3 = open(null, 'test2'); w3.close();
    const dom3 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/seigyo100/', beforeParse(x) { x.localStorage.setItem('seigyo100-mode', 'test2'); x.localStorage.setItem('seigyo100-test2-v1', JSON.stringify(saved)); x.confirm = () => false; } });
    ok('開き直しても残り時間は締め切りから計算（1:01）・答えも残る', dom3.window.document.getElementById('tm').textContent === '1:01' && dom3.window.document.getElementById('ta').value.includes('偏差'));
    dom3.window.close();
    // 提出の確認：未回答があると1回目は止まる
    click(w, '#toConf');
    ok('確認の画面に未回答の問題（とちゅうの印つき）', d.querySelectorAll('.jump .opt').length === 10 && d.querySelector('.jump').textContent.includes('第1問（とちゅう）'));
    click(w, '#send');
    ok('未回答があると1回目の「提出する」では出さない', !!d.querySelector('.warn') && !w.eval('u2.done'));
    // 時間切れ：開き直すと答えを変えられず、提出だけできる
    const late = JSON.parse(w.localStorage.getItem('seigyo100-test2-v1')); late.dl = Date.now() - 1; late.i = 1;
    const dom4 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/seigyo100/', beforeParse(x) { x.localStorage.setItem('seigyo100-mode', 'test2'); x.localStorage.setItem('seigyo100-test2-v1', JSON.stringify(late)); x.confirm = () => false; } });
    const W = dom4.window, D = W.document;
    ok('時間切れなら問題を開かず、提出の画面（問題にもどれない）', D.querySelector('.warn')?.textContent.includes('時間になりました') && !D.getElementById('ta') && !D.getElementById('back') && D.querySelector('.jump .opt').disabled);
    D.getElementById('send').click();
    ok('時間切れなら未回答があっても1回で提出に進む', D.querySelector('.card').textContent.includes('送信しています'));
    await new Promise(r => setTimeout(r, 1700));
    ok('「提出しました」：図3点＋計算3点＝6 / 16 点', D.querySelector('.cert .big')?.textContent === '提出しました' && D.querySelector('.cert .score').textContent === '6' && D.querySelector('.cert').textContent.includes('/ 16 点'));
    ok('答え合わせ13問・記述は模範解答と観点・指定語句の有無', D.querySelectorAll('.rv').length === 13 && D.querySelectorAll('.crit').length === 8 && D.querySelector('.card').textContent.includes('× 順番'));
    ok('ランク・受け直しがない', !D.querySelector('.card').textContent.includes('ランク') && !D.getElementById('dReset'));
    const box = W.localStorage.getItem('seigyo100-test2-v1');
    const dom5 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/seigyo100/', beforeParse(x) { x.localStorage.setItem('seigyo100-mode', 'test2'); x.localStorage.setItem('seigyo100-test2-v1', box); } });
    ok('開き直しても「提出しました」のまま（受け直せない）', !!dom5.window.document.querySelector('.cert') && !dom5.window.document.getElementById('no'));
    dom5.window.document.getElementById('tomenu').click();
    ok('メニューに「提出済み」', dom5.window.document.getElementById('mTest2').textContent.includes('提出済み（図と計算 6 / 16 点'));
    ok('第1回の記録は第2回で変わらない', dom5.window.eval('ts.done') === null);
    dom5.window.close();
    // 先生用デモ：生徒の箱とは別。時間を終わらせて提出、やり直し
    const dom6 = new JSDOM(html, { runScripts: 'dangerously', url: 'https://example.test/seigyo100/#demo', beforeParse(x) { x.localStorage.setItem('seigyo100-mode', 'test2'); x.localStorage.setItem('seigyo100-test2-v1', box); } });
    const dw = dom6.window, dd = dw.document;
    ok('#demo なら、提出済みの生徒でも最初の画面（別の箱）', !!dd.getElementById('no') && !!dd.querySelector('.demo'));
    dd.getElementById('no').value = '0000'; dd.getElementById('go').click();
    dd.getElementById('dEnd').click();
    ok('デモは「時間を終わらせる」で時間切れの確かめができる', dd.querySelector('.warn')?.textContent.includes('時間になりました'));
    dd.getElementById('send').click(); await new Promise(r => setTimeout(r, 1700));
    dd.getElementById('dReset').click();
    ok('デモは提出後も受け直せ、生徒の箱を変えない', !!dd.getElementById('no') && dw.localStorage.getItem('seigyo100-test2-v1') === box && !!dw.localStorage.getItem('seigyo100-test2-demo'));
    dw.close(); W.close(); w.close();
  }

  console.log('■ 小テスト第2回：答案を送る（受け口の URL を入れたとき）');
  {
    ok('いまは送り先が空（ダミーの提出）', /const T2_URL='';/.test(html));
    const html2 = html.replace("const T2_URL='';", "const T2_URL='https://script.example.test/exec';");
    const sent = []; let mode = 'fail';
    const dom = new JSDOM(html2, { runScripts: 'dangerously', url: 'https://example.test/seigyo100/', beforeParse(x) {
      x.localStorage.setItem('seigyo100-mode', 'test2');
      x.fetch = async (url, o) => { sent.push({ url, o }); if (mode === 'fail') throw new Error('offline'); return { json: async () => ({ ok: true }) }; };
    } });
    const w = dom.window, d = w.document;
    d.getElementById('no').value = '2105'; d.getElementById('go').click();
    [...d.querySelectorAll('.bank .opt')].find(b => b.dataset.w === 'ミリ波レーダー').click();
    w.eval("u2.ans[1]='=目標値とくらべて偏差を直す。\\n2行目';u2.ans[2]='1.36';u2.hint[2]=1;u2.ans[9]='6';u2Save()");
    w.eval('u2.dl=Date.now()-1;render()');
    d.getElementById('send').click(); await new Promise(r => setTimeout(r, 50));
    ok('送れないと「提出しました」にならず、答えを残して「もう一度送る」', !w.eval('u2.done') && d.querySelector('.card').textContent.includes('送れませんでした') && d.getElementById('send').textContent === 'もう一度送る' && w.eval('u2.ans[2]') === '1.36');
    const sid = w.eval('u2.sid');
    ok('送る先は T2_URL・POST・ヘッダなし', sent[0].url === 'https://script.example.test/exec' && sent[0].o.method === 'POST' && !sent[0].o.headers);
    mode = 'ok'; d.getElementById('send').click(); await new Promise(r => setTimeout(r, 50));
    ok('送れたら「提出しました」', !!w.eval('u2.done') && d.querySelector('.cert .big')?.textContent === '提出しました');
    const body = JSON.parse(sent[1].o.body);
    ok('送り直しても同じ提出ID（受け口で二重にならない）', JSON.parse(sent[0].o.body).sid === sid && body.sid === sid && /^[0-9a-z]{24}$/.test(sid));
    ok('送る中身：出席番号・13問・図は4つの欄・点・ヒント', body.no === '2105' && body.ans.length === 13 && Array.isArray(body.ans[0]) && body.ans[0][0] === 'ミリ波レーダー' && body.auto === 7 && JSON.stringify(body.hints) === '[3]' && body.v === 1 && body.demo === 0);
    ok('送る中身に名前や練習の記録を入れない', Object.keys(body).sort().join() === 'ans,auto,demo,hints,no,sid,v');
    // 受け口（.gs）の makeRow に、アプリが送った形をそのまま通す
    const vm = require('vm'); const ctx = {}; vm.createContext(ctx);
    vm.runInContext(fs.readFileSync('apps-script/小テスト第2回.gs', 'utf8') + ';this.makeRow=makeRow;this.Q=Q;this.AUTO_MAX=AUTO_MAX;', ctx);
    const row = ctx.makeRow(body);
    ok('受け口の問題の並び・点がアプリと同じ', ctx.Q.length === 13 && ctx.Q.every((q, i) => q[1] === w.eval('T2')[i].t && q[2] === w.eval('T2')[i].pt) && ctx.AUTO_MAX === w.eval('T2AUTO'));
    ok('受け口が受け取れる（1行27列・出席番号・図は「／」でつなぐ）', row.length === 27 && row[1] === "'2105" && row[5] === 'ミリ波レーダー ／ 未回答 ／ 未回答 ／ 未回答' && row[18] === '3');
    ok('受け口：「=」で始まる答えは式として読ませない・改行は残す', row[6].startsWith("'=") && row[6].includes('\n'));
    const bad = f => { try { ctx.makeRow(f(JSON.parse(JSON.stringify(body)))); return false; } catch (e) { return true; } };
    ok('受け口：おかしな形は捨てる（出席番号・提出ID・答えの数・点）', bad(b => (b.no = '12', b)) && bad(b => (b.sid = 'x', b)) && bad(b => (b.ans.pop(), b)) && bad(b => (b.auto = 99, b)));
    w.close();
  }

  done();
})();
function done() {
console.log(`\n合格 ${pass}　不合格 ${fail}`);
console.log(fail ? '不合格があります' : 'すべて合格');
process.exit(fail ? 1 : 0);
}
