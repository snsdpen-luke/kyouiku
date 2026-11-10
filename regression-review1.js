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
// mode：'drill'（ふりかえり演習を開いた状態）・'test'（小テスト）・null（はじめて開く＝メニュー）
function open(store, mode = 'drill', tstore) {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.test/review1/',
    beforeParse(w) {
      if (store) w.localStorage.setItem('fukushu-v5', store);
      if (mode) w.localStorage.setItem('fukushu-mode', mode);
      if (tstore) w.localStorage.setItem('fukushu-test-v1', tstore);
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
  ok('localStorage が使えなくてもメニューが出る', $(w3, '#mDrill') !== null && $(w3, '#mTest') !== null);
  click(w3, '#mTest');
  ok('localStorage が使えなくても小テストを始められる', $(w3, '#no') !== null);
}

console.log('■ メニュー');
{
  const w = open(null, null);
  const t = $(w, '#card').textContent;
  ok('はじめて開くとメニューが出る', $(w, '#mDrill') && $(w, '#mTest') && $(w, '#menuBtn').hidden);
  ok('メニューに「小テスト 30問」がある', t.includes('小テスト') && t.includes('30問'));
  click(w, '#mDrill');
  ok('ふりかえり演習を選ぶと演習の開始画面', $(w, '#card').textContent.includes('これまでの6回の授業') && !$(w, '#menuBtn').hidden);
  click(w, '#menuBtn');
  ok('上の「メニュー」でメニューへもどる', $(w, '#mTest') !== null);
  click(w, '#mTest');
  ok('小テストを選ぶと出席番号の欄', $(w, '#no') !== null && $(w, '#ttl').textContent === '小テスト');
}

console.log('■ 小テスト：出席番号');
{
  const w = open(null, 'test');
  const tries = [['', false], ['12', false], ['12345', false], ['12a4', false], ['２１０５', true]];
  for (const [v, good] of tries) {
    const w2 = open(null, 'test'); $(w2, '#no').value = v; click(w2, '#go');
    const ts = w2.eval('ts');
    ok(`「${v}」は${good ? '受け付ける' : '受け付けない'}`, good ? ts.i === 0 && ts.no === '2105' : ts.i === -1 && $(w2, '#nomsg').textContent.includes('4けた'));
  }
  $(w, '#no').value = '0305'; click(w, '#go');
  const { set } = w.eval('({set:ts.set})'); const Q = w.eval('Q'); const TPLAN = w.eval('TPLAN');
  ok('30問が選ばれる', set.length === 30 && new Set(set).size === 30);
  ok('記述は入らない', set.every(i => Q[i].t !== 'w'));
  ok('章ごとの数（A5 B5 C4 D4 E6 F6）', Object.keys(TPLAN).every(s => set.filter(i => Q[i].s === s).length === TPLAN[s]));
  ok('上に出席番号が出る', $(w, '#chips').textContent.includes('0305'));
  // 2回開くと、別の問題の組になりうる（くじ）
  const sets = new Set(); for (let n = 0; n < 6; n++) { const x = open(null, 'test'); $(x, '#no').value = '0305'; click(x, '#go'); sets.add(x.eval('ts.set').join(',')); }
  ok('問題の組は開くたびにくじで変わる', sets.size > 1);
}

// 小テストを解いて提出する。wrongEvery：その番号おきにわざとまちがえる。skip：答えない問題の位置
function takeTest(wrongEvery, skip = []) {
  const w = open(null, 'test'); $(w, '#no').value = '1203'; click(w, '#go');
  const set = w.eval('ts.set'), Q = w.eval('Q');
  let want = 0;
  for (let k = 0; k < 30; k++) {
    const q = Q[set[k]];
    if (w.eval('ts.i') !== k) throw new Error('進んでいない: ' + k);
    if (q.t !== 'term' && w.document.querySelector('.fb')) throw new Error('提出前に正解が出ている: ' + k);
    if (!skip.includes(k)) {
      const wrong = wrongEvery && k % wrongEvery === 0;
      if (q.t === 'term') {
        const w2 = wrong ? [...w.document.querySelectorAll('.bank .opt')].map(b => b.dataset.w).find(x => x !== q.a[0]) : q.a[0];
        // 一度ちがう答えを押してから正しい答えに変えられる
        [...w.document.querySelectorAll('.bank .opt')].find(b => b.dataset.w !== w2).click();
        [...w.document.querySelectorAll('.bank .opt')].find(b => b.dataset.w === w2).click();
      } else if (q.t === 'one') {
        click(w, `.opt[data-k="${(q.a + 1) % q.o.length}"]`);
        if (!wrong) click(w, `.opt[data-k="${q.a}"]`);
      } else {
        (wrong ? [q.a[0]] : q.a).forEach(j => click(w, `.opt[data-k="${j}"]`));
      }
      if (!wrong) want++;
    }
    click(w, '#next');
  }
  return { w, want };
}
console.log('■ 小テスト：解いて提出');
{
  const { w, want } = takeTest(4);
  ok('最後に確認画面が出る（出席番号と答えた数）', $(w, '#card').textContent.includes('提出の前に') && $(w, '#card').textContent.includes('1203') && $(w, '#card').textContent.includes('30 / 30 問'));
  click(w, '#send');
  ok('「提出する」で送信中の表示', $(w, '#card').textContent.includes('送信しています'));
  ok('送信中は上の「メニュー」を押しても動かない', (click(w, '#menuBtn'), w.eval('mode')) === 'test');
  w.eval('ts.sending=false;ts.sent="11月10日 10:00";tSave();render()'); // 1.5秒待つかわり
  const t = $(w, '#card').textContent;
  ok('「提出しました」と出席番号が出る', t.includes('提出しました') && t.includes('1203'));
  ok(`点数が合う（${want} / 30）`, t.includes(`${want} / 30 問 正解`), t.match(/\d+ \/ 30 問 正解/)?.[0]);
  ok('答え合わせが30問ある', w.document.querySelectorAll('.rv').length === 30);
  ok('○と×の数が点数と合う', w.document.querySelectorAll('.rv .mark.o').length === want);
  ok('章ごとのバーが6本', w.document.querySelectorAll('.bar').length === 6);
  const saved = w.localStorage.getItem('fukushu-test-v1');
  const w2 = open(null, 'test', saved);
  ok('開き直しても「提出しました」のまま（答えを変えられない）', $(w2, '#card').textContent.includes('提出しました') && !$(w2, '#send'));
  click(w2, '#again');
  ok('「新しい小テストを受ける」で出席番号の画面（番号は残る）', $(w2, '#no') && $(w2, '#no').value === '1203' && w2.eval('ts.set') === null);
  ok('どこにも送らない（通信の命令がない）', !/fetch\(|XMLHttpRequest|sendBeacon|navigator\.send|<form/.test(html));
}
console.log('■ 小テスト：答えていない問題があるとき');
{
  const { w } = takeTest(0, [2, 7]);
  const t = $(w, '#card').textContent;
  ok('答えた数が 28 / 30', t.includes('28 / 30 問'));
  ok('答えていない問題が並ぶ', [...w.document.querySelectorAll('.jump .opt')].map(b => b.textContent).join() === '第3問,第8問');
  click(w, '#send');
  ok('1回目の「提出する」では提出せず、注意が出る', !w.eval('ts.sending') && !w.eval('ts.sent') && $(w, '.warn').textContent.includes('2問'));
  click(w, '.jump .opt[data-k="7"]');
  ok('番号を押すとその問題へ', w.eval('ts.i') === 7);
  w.eval('ts.i=30;render()'); click(w, '#send'); click(w, '#send');
  ok('2回目の「提出する」で提出する', w.eval('ts.sending') === true);
  w.eval('ts.sending=false;ts.sent="x";tSave();render()');
  ok('未回答は × で「未回答」と出る', $(w, '#card').textContent.includes('未回答') && w.document.querySelectorAll('.rv .mark.o').length === 28);
}
console.log('■ 小テスト：途中で開き直す');
{
  const w = open(null, 'test'); $(w, '#no').value = '0001'; click(w, '#go');
  const set = w.eval('ts.set'); const q = w.eval('Q')[set[0]];
  if (q.t === 'term') [...w.document.querySelectorAll('.bank .opt')][0].click(); else click(w, '.opt[data-k="0"]');
  click(w, '#next'); click(w, '#next');
  const w2 = open(null, 'test', w.localStorage.getItem('fukushu-test-v1'));
  ok('同じ問題の組・同じ位置（第3問）から続く', w2.eval('ts.set').join() === set.join() && w2.eval('ts.i') === 2);
  ok('答えが残っている', w2.eval('tAnswered(0)'));
}
console.log(`\n合格 ${pass} / 不合格 ${fail}`);
process.exit(fail ? 1 : 0);
