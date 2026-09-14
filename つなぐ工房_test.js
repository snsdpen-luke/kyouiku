// つなぐ工房 リグレッション
//   node つなぐ工房_test.js つなぐ工房.html
// 確かめること
//   1. 端子名がすべて実在する（start / sol / halfway）
//   2. sol の配線で、すべての入力の組み合わせが ref と一致する
//   3. start の配線では ref と一致しない（＝課題が未完成である）
//   4. halfway は sol の一部で、まだ正解ではない
//   5. 切ったスイッチでランプが消える（電気が漏れていない）
const fs = require("fs");
const { JSDOM } = require("jsdom");

const file = process.argv[2] || "つなぐ工房.html";
const dom = new JSDOM(fs.readFileSync(file, "utf8"), { runScripts: "dangerously" });
const TK = dom.window.TK;
if (!TK) { console.error("NG: window.TK がない。スクリプトが動いていない"); process.exit(1); }

let pass = 0, fail = 0;
const ok = (cond, msg) => { if (cond) { pass++; } else { fail++; console.log("  NG  " + msg); } };

const termsOf = (l) => {
  const s = new Set();
  l.parts.forEach(p => { for (const k in TK.SHAPE[p.t].pins) s.add(p.id + "." + k); });
  return s;
};
const run = (l, wires, combo) => {
  const sw = {}; l.ins.forEach((n, i) => sw[n] = combo[i]);
  const ev = TK.evalBoard(l, wires, sw);
  return l.outs.map(n => ev.out[n]);
};
const want = (l, combo) => l.ref.apply(null, combo.map(v => !!v)).map(v => v ? 1 : 0);

for (const l of TK.LESSONS) {
  console.log(`■ ${l.name}`);
  const T = termsOf(l);

  // 1. 端子名
  [["start", l.start], ["sol", l.sol], ["halfway", l.halfway || []]].forEach(([nm, ws]) => {
    ws.forEach(w => {
      ok(T.has(w[0]), `${nm}: 端子 ${w[0]} が存在しない`);
      ok(T.has(w[1]), `${nm}: 端子 ${w[1]} が存在しない`);
    });
  });

  // 2. 正解配線で全パターン一致
  const cs = TK.combos(l.ins.length);
  let solOK = true;
  cs.forEach(c => {
    const got = run(l, l.sol, c), w = want(l, c);
    if (got.join() !== w.join()) { solOK = false;
      console.log(`  NG  sol: 入力 ${c.join("")} → ${got.join(",")} だが正解は ${w.join(",")}`); fail++; }
  });
  if (solOK) { pass++; console.log(`  ok  正解配線が ${cs.length} とおり全部で一致`); }

  // 3. 開始配線では未完成
  const startOK = cs.some(c => run(l, l.start, c).join() !== want(l, c).join());
  ok(startOK, "start: 最初から正解になっている（課題にならない）");
  if (startOK) console.log("  ok  開始時は未完成");

  // 4. halfway は sol の一部で、まだ正解でない
  if (l.halfway) {
    const inSol = w => l.sol.some(s => (s[0] === w[0] && s[1] === w[1]) || (s[0] === w[1] && s[1] === w[0]));
    ok(l.halfway.every(inSol), "halfway: sol に無い線が入っている");
    ok(cs.some(c => run(l, l.halfway, c).join() !== want(l, c).join()), "halfway: もう正解になっている");
    console.log("  ok  お手本(半分)は sol の一部で、まだ正解ではない");
  }

  // 5. 入力を全部 0 にしたとき、AND/直列系のランプが点かない（電気の漏れ検出）
  const zero = run(l, l.sol, cs[0]);
  ok(zero.join() === want(l, cs[0]).join(), "全部0のときの出力がおかしい（電気が漏れている）");
}

console.log(`\n合計 ${pass + fail} 件　合格 ${pass}　不合格 ${fail}`);
process.exit(fail ? 1 : 0);
