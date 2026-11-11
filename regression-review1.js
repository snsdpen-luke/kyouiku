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
  ok('小テストを選ぶと出席番号の欄', $(w, '#no') !== null && $(w, '#ttl').textContent === '小テスト第1回');
  click(w, '#menuBtn');
  ok('メニューに「小テスト第2回 20問」がある', $(w, '#mTest2') && $(w, '#mTest2').textContent.includes('小テスト第2回') && $(w, '#mTest2').textContent.includes('20問'));
  click(w, '#mTest2');
  ok('第2回を選ぶと第2回の出席番号の欄', $(w, '#no') !== null && $(w, '#ttl').textContent === '小テスト第2回');
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
// ================= 小テスト第2回 =================
function open2(store, hash = '') {
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', url: 'https://example.test/review1/' + hash,
    beforeParse(w) {
      w.localStorage.setItem('fukushu-mode', 'test2');
      if (store) w.localStorage.setItem('fukushu-test2-v1', store);
      w.confirm = () => false; w.alert = () => { throw new Error('alert は使わない'); };
    },
  });
  return dom.window;
}
console.log('■ 第2回：正解を独立に計算し直す');
{
  const w = open2(); const U = w.eval('U');
  const find = (re) => { const k = U.findIndex(p => re.test(p.q)); if (k < 0) throw new Error('問題がない: ' + re); return U[k]; };
  ok('20問・章ごとに E3 A4 B4 C3 D3 F3', U.length === 20 &&
    JSON.stringify(['E','A','B','C','D','F'].map(s => U.filter(p => p.s === s).length)) === '[3,4,4,3,3,3]');
  ok('どの問題にも解説と場面がある', U.every(p => p.e && p.e.length > 20 && p.sc));
  ok('形式が5種類以上（並べかえ・組み合わせ・穴うめ・計算・シミュレーション）', new Set(U.map(p => p.t)).size >= 6);
  // 計算
  ok('改札：QR は IC より 10分長い', find(/改札は5台/).a === (3000 / 5) * (2.0 - 1.0) / 60);
  ok('パケット：再送は20個', find(/1％が消え/).a === 3000000 / 1500 * 0.01);
  ok('学校のWi-Fi：64秒', find(/40人が同時/).a === (4 * 8) / (20 / 40));
  ok('ギガ：1日15分', find(/残り 3GB/).a === 3 / 12 / 1.0 * 60);
  ok('距離4倍：64 → 4', find(/1mのところの電波/).a === 64 / (4 / 1) ** 2);
  { let n = 1; while (10 ** n / 1e10 < 86400) n++; ok('数字だけ・1日以上：15けた（14けたは足りない）', find(/1秒に100億回/).a === n && 10 ** 14 / 1e10 < 86400 && 24 * 60 * 60 === 86400); }
  // 画質：速さ以下で一番高いもの
  { const need = [1, 2, 4, 8, 25]; const p = find(/画質「自動」/);
    ok('画質の組み合わせ', p.rows.every(([t, a]) => { const v = +t.match(/（([\d.]+)Mbps）/)[1]; return a === need.map((x, i) => x <= v ? i : -1).filter(i => i >= 0).pop(); })); }
  // 中継器：半分の回数 → 強さ、両方25以上が1つだけ
  { const p = find(/中継器を1台/); const h = { wd: 1, cn: 4 };
    const good = p.spots.map(s => 100 / 2 ** s[2].reduce((a, c) => a + h[c], 0) >= 25 && 100 / 2 ** s[3].reduce((a, c) => a + h[c], 0) >= 25);
    ok('中継器：条件を両方みたすのは1か所で、それが正解', good.filter(Boolean).length === 1 && good[p.a], good); }
  // 台帳：上から順に残高とハンコを確かめる
  { const p = find(/記録係になって確かめ/); const bal = { A: 30, B: 0, C: 0, D: 0, E: 0 }; const res = [];
    for (const [t] of p.rows) { const m = t.match(/(\S)さん → (\S)さん　(\d+)/); const from = m[1], to = m[2], amt = +m[3];
      const own = t.includes(`（${from}さんのハンコ）`); const okk = own && bal[from] >= amt; if (okk) { bal[from] -= amt; bal[to] += amt; } res.push(okk ? 0 : 1); }
    ok('台帳：入れる・入れないが残高の計算と合う（Aさんは最後に1）', p.rows.every((r, i) => r[1] === res[i]) && bal.A === 1, res); }
  // ブロック：書きかえた3から後ろを全部作り直す
  { const p = find(/ブロック3の取り引きを書きかえ/); const want = p.items.map((_, i) => i).filter(i => i >= 2);
    ok('ブロック：作り直すのは3〜6', JSON.stringify(p.a) === JSON.stringify(want)); }
  // ヘッダ：NAT のモデル
  { const p = find(/ヘッダの空らん/); const phone = '192.168.0.12', rt = '203.0.113.77', sv = '203.0.113.5', fr = '198.51.100.40';
    ok('ヘッダ：①宛先サーバー・送信元スマホ ②送信元ルーター ③宛先友だち・送信元サーバー', JSON.stringify(p.a) === JSON.stringify([sv, phone, rt, fr, sv]) && p.a.every(x => p.words.includes(x))); }
  // 支払い：前払い0・その場1・後払い2
  { const p = find(/財布とスマホ/); const tbl = { 'Suica': 0, 'デビット': 1, 'クレジットカード': 2, 'PayPay': 0, '図書カード': 0, 'iD': 2 };
    ok('支払いのタイミング', p.rows.every(([t, a]) => { const key = Object.keys(tbl).find(x => t.startsWith(x)); return key && tbl[key] === a; })); }
  // 波長
  { const p = find(/2.4GHz帯と5GHz帯/); const lam24 = 3e8 / 2.4e9, lam5 = 3e8 / 5e9;
    ok('波長：2.4GHz 約12cm・5GHz 約6cm（短いのは5GHz）', Math.abs(lam24 - 0.125) < 1e-9 && Math.abs(lam5 - 0.06) < 1e-9 && p.rows.find(r => r[0].startsWith('波長'))[1] === 1); }
  { const p = find(/本人確認の3つ/); ok('本人確認：知っている2・持っている2・体2', [0, 1, 2].every(c => p.rows.filter(r => r[1] === c).length === 2)); }
  { const p = find(/フィッシング/); ok('メール：本物の住所と差出人・リンク先がちがう', !p.items[0].includes('@mirai-id.example') && !p.items[5].includes('//mirai-id.example') && p.a.includes(0) && p.a.includes(5) && !p.a.includes(2) && !p.a.includes(3) && !p.a.includes(6)); }
  ok('並べかえは5項目・組み合わせの答えは選択肢の範囲内', U.filter(p => p.t === 'order').every(p => p.items.length === 5) && U.filter(p => p.t === 'match').every(p => p.rows.every(r => r[1] >= 0 && r[1] < p.cats.length)));
  ok('穴うめの答えはすべて語群にある', U.filter(p => p.t === 'fill').every(p => p.a.every(x => p.words.includes(x)) && p.lines.join('').match(/\{\d\}/g).length === p.a.length));
}

// 第2回を画面の操作で解く。wrong：まちがえる問題の番号の集合。skip：答えない問題
function take2(wrong = new Set(), skip = new Set(), hash = '') {
  const w = open2(null, hash); $(w, '#no').value = '0712'; click(w, '#go');
  const U = w.eval('U'); const q$ = s => [...w.document.querySelectorAll(s)];
  for (let k = 0; k < U.length; k++) {
    const p = U[k], bad = wrong.has(k);
    if (w.eval('us.i') !== k) throw new Error('進んでいない: ' + k);
    const txt = $(w, '#card').textContent;
    if (/正解|まちがい|不正解/.test(txt) || $(w, '.rv')) throw new Error('提出前に正解が出ている: ' + k);
    if (!skip.has(k)) {
      if (p.t === 'order') {
        const seq = bad ? [1, 0, 2, 3, 4] : [0, 1, 2, 3, 4];
        // 一度まちがえて押し、消してから並べ直せる
        q$('.ordl .opt').find(b => b.dataset.n === '4').click(); q$('.ordl .opt').find(b => b.dataset.n === '4').click();
        seq.forEach(n => q$('.ordl .opt').find(b => b.dataset.n === String(n)).click());
      } else if (p.t === 'match') {
        p.rows.forEach((r, i) => { const j = bad && i === 0 ? (r[1] + 1) % p.cats.length : r[1];
          q$('.seg .opt').find(b => b.dataset.r === String(i) && b.dataset.j === String(j)).click(); });
      } else if (p.t === 'fill') {
        p.a.forEach((x, n) => { q$('.blank').find(b => b.dataset.b === String(n)).click();
          const word = bad && n === p.a.length - 1 ? p.words.find(y => y !== x) : x;
          q$('.words .opt').find(b => b.dataset.w === word).click(); });
      } else if (p.t === 'num') {
        const ni = $(w, '#ni'); ni.value = bad ? String(p.a + 1) : (p.a >= 10 ? String(p.a).replace(/\d/g, d => String.fromCharCode(0xFF10 + +d)) : String(p.a)); // 全角でも受け付ける
        ni.dispatchEvent(new w.Event('input'));
      } else if (p.t === 'spot') {
        click(w, `.spot[data-j="${bad ? (p.a + 1) % p.spots.length : p.a}"]`);
      } else if (p.t === 'tap') {
        (bad ? p.a.slice(1) : p.a).forEach(j => click(w, `[data-j="${j}"]`));
      } else if (p.t === 'step') {
        const target = bad ? p.a - 1 : p.a; let guard = 0;
        while (w.eval(`us.ans[${k}]`) !== target && guard++ < 40) click(w, (w.eval(`us.ans[${k}]`) ?? p.start) < target ? '#sp' : '#sm');
      }
    }
    click(w, '#next');
  }
  return w;
}
console.log('■ 第2回：画面の操作で解いて提出');
{
  const wrong = new Set([0, 3, 6, 11, 14, 19]); // 組み合わせ・並べかえ・計算・中継器・メール・ブロックをまちがえる
  let w, err; try { w = take2(wrong); } catch (e) { err = e.message; }
  ok('最後まで進める（解いている間は正解が出ない）', !err, err);
  if (w) {
    const t = $(w, '#card').textContent;
    ok('確認画面：出席番号と 20 / 20 問', t.includes('提出の前に') && t.includes('0712') && t.includes('20 / 20 問'));
    click(w, '#send');
    ok('「提出する」で送信中の表示', $(w, '#card').textContent.includes('送信しています'));
    ok('送信中は上の「メニュー」を押しても動かない', (click(w, '#menuBtn'), w.eval('mode')) === 'test2');
    w.eval('us.sending=false;us.sent="11月12日 10:00";uSave();render()');
    const t2 = $(w, '#card').textContent;
    ok('「提出しました」と出席番号', t2.includes('提出しました') && t2.includes('0712'));
    ok(`点数が合う（${20 - wrong.size} / 20）`, t2.includes(`${20 - wrong.size} / 20 問 正解`), t2.match(/\d+ \/ 20 問 正解/)?.[0]);
    ok('答え合わせが20問・○の数が点数と合う', w.document.querySelectorAll('.rv').length === 20 && w.document.querySelectorAll('.rv .mark.o').length === 20 - wrong.size);
    ok('まちがえた問題に × が付く', [...wrong].every(k => w.document.querySelectorAll('.rv')[k].querySelector('.mark.x')));
    ok('章ごとのバーが6本', w.document.querySelectorAll('.bar').length === 6);
    ok('提出は1回だけ（受け直すボタンがない）', !$(w, '#again') && !$(w, '#uReset'));
    const w2 = open2(w.localStorage.getItem('fukushu-test2-v1'));
    ok('開き直しても「提出しました」のまま', $(w2, '#card').textContent.includes('提出しました') && !$(w2, '#send'));
    click(w2, '#menuBtn');
    ok('メニューで第2回は「提出済み」', $(w2, '#mTest2').textContent.includes('提出済み'));
    ok('第2回の提出は第1回の記録に影響しない', $(w2, '#mTest').textContent.includes('まだ受けていません'));
  }
}
console.log('■ 第2回：全問正解・全問不正解');
{
  let w = take2(); click(w, '#send'); w.eval('us.sending=false;us.sent="x";uSave();render()');
  ok('全問正解で 20 / 20', $(w, '#card').textContent.includes('20 / 20 問 正解'));
  w = take2(new Set([...Array(20).keys()])); click(w, '#send'); w.eval('us.sending=false;us.sent="x";uSave();render()');
  ok('全問まちがえて 0 / 20', $(w, '#card').textContent.includes('0 / 20 問 正解'));
}
console.log('■ 第2回：答えていない問題があるとき');
{
  const w = take2(new Set(), new Set([4, 15]));
  ok('答えた数 18 / 20・未回答が並ぶ', $(w, '#card').textContent.includes('18 / 20 問') && q2(w).join() === '第5問,第16問');
  click(w, '#send');
  ok('1回目は提出せず注意', !w.eval('us.sending') && $(w, '.warn').textContent.includes('2問'));
  click(w, '#send');
  ok('2回目で提出', w.eval('us.sending') === true);
  w.eval('us.sending=false;us.sent="x";uSave();render()');
  ok('未回答は × で「未回答」', $(w, '#card').textContent.includes('未回答') && w.document.querySelectorAll('.rv .mark.o').length === 18);
}
function q2(w) { return [...w.document.querySelectorAll('.jump .opt')].map(b => b.textContent); }
console.log('■ 第2回：とちゅうの問題');
{
  const w = open2(); $(w, '#no').value = '0001'; click(w, '#go');
  const U = w.eval('U');
  // 第1問（組み合わせ）を1行だけ答えて最後へ
  [...w.document.querySelectorAll('.seg .opt')][0].click();
  w.eval('us.i=20;uSave();render()');
  ok('一部だけの組み合わせは「とちゅう」と出る', q2(w)[0] === '第1問（とちゅう）');
  ok('数を入れる欄は全角数字・カンマも読める', w.eval('uNum("１,２００")') === 1200 && Number.isNaN(w.eval('uNum("10分")')));
  const w2 = open2(w.localStorage.getItem('fukushu-test2-v1'));
  ok('開き直すと続きから（確認画面）', w2.eval('us.i') === 20 && $(w2, '#card').textContent.includes('提出の前に'));
  ok('並べる順は開き直しても同じ', JSON.stringify(w2.eval('us.ord')) === JSON.stringify(w.eval('us.ord')));
  const orders = new Set(); for (let n = 0; n < 6; n++) { const x = open2(); $(x, '#no').value = '0001'; click(x, '#go'); orders.add(x.eval('JSON.stringify(uOrd(0))')); }
  ok('組み合わせの行の順は人ごとにくじで変わる', orders.size > 1);
  const fx = open2(); $(fx, '#no').value = '0001'; click(fx, '#go'); fx.eval('us.i=8;render()');
  ok('道順のある問題（画質）は行の順を変えない', fx.eval('JSON.stringify(uOrd(8))') === '[0,1,2,3,4]');
}
console.log('■ 第2回：先生用デモ（#demo）');
{
  const w = take2(new Set([1]), new Set(), '#demo');
  ok('#demo で第2回が開き、題に「先生用デモ」', $(w, '#ttl').textContent.includes('先生用デモ'));
  click(w, '#send'); w.eval('us.sending=false;us.sent="x";uSave();render()');
  ok('デモは生徒の箱に保存しない', w.localStorage.getItem('fukushu-test2-v1') === null && w.localStorage.getItem('fukushu-test2-demo') !== null);
  click(w, '#uReset');
  ok('デモは「最初からやり直す」で受け直せる', $(w, '#no') !== null && !w.eval('us.sent'));
}

console.log(`\n合格 ${pass} / 不合格 ${fail}`);
process.exit(fail ? 1 : 0);
