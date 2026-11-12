// 電波はどこまで届くか（/wifi/）の確認スクリプト（jsdom）。kyouzai スキルの形。
//   node regression-wifi.js 電波はどこまで届くか.html
// 見るもの：禁止事項／距離による弱まり方（説明・小テスト・ゲームを、独立に計算した値と突き合わせる）／まとめ画面の分母／全ページが開けるか
const fs = require('fs');
const { JSDOM, VirtualConsole } = require('jsdom');
const file = process.argv[2] || '電波はどこまで届くか.html';
const html = fs.readFileSync(file, 'utf8');
let pass = 0, fail = 0;
function ok(name, cond, extra) {
  if (cond) { pass++; console.log('  ok  ' + name); }
  else { fail++; console.log('  NG  ' + name + (extra !== undefined ? '  → ' + JSON.stringify(extra).slice(0, 300) : '')); }
}
const errors = [];
function open(store) {
  const vc = new VirtualConsole();
  vc.on('jsdomError', e => errors.push(e.message)); vc.on('error', m => errors.push(String(m)));
  const dom = new JSDOM(html, {
    runScripts: 'dangerously', pretendToBeVisual: true, url: 'https://example.test/wifi/', virtualConsole: vc,
    beforeParse(w) {
      if (store) w.localStorage.setItem('wifi-house-p', store);
      w.confirm = () => false; w.alert = () => { throw new Error('alert は使わない'); };
      // jsdom には canvas の描画がない。何もしない描画の部品を返す（描いた結果ではなく、計算と流れを見る）
      const noop = new Proxy(function () {}, { get: (t, k) => k === 'measureText' ? () => ({ width: 10 }) : k === 'createLinearGradient' || k === 'createRadialGradient' ? () => ({ addColorStop() {} }) : k === 'getImageData' || k === 'createImageData' ? () => ({ data: new Uint8ClampedArray(4) }) : noop, set: () => true, apply: () => undefined });
      w.HTMLCanvasElement.prototype.getContext = () => noop;
    },
  });
  return dom.window;
}

console.log('■ 禁止事項');
ok('confirm / alert を使っていない', !/\b(confirm|alert)\(/.test(html));
ok('ダークモードの切りかえがない', !/prefers-color-scheme:\s*dark/.test(html) && /color-scheme:\s*light/.test(html));
ok('外への通信がない（fetch / XMLHttpRequest / sendBeacon）', !/\bfetch\(|XMLHttpRequest|sendBeacon/.test(html));

console.log('■ 距離による弱まり方（独立に計算し直して突き合わせる）');
{
  const w = open();
  // 自由空間（逆二乗）：距離2倍で 1/2^2
  const free = 1 / 2 ** 2;
  // 屋内のモデル（距離の指数 n）：距離2倍で 10^(-n·log10(2))。このゲームは n=2.8 の想定
  const indoor = n => 10 ** (-n * Math.log10(2));
  // ゲームの式で、壁・床・電子レンジのない所の 3m と 6m をくらべる
  const ratio = w.eval(`(()=>{ const keep=WALLS.splice(0); const m=ST.micro; ST.micro=false; ST.band=0;
    const src={f:0,x:0,y:0}; const r3=rssiFrom(src,-30,0,3,0), r6=rssiFrom(src,-30,0,6,0);
    WALLS.push(...keep); ST.micro=m; return 10**((r6-r3)/10); })()`);
  ok('ゲームの式：壁のない所で距離2倍の弱まり方が、指数2.8の独立計算と同じ', Math.abs(ratio - indoor(2.8)) < 1e-9, { ゲーム: ratio, 独立計算: indoor(2.8) });
  ok('説明の「約 1/7」が、ゲームの式の値と合う（1/6.5〜1/7.5）', html.includes('約 1/7') && 1 / ratio > 6.5 && 1 / ratio < 7.5, 1 / ratio);
  ok('説明の「1/4」は、何もない広い場所（自由空間）の値と合う', free === 0.25 && /同じ光が4倍の広さに薄く広がる<\/b>ので、明るさは 1\/4/.test(html));
  ok('説明で「家の中では 1/4 よりもっと弱くなる」と言っている', /家の中<\/b>では[\s\S]{0,40}1\/4 よりもっと弱くなります/.test(html));
  // 小テストの問題はページの中に閉じているので、ソースの1行を読み取って確かめる
  const m = html.match(/\{q:"[^"]*3m の場所と 6m の場所[^"]*",o:\[[^\]]*\],a:\d+[^}]*\}/);
  const qq = m ? Function('return ' + m[0])() : null;
  ok('小テスト：問いが「壁も家具もない広い場所で」になっている', !!qq && /壁も家具もない広い場所で/.test(qq.q), qq && qq.q);
  ok('小テスト：正解が自由空間の独立計算（1/4）と同じ選択肢', !!qq && qq.o[qq.a] === '1/' + (1 / free), qq && qq.o[qq.a]);
  // 懐中電灯のデモ：n = round(2·log2(m)) は自由空間（半分1回＝−3dB）。2m で半分2回
  ok('懐中電灯のデモ：2m で半分が2回（自由空間の 1/4）', Math.round(2 * Math.log2(2)) === 2 && /Math\.round\(2\*Math\.log2\(m\)\)/.test(html));
}

console.log('■ まとめ画面の分母');
{
  let clear; try { clear = open().eval('LV.filter(L=>L.term).length'); } catch (e) { clear = 'LV が外から見えない: ' + e.message; }
  ok('合格のあるステージは5つ（6は自由に試す）', clear === 5, clear);
  const w = open(JSON.stringify({ name: 'テスト', stages: [1, 2, 3, 4, 5], terms: [], quiz: null, seen: [] }));
  const end = w.eval('S.length-1'); w.eval(`i=${end};render()`);
  const t = w.document.body.textContent;
  ok('全部クリアで「5 / 5」と出る（「5 / 4」にならない）', /クリアしたステージ\s*5 \/ 5/.test(t), (t.match(/クリアしたステージ[^ス]*/) || [''])[0].slice(0, 40));
  const w2 = open(JSON.stringify({ stages: [2] }));
  w2.eval(`i=${end};render()`);
  ok('1つだけクリアで「1 / 5」', /クリアしたステージ\s*1 \/ 5/.test(w2.document.body.textContent));
}

console.log('■ 全ページが開けるか');
{
  const w = open(); const n = w.eval('S.length');
  for (let k = 0; k < n; k++) w.eval(`i=${k};render()`);
  const game = w.eval(`S.findIndex(s=>String(s.sim).includes('stsel'))`);
  w.eval(`i=${game};render()`);
  ok('ゲームのページにステージの番号が6つ出る（LV を外に出しても動く）', w.document.querySelectorAll('#stsel .st').length === 6);
  w.document.querySelectorAll('#stsel .st')[4].click();
  ok('ステージ5を選べる', w.document.querySelector('#stsel .st.sel') && w.document.querySelector('#stsel .st.sel').dataset.k === '4');
  ok(`全 ${n} ページでスクリプトのエラーがない`, !errors.length, errors.slice(0, 3));
}

console.log(`\n合格 ${pass} / 不合格 ${fail}`);
process.exit(fail ? 1 : 0);
