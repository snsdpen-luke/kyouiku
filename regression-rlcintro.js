// kyouzai の確認スクリプト（jsdom）。ひな形 template.html から作った教材用。
//   写して regression-<フォルダ>.js にし、★授業ごと の所（CALC と EXPECT）だけ書きかえる。
//   node regression-<フォルダ>.js <本体>.html
// 見るもの：0 禁止事項  1 データ  2 計算の検証（独立に計算し直す）  3 通しで解く  4 先生用  5 保存  6 小テスト  7 エラー
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const file = process.argv[2] || 'template.html';
const html = fs.readFileSync(file, 'utf8');

/* ============ ★授業ごと ============ */
// 世界を変えた3つの部品 R・L・C（3つの部品RLC.html）。電気回路α の導入
const EXPECT = { questions: 8, missions: 4 };
// 独立の計算（教科書の式から書く。教材の MODEL は使わない）
//   電力 P = V²/R、電流 I = V/R、コンデンサのエネルギー E = ½CV²、パワー = エネルギー ÷ 時間
const mis = id => `FLOW.find(P=>P.id==="${id}").ok`;
// シミュレーターを進める。policy：毎きざみの前に S を見て操作する関数（文字列）
const runSim = (w, name, set, sec, policy) => w.eval(`(()=>{const S=Object.assign(SIMS.${name}.init(),${JSON.stringify(set)});const pol=${policy || 'null'};for(let k=0;k<${Math.round(sec / 0.05)};k++){if(pol)pol(S);SIMS.${name}.step(S,0.05)}return S})()`);
// うまい人の押し方：磁石の力が回る向きと逆になったら、電流の向きを切りかえる
const GOOD = 'S=>{const tq=-S.dir*Math.sin(S.th);if(Math.abs(S.om)>0.1&&tq*S.om<0)S.dir=-S.dir}';
const CALC = [
  { name: '電球：100V で 100W', actual: w => w.eval('MODEL.lampP(100)'), expect: 100 * 100 / 100, tol: 1e-9 },
  { name: '電球：100V で 1A', actual: w => w.eval('MODEL.lampI(100)'), expect: 100 / 100, tol: 1e-9 },
  { name: '先生メモ「50V で 25W（電圧2倍で電力4倍）」', actual: w => w.eval('MODEL.lampP(100)/MODEL.lampP(50)'), expect: 4, tol: 1e-9 },
  { name: '電球：120V（144W）では3秒たっても切れない', actual: w => runSim(w, 'lamp', { V: 120 }, 3).burnt ? 1 : 0, expect: 0, tol: 0 },
  { name: '電球：130V（169W）では1秒ほどで切れる（先生メモ）', actual: w => runSim(w, 'lamp', { V: 130 }, 1.2).burnt ? 1 : 0, expect: 1, tol: 0 },
  { name: 'm1：100V で合格', actual: w => w.eval(mis('m1'))({ V: 100, burnt: false }) ? 1 : 0, expect: 1, tol: 0 },
  { name: 'm1：90V・110V では不合格', actual: w => (w.eval(mis('m1'))({ V: 90, burnt: false }) || w.eval(mis('m1'))({ V: 110, burnt: false })) ? 1 : 0, expect: 0, tol: 0 },
  { name: 'm1：切れた電球では不合格', actual: w => w.eval(mis('m1'))({ V: 100, burnt: true }) ? 1 : 0, expect: 0, tol: 0 },
  { name: 'モーター：何もしないと回り続けない（60秒で1回転未満）', actual: w => runSim(w, 'motor', {}, 60).man < 1 ? 1 : 0, expect: 1, tol: 0 },
  { name: 'モーター：何もしないと止まる（60秒後の速さ ≒ 0）', actual: w => Math.abs(runSim(w, 'motor', {}, 60).om), expect: 0, tol: 0.01 },
  { name: 'モーター：タイミングよく切りかえると 30秒以内に5回転（1A）', actual: w => runSim(w, 'motor', {}, 30, GOOD).man >= 5 ? 1 : 0, expect: 1, tol: 0 },
  { name: 'モーター：でたらめに押す（0.05秒ごとに切りかえ）と回らない', actual: w => runSim(w, 'motor', {}, 30, 'S=>{S.dir=-S.dir}').man < 5 ? 1 : 0, expect: 1, tol: 0 },
  { name: 'モーター：整流子を付けると回り続ける（つり合いの速さ ≒ kI×(2/π)÷b）', actual: w => Math.abs(runSim(w, 'motor', { auto: true }, 30).om), expect: 6 * 1 * (2 / Math.PI) / 0.8, tol: 1.0 },
  { name: 'モーター：整流子で回した分は、手で回した数に入らない', actual: w => runSim(w, 'motor', { auto: true }, 30).man, expect: 0, tol: 1e-9 },
  { name: 'モーター：電流 3A は 1A より速い', actual: w => Math.abs(runSim(w, 'motor', { auto: true, I: 3 }, 30).om) > 2 * Math.abs(runSim(w, 'motor', { auto: true, I: 1 }, 30).om) ? 1 : 0, expect: 1, tol: 0 },
  { name: 'm2：5回転で合格、4.9回転で不合格', actual: w => (w.eval(mis('m2'))({ man: 5 }) && !w.eval(mis('m2'))({ man: 4.9 })) ? 1 : 0, expect: 1, tol: 0 },
  { name: 'フラッシュ：1000µF・300V の満タン ＝ 45J', actual: w => w.eval('MODEL.capE(1000)'), expect: 0.5 * 1000e-6 * 300 ** 2, tol: 1e-9 },
  { name: '先生メモ「200µF では満タンでも 9J」', actual: w => w.eval('MODEL.capE(200)'), expect: 0.5 * 200e-6 * 300 ** 2, tol: 1e-9 },
  { name: 'フラッシュ：500µF は 5W の電池で 4.5秒で満タン（22.5J）', actual: w => runSim(w, 'flash', { C: 500, on: true }, 4.5).E, expect: 0.5 * 500e-6 * 300 ** 2, tol: 0.26 },
  { name: 'フラッシュ：満タンをこえてたまらない', actual: w => runSim(w, 'flash', { C: 500, on: true }, 20).E, expect: 22.5, tol: 1e-9 },
  { name: '先生メモ「パワーは電池の数千倍」：22.5J を 1/1000 秒 ＝ 22500W ＝ 4500倍', actual: w => w.eval('MODEL.capE(500)/MODEL.flashT/MODEL.battP'), expect: 22.5 / 0.001 / 5, tol: 1e-6 },
  { name: 'm3：20J 以上で合格、19.9J で不合格', actual: w => (w.eval(mis('m3'))({ best: 20 }) && !w.eval(mis('m3'))({ best: 19.9 })) ? 1 : 0, expect: 1, tol: 0 },
  { name: 'm3：C を 500µF 以上にしないと届かない（先生メモ）', actual: w => { let min = 0; for (let C = 100; C <= 1000; C += 100) if (0.5 * C * 1e-6 * 300 ** 2 >= 20) { min = C; break; } return min; }, expect: 500, tol: 0 },
  { name: 'm0：3つとも消したら合格、2つでは不合格', actual: w => (w.eval(mis('m0'))({ sR: true, sL: true, sC: true }) && !w.eval(mis('m0'))({ sR: true, sL: true, sC: false })) ? 1 : 0, expect: 1, tol: 0 },
];
/* ============ ★ここまで ============ */

let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); }
}
const errors = [];
// opt.hash：'#sensei' など。opt.store：localStorage に先に入れる {キー:文字列}。opt.noStorage：localStorage が使えない
function open(opt = {}) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => { if (!/Not implemented: HTMLCanvasElement/.test(e.message)) errors.push(e.message); });
  vc.on('error', m => errors.push(String(m)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/k/' + (opt.hash || ''), virtualConsole: vc,
    beforeParse(w) {
      if (opt.noStorage) Object.defineProperty(w, 'localStorage', { get() { throw new Error('SecurityError'); } });
      else for (const [k, s] of Object.entries(opt.store || {})) w.localStorage.setItem(k, s);
      // 実環境（Classroom のサンドボックス）では confirm が常に false。alert は使わない約束
      w.confirm = () => false; w.alert = () => { throw new Error('alert は使わない'); }; w.prompt = () => null;
    },
  });
  return dom.window;
}
const $ = (w, sel) => w.document.querySelector(sel);
const click = (w, sel) => { const e = $(w, sel); if (!e) throw new Error('ない: ' + sel); e.click(); };
const cur = w => w.eval('FLOW[st.p]');
const sleep = ms => new Promise(r => setTimeout(r, ms));

// 今の問題に答える（right：正しく／まちがえて）
function answer(w, q, right) {
  if (q.t === 'one') click(w, `#qbox .opt[data-k="${right ? 0 : 1}"]`);
  else if (q.t === 'multi') { const ks = right ? q.a : [...Array(q.o.length).keys()].filter(k => !q.a.includes(k)).slice(0, 1); ks.forEach(k => click(w, `#qbox .opt[data-k="${k}"]`)); click(w, '#qbox #go'); }
  else if (q.t === 'term') { const bank = w.eval('BANK'); const word = right ? q.a[0] : bank.find(x => !q.a.includes(x)); click(w, `#qbox .bank .opt[data-w="${word}"]`); }
  else if (q.t === 'num') { $(w, '#numIn').value = String(right ? q.a : q.a * 3 + 7); click(w, '#qbox #go'); }
  else if (q.t === 'w') { $(w, '#wIn').value = 'テストの答えを十文字以上書きます。'; click(w, '#qbox #go'); [...w.document.querySelectorAll('#qbox .btn')].find(b => b.textContent === (right ? 'できた' : 'できなかった')).click(); }
}
// 小テストを受ける（right：全部正しく／全部まちがえて）
async function takeTest(w, right, no = '0101') {
  if ($(w, '#no')) $(w, '#no').value = no; click(w, '#tgo');
  const set = w.eval('st.test.set');
  for (let k = 0; k < set.length; k++) {
    const q = w.eval(`QI["${set[k]}"]`);
    if (q.t === 'one') click(w, `#card .opt[data-k="${right ? 0 : 1}"]`);
    else if (q.t === 'multi') { (right ? q.a : [q.o.findIndex((_, i) => !q.a.includes(i))]).forEach(i => click(w, `#card .opt[data-k="${i}"]`)); }
    else if (q.t === 'term') { const word = right ? q.a[0] : w.eval('BANK').find(x => !q.a.includes(x)); click(w, `#card .bank .opt[data-w="${word}"]`); }
    else if (q.t === 'num') { const e = $(w, '#numIn'); e.value = String(right ? q.a : q.a + 1000); e.dispatchEvent(new w.Event('input')); }
    click(w, '#tnext');
  }
  click(w, '#send'); await sleep(1700);
  return set;
}

(async () => {
  console.log('■ 0 禁止事項（ソースを読む）');
  {
    const code = html.replace(/<!--[\s\S]*?-->/g, '');
    ok('外からファイルを読まない（http の src / href / @import / url()）', !/(src|href)\s*=\s*["']?https?:|@import|url\(\s*["']?https?:/i.test(code), (code.match(/(src|href)\s*=\s*["']?https?:[^"' >]*/gi) || []).slice(0, 5));
    ok('Google Fonts を使わない', !/fonts\.(googleapis|gstatic)\.com/.test(code));
    ok('外への通信がない（fetch / XMLHttpRequest / sendBeacon / WebSocket）', !/\bfetch\(|XMLHttpRequest|sendBeacon|WebSocket/.test(code));
    ok('confirm / alert / prompt を使わない', !/\b(confirm|alert|prompt)\(/.test(code.replace(/\.(confirm|alert|prompt)\b/g, '')));
    ok('ライトモード固定（meta と CSS の両方、ダークの切りかえなし）', /<meta name="color-scheme" content="light">/.test(code) && /color-scheme:\s*light/.test(code) && !/prefers-color-scheme:\s*dark/.test(code));
    ok('版の表示 VER が YYYY-MM-DD＋英小文字', /const VER = "\d{4}-\d{2}-\d{2}[a-z]+"/.test(code));
    ok('ファイルが 300KB 以下（重いと Chromebook で遅い）', Buffer.byteLength(html) <= 300 * 1024, Math.round(Buffer.byteLength(html) / 1024) + 'KB');
    ok('viewport の指定がある', /name="viewport"/.test(code));
  }

  console.log('■ 1 データ');
  {
    const w = open();
    const { Q, TERMS, PAGES, SECS, SIMS, CH, BANK, TEST, FLOW } = w.eval('({Q,TERMS,PAGES,SECS,SIMS,CH,BANK,TEST,FLOW})');
    const T = ['one', 'multi', 'term', 'num', 'w'];
    ok(`問題が ${EXPECT.questions} 問`, Q.length === EXPECT.questions, Q.length);
    ok('id に重複がない', new Set(Q.map(q => q.id)).size === Q.length);
    ok('種類はどれも one / multi / term / num / w', Q.every(q => T.includes(q.t)), Q.filter(q => !T.includes(q.t)).map(q => q.id));
    ok('どの問題も分野 ch がある', Q.every(q => CH[q.ch]), Q.filter(q => !CH[q.ch]).map(q => q.id));
    const dup = Q.map(q => q.q).filter((s, i, a) => a.indexOf(s) !== i);
    ok('問題文に重複がない', !dup.length, dup);
    const ch = Q.filter(q => q.t === 'one' || q.t === 'multi');
    ok('選択肢は 3〜6 つ', ch.every(q => q.o.length >= 3 && q.o.length <= 6), ch.filter(q => q.o.length < 3 || q.o.length > 6).map(q => q.id));
    ok('同じ問題の中に同じ選択肢がない', ch.every(q => new Set(q.o).size === q.o.length), ch.filter(q => new Set(q.o).size !== q.o.length).map(q => q.id));
    ok('すべて選ぶ：正解は2つ以上・全部ではない・範囲内', Q.filter(q => q.t === 'multi').every(q => q.a.length >= 2 && q.a.length < q.o.length && q.a.every(k => k >= 0 && k < q.o.length)));
    const longest = Q.filter(q => q.t === 'one' && q.o.length > 2).filter(q => q.o[0].length > Math.max(...q.o.slice(1).map(s => s.length)));
    const oneN = Q.filter(q => q.t === 'one').length;
    ok('「正解だけが一番長い」問題が 35% 以下（長さで当てられない）', !oneN || longest.length / oneN <= 0.35, longest.map(q => q.id));
    ok('選ぶ問題・数の問題には解説 e がある', Q.filter(q => q.t !== 'w').every(q => q.e && q.e.length >= 5), Q.filter(q => q.t !== 'w' && !(q.e && q.e.length >= 5)).map(q => q.id));
    ok('語群の問題：正解が語群にある', Q.filter(q => q.t === 'term').every(q => BANK.includes(q.a[0])));
    ok('語群の問題：問題文に答えの言葉が入っていない', Q.filter(q => q.t === 'term').every(q => !q.a.some(a => q.q.includes(a))), Q.filter(q => q.t === 'term' && q.a.some(a => q.q.includes(a))).map(q => q.id));
    ok('語群に重複がない', new Set(BANK).size === BANK.length);
    ok('数の問題：正解は有限の数、誤差は 0 以上', Q.filter(q => q.t === 'num').every(q => Number.isFinite(q.a) && (q.tol == null || q.tol >= 0)));
    ok('記述の問題：模範解答と観点2つ', Q.filter(q => q.t === 'w').every(q => q.m && q.k && q.k.length === 2));
    ok('問題の用語 term は用語欄にある', Q.every(q => !q.term || TERMS[q.term]), Q.filter(q => q.term && !TERMS[q.term]).map(q => q.term));
    ok('ページの章 sec は SECS にある', PAGES.every(P => SECS.includes(P.sec)), PAGES.filter(P => !SECS.includes(P.sec)).map(P => P.sec));
    ok('ページの用語は用語欄にある', PAGES.every(P => (P.terms || []).every(t => TERMS[t])), PAGES.flatMap(P => (P.terms || []).filter(t => !TERMS[t])));
    ok('ページの問題 q は問題にある', PAGES.every(P => !P.q || Q.some(q => q.id === P.q)));
    ok('ページのシミュレーターは SIMS にある', PAGES.every(P => !P.sim || SIMS[P.sim]));
    const ms = PAGES.filter(P => P.kind === 'sim');
    ok(`ミッションが ${EXPECT.missions} つ・id が重複なし・合格条件あり`, ms.length === EXPECT.missions && new Set(ms.map(P => P.id)).size === ms.length && ms.every(P => P.id && typeof P.ok === 'function'), ms.length);
    if (PAGES.some(P => P.kind === 'test'))
      ok('小テスト：分野ごとに出せる問題が足りる', Object.entries(TEST.plan).every(([c, n]) => Q.filter(q => q.ch === c && TEST.types.includes(q.t)).length >= n));
    ok('ページの並びが組み立てられる（FLOW）', FLOW.length >= PAGES.length);
    const words = Object.keys(TERMS).filter(t => !html.replace(/const TERMS[\s\S]*?\};/, '').includes(t));
    ok('用語欄の言葉は、どこかのページか問題で使っている', !words.length, words);
  }

  console.log('■ 2 計算の検証（独立に計算し直した値と突き合わせる）');
  {
    const w = open();
    for (const c of CALC) { let a; try { a = c.actual(w); } catch (e) { a = 'エラー: ' + e.message; } if (c.str !== undefined) ok(c.name, a === c.str && a !== '', { 教材: a, 独立計算: c.str }); else ok(c.name, typeof a === 'number' && Math.abs(a - c.expect) <= c.tol, { 教材: a, 独立計算: c.expect }); }
  }

  console.log('■ 3 通しで解く');
  for (const right of [true, false]) {
    const w = open();
    let guard = 0;
    while (guard++ < 500) {
      const P = cur(w);
      const qid = P.kind === 'drill' ? P.qid : P.q;
      if (qid && w.eval(`st.ans["${qid}"]`) === undefined) answer(w, w.eval(`QI["${qid}"]`), right);
      if (P.kind === 'test') await takeTest(w, right);
      if (P.kind === 'end') break;
      ok(`「次へ」が押せる（${P.sec}：${P.title || ''}${P.sub ? ' ' + P.sub : ''}）`, !$(w, '#next').disabled);
      click(w, '#next');
    }
    const n = w.eval('scoreBy().n');
    ok(right ? '全問正解：まとめの点が満点' : '全問不正解：まとめの点が 0', $(w, '#endScore').textContent === (right ? `${n} / ${n}` : `0 / ${n}`), $(w, '#endScore').textContent);
    if (w.eval('MISSIONS.length')) ok('まとめのミッション数の分母が、ミッションの数と同じ', $(w, '#endMis').textContent.endsWith('/ ' + w.eval('MISSIONS.length')));
    if (w.eval('st.test')) ok(right ? '小テスト：全問正解で満点' : '小テスト：全問不正解で 0 点', w.eval('st.test.score') === (right ? w.eval('st.test.set.length') : 0), w.eval('st.test.score'));
  }
  {
    const w = open();
    const qp = w.eval('FLOW.findIndex(P=>P.kind==="drill")');
    if (qp >= 0) {
      w.eval(`st.p=${qp};render()`);
      ok('答える前は「次へ」が押せない', $(w, '#next').disabled);
      answer(w, cur(w).qid && w.eval(`QI["${cur(w).qid}"]`), false);
      ok('まちがえても「次へ」が押せる（正解と解説が出る）', !$(w, '#next').disabled && /正解は|ちがいます/.test($(w, '#qbox').textContent));
    }
    const terms = Object.keys(w.eval('TERMS'));
    ok('右の用語欄が出る', !!$(w, '#gloss h2'));
    void terms;
  }

  console.log('■ 4 先生用（#sensei）');
  {
    const w = open({ hash: '#sensei' });
    ok('先生用の帯が出る', !$(w, '#sbar').hidden);
    ok('保存の箱が生徒と別', w.eval('KEY') !== open().eval('KEY') && /sensei/.test(w.eval('KEY')));
    const qp = w.eval('FLOW.findIndex(P=>P.kind==="drill")');
    if (qp >= 0) { w.eval(`st.p=${qp};render()`); ok('答えなくても次へ進める', !$(w, '#next').disabled); ok('正解の印が見える', !!$(w, '.sensei-ans')); }
    ok('ページへ飛ぶ選択肢が全ページ分ある', w.document.querySelectorAll('#sJump option').length === w.eval('FLOW.length'));
    const s = open(); ok('生徒の画面には先生用の帯が出ない', $(s, '#sbar').hidden && !$(s, '.sensei-ans'));
    s.document.dispatchEvent(new s.KeyboardEvent('keydown', { key: 'n' }));
    ok('N キーで先生用メモが出る', !$(s, '#note').hidden);
  }

  console.log('■ 5 保存');
  {
    const w = open(); const qp = w.eval('FLOW.findIndex(P=>P.kind==="drill")');
    w.eval(`st.p=${Math.max(qp, 1)};save();render()`);
    if (qp >= 0) answer(w, w.eval(`QI["${cur(w).qid}"]`), true);
    const key = w.eval('KEY'), saved = w.localStorage.getItem(key);
    const w2 = open({ store: { [key]: saved } });
    ok('開き直すと同じページから', w2.eval('st.p') === w.eval('st.p'));
    if (qp >= 0) ok('答えが残っている', JSON.stringify(w2.eval('st.ans')) === JSON.stringify(w.eval('st.ans')));
    const w3 = open({ store: { [key]: '{こわれた' } });
    ok('こわれた記録でも最初から動く', w3.eval('st.p') === 0 && !!$(w3, '#card h2'));
    const w4 = open({ noStorage: true });
    ok('localStorage が使えなくても動く', !!$(w4, '#card h2'));
    if (cur(w4).q) answer(w4, w4.eval(`QI["${cur(w4).q}"]`), false); // 1ページ目は予想の問題
    click(w4, '#next'); ok('localStorage が使えなくても次へ進める', w4.eval('st.p') === 1);
  }

  if (open().eval('FLOW.some(P=>P.kind==="test")')) {
    console.log('■ 6 小テスト');
    const toTest = w => { w.eval('st.p=FLOW.findIndex(P=>P.kind==="test");render()'); };
    {
      const w = open(); toTest(w);
      ok('受ける前は「次へ」が押せない', $(w, '#next').disabled);
      if (w.eval('TEST.no !== false')) {
        $(w, '#no').value = '12'; click(w, '#tgo'); ok('出席番号が4けたでないと始まらない', !w.eval('st.test') && /4けた/.test($(w, '#nomsg').textContent));
        $(w, '#no').value = '０１０２'; click(w, '#tgo'); ok('全角の数字でも始まる', w.eval('st.test && st.test.no') === '0102');
      } else { ok('出席番号を使わない設定：番号の欄がない', !$(w, '#no')); click(w, '#tgo'); ok('出席番号なしで始まる', !!w.eval('st.test')); }
      ok('受けている間は「前へ・次へ」を隠す', $(w, '#foot').hidden);
      const plan = w.eval('TEST.plan'), set = w.eval('st.test.set');
      ok('分野ごとの数どおりに出る', Object.entries(plan).every(([c, n]) => set.filter(id => w.eval(`QI["${id}"].ch`) === c).length === n) && new Set(set).size === set.length);
      ok('時間が表示される', /のこり \d+:\d\d/.test($(w, '#timer').textContent));
      w.eval('st.test.i=st.test.set.length;render()');
      click(w, '#send'); ok('未回答があると1回目の「提出する」では出さない', !w.eval('st.test.sent') && !!$(w, '.warn'));
      click(w, '.jump .btn[data-k="0"]'); ok('番号を押すとその問題へ', w.eval('st.test.i') === 0);
      w.eval('st.test.i=st.test.set.length;st.test.warn=true;render()'); click(w, '#send'); await sleep(1700);
      ok('2回目の「提出する」で提出', !!w.eval('st.test.sent'));
      const key = w.eval('KEY'); const w2 = open({ store: { [key]: w.localStorage.getItem(key) } }); toTest(w2);
      ok('提出後に開き直しても、結果のまま（受け直せない）', !!$(w2, '.rv') && !$(w2, '#tgo') && ![...w2.document.querySelectorAll('#card .btn')].some(b => /もう一度/.test(b.textContent)));
    }
    {
      const w = open(); toTest(w); if ($(w, '#no')) $(w, '#no').value = '0103'; click(w, '#tgo');
      const key = w.eval('KEY'); w.eval('st.test.dl=Date.now()-1000;save()');
      const w2 = open({ store: { [key]: w.localStorage.getItem(key) } }); toTest(w2); await sleep(50);
      ok('開き直したとき時間切れなら、その場で採点', !!w2.eval('st.test.sent') && w2.eval('st.test.timeUp') === true);
    }
    {
      const w = open({ hash: '#sensei' }); toTest(w); await takeTest(w, true, '9999');
      ok('先生用は何度でも受け直せる', [...w.document.querySelectorAll('#card .btn')].some(b => /もう一度/.test(b.textContent)));
    }
  }

  console.log('■ 7 エラー');
  ok('スクリプトのエラーがない', !errors.length, errors.slice(0, 5));

  console.log(`\n合格 ${pass} / 不合格 ${fail}`);
  process.exit(fail ? 1 : 0);
})().catch(e => { console.log('  NG  途中で止まった: ' + e.stack); process.exit(1); });
