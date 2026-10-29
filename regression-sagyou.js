/* 技能試験 作業シミュレータ リグレッションテスト
   使い方: npm install jsdom && node regression-sagyou.js 作業シミュレータ.html   */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const errs = [];
const vc = new VirtualConsole(); vc.on("jsdomError", e => errs.push(String(e && e.message || e)));
const TARGET = process.argv[2] || "作業シミュレータ.html";
console.log("対象: " + TARGET + "\n");
const dom = new JSDOM(fs.readFileSync(TARGET, "utf8"), { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.org/" });
const w = dom.window, d = w.document, $ = id => d.getElementById(id), E = s => w.eval(s);
w.onerror = (m, s, l, c, e) => { errs.push((e && e.stack || m).split("\n")[0]); return true; };
let fail = 0;
const ok = (c, m) => { if (!c) { fail++; console.log("  ✗ " + m); } else console.log("  ✓ " + m); };
const tap = sel => { const el = d.querySelector(sel); if (!el) throw new Error("見つからない: " + sel); el.dispatchEvent(new w.MouseEvent("click", { bubbles: true })); };

/* 正しい作業の値（テストだけで使う。アプリには答えを出すボタンを置かない） */
E(`window.goodParams = u => {
  const t = teach(), mid = a => Math.round((a[0] + a[1]) / 2);
  if (u.kind === "cut") { const r = { done: true, len: {} }; t.cut.forEach(c => { r.len[c.n] = c.len; }); return r; }
  if (u.kind === "piece") { const r = { done: true, ends: {} };
    ["a", "b"].forEach(sd => { const k = endKind(u.piece, sd); if (k === "none") { r.ends[sd] = { sheath: 0, core: 0 }; return; }
      const g = guideOf(k), core = { joint: 20, conn: gaugeOf("conn"), ring: 20, push: gaugeOf("push"), ceil: gaugeOf("ceil"), block: 11 }[k];
      r.ends[sd] = { sheath: k === "joint" || k === "conn" ? 100 : mid(g.sheath), core }; });
    return r; }
  if (u.kind === "box") { const r = { done: true, j: {} };
    u.joints.forEach(j => { if (u.conn) { r.j[j.id] = { conn: String(j.n), deep: true }; return; }
      const s = sleeveFor(j.n16, j.n20); r.j[j.id] = { size: s.size, mark: s.mark, align: true, gap: 2, tip: 2 }; });
    return r; }
  const kind = u.work[0], r = { done: true, jump: { ring: 20, push: gaugeOf("push"), ceil: gaugeOf("ceil"), block: 11 }[kind], bend: 3, dir: "右", wrap: 1, conn: {}, face: "表", pos: {} };
  const n = u.frame.length, order = t && t.frame && t.frame.order.every(id => u.frame.includes(id)) ? t.frame.order : u.frame;
  order.forEach((id, i) => { r.pos[id] = n === 1 ? "中央" : n === 2 ? ["上", "下"][i] : ["上", "中央", "下"][i]; });
  connRows(u).forEach(x => { r.conn[x.key] = x.e.part + "." + x.e.term; });
  return r; };
window.defsOf = (u, r) => evalUnit(u, r).defects.map(x => x.key);
window.allGood = () => units().forEach(u => { store[P.id][u.id] = goodParams(u); });`);

console.log("【A】全13問: 正しく作業すると欠陥なし・何もしないと未完成");
for (const id of JSON.parse(E("JSON.stringify(KIT.map(p=>p.id))"))) {
  const r = JSON.parse(E(`(()=>{ openProb(${JSON.stringify(id)}); const out = { n: 0, bad: [], tips: [], empty: [] };
    store[P.id] = {}; allGood();
    units().forEach(u => { out.n++; const res = evalUnit(u, goodParams(u)); if (res.defects.length) out.bad.push(u.name + ": " + res.defects.map(x => x.where).join(" / "));
      if (res.tips.length) out.tips.push(u.name + ": " + res.tips.join(" / "));
      const e = evalUnit(u, Object.assign(defaults(u), { done: true })); if (!e.defects.some(x => x.def === DEF.unfinished) && !(u.kind === "piece" && ["a","b"].every(s => endKind(u.piece, s) === "none"))) out.empty.push(u.name); });
    store[P.id] = {}; return JSON.stringify(out); })()`));
  ok(r.n > 0 && !r.bad.length && !r.tips.length, `No.${id.slice(1)}: ${r.n} の作業すべて、正しい値なら欠陥・目安はずれ 0` + (r.bad.length ? " ← " + r.bad.join(" | ") : "") + (r.tips.length ? " ← 目安 " + r.tips.join(" | ") : ""));
  ok(!r.empty.length, `No.${id.slice(1)}: 何もしないと、どの作業も「未完成」` + (r.empty.length ? " ← " + r.empty.join(", ") : ""));
}

console.log("\n【B】ケーブルの1本1本（VVF 2C×2 は2本に分ける）");
E(`openProb("k1")`);
ok(E("pieces().length") === 7 && E("pieces().map(p=>p.cut.n).join()") === "1,2,3,4,5,6,7", "No.1 のケーブルは資料と同じ7本（3・4 は VVF 2C×2 を2本に分けたもの）");
ok(E("pieces().filter(p=>p.c.id==='c2').every(p=>p.wires.map(x=>x.w.color).sort().join()==='白,黒')"), "2C×2 の2本は、それぞれ黒と白が1本ずつ");
ok(E("JSON.stringify(units().map(u=>u.kind))") === JSON.stringify(["cut", "piece", "piece", "piece", "piece", "piece", "piece", "piece", "dev", "dev", "dev", "box", "box"]), "作業の並び: 切る → 外装・被覆をはがす（7本）→ 器具につける → ボックスでつなぐ（資料の ②〜⑦ の順）");
ok(E("['a','b'].map(s=>endKind(pieces()[0],s)).join()") === "none,joint" && E("['a','b'].map(s=>endKind(pieces()[6],s)).join()") === "none,conn", "電源側・施工省略側は「はがない」、A はリングスリーブ、B は差込形コネクタ");

console.log("\n【C】ケーブルの端の欠陥（③ 外装・被覆をはがす）");
const pe = (sel, sd, mut) => JSON.parse(E(`(()=>{ const u = units().find(${sel}), r = goodParams(u); (${mut})(r.ends[${JSON.stringify(sd)}]); return JSON.stringify(defsOf(u, r).concat(evalUnit(u, r).tips.length ? ["tip"] : [])); })()`));
const joint = "u=>u.kind==='piece'&&u.piece.cut.n===2";   // A 〜 引掛シーリング（左: シーリング、右: A）
const lampP = "u=>u.kind==='piece'&&u.piece.cut.n===6";   // B 〜 ランプレセプタクル
E(`openProb("k1")`);
ok(E("endKind(units().find(" + joint + ").piece,'b')") === "joint" && E("endKind(units().find(" + joint + ").piece,'a')") === "ceil", "2 は シーリング側（差込）と A 側（リングスリーブ）の両端を加工する");
ok(pe(joint, "b", e => { e.sheath = 40; e.core = 20; }).includes("sheathShort") && !pe(joint, "b", e => { e.sheath = 41; e.core = 20; }).includes("sheathShort"), "A 側: 外装40・被覆20（被覆が20mm）は欠陥、41mm は欠陥でない（絶縁被覆が20mm以下）");
ok(pe(joint, "b", e => { e.core = 10; }).includes("onInsul"), "A 側: 被覆を短くはぐ → スリーブの中に被覆が入る");
ok(pe(joint, "a", e => { e.core = 13; }).includes("pushExpose") && !pe(joint, "a", e => { e.core = 12; }).includes("pushExpose"), "シーリング側: 資料のゲージ12mm に 13mm（1mm 見える）は欠陥");
ok(pe(lampP, "a", e => { e.sheath = 60; }).includes("noBase"), "ランプレセプタクル側: 外装をはぎすぎ → 台座に入らない");
ok(pe("u=>u.kind==='piece'&&u.piece.cut.n===5", "b", e => { e.core = 14; }).includes("connBottom") && pe("u=>u.kind==='piece'&&u.piece.cut.n===5", "b", e => { e.core = 10; }).includes("connTip"), "B 側: 被覆14mm（根元に心線）・10mm（先が届かない）→ 欠陥（ゲージ12mm）");
ok(pe("u=>u.kind==='piece'&&u.piece.cut.n===1", "a", e => { e.sheath = 50; e.core = 20; }).includes("tip") && !pe("u=>u.kind==='piece'&&u.piece.cut.n===1", "a", e => { e.sheath = 50; e.core = 20; }).includes("unfinished"), "電源側をはぐ → 「はがない」の目安（欠陥ではない）");
const dev = (type, mut) => JSON.parse(E(`(()=>{ for (const p of KIT) { if (TEACH[p.id]) continue; openProb(p.id); const u = units().find(u => u.kind === "piece" && ["a","b"].some(s => endKind(u.piece, s) === ${JSON.stringify(type)}));
  if (u) { const r = goodParams(u), sd = endKind(u.piece, "a") === ${JSON.stringify(type)} ? "a" : "b"; (${mut})(r.ends[sd]); return JSON.stringify(defsOf(u, r)); } } return "[]"; })()`));
ok(dev("push", e => { e.core = 14; }).includes("pushExpose") && !dev("push", e => { e.core = 13; }).includes("pushExpose"), "埋込器具（資料の無い問題 ゲージ12mm）: 14mm は欠陥、13mm は欠陥でない");
ok(dev("push", e => { e.core = 8; }).includes("pullOut"), "埋込器具: 被覆を短くはぐ → 引っ張って外れる");
ok(dev("ceil", e => { e.sheath = 30; }).includes("ceilInsul"), "引掛シーリング: 被覆が台座から5mm以上出る → 欠陥");
ok(dev("block", e => { e.core = 15; }).includes("blockExpose") && dev("block", e => { e.core = 5; }).includes("notScrewed"), "端子台: 心線 5mm 出る・ねじが心線を締めない → 欠陥");

console.log("\n【D】器具につける・ボックスでつなぐ");
const un = (sel, mut) => JSON.parse(E(`(()=>{ openProb("k1"); const u = units().find(${sel}), r = goodParams(u); (${mut})(r, u); return JSON.stringify(defsOf(u, r).concat(evalUnit(u, r).tips.length ? ["tip"] : [])); })()`));
const lampD = "u=>u.place==='Lb'", sw = "u=>u.place==='SW'", A = "u=>u.box==='B1'", B = "u=>u.box==='B2'";
ok(un(lampD, r => { r.dir = "左"; }).includes("leftWrap"), "輪作り: 左巻き → 欠陥");
ok(un(lampD, r => { r.wrap = 0.5; }).includes("wrapBad") && un(lampD, r => { r.wrap = 1.25; }).includes("wrapBad"), "輪作り: 半周（不足）・重ね巻き → 欠陥");
ok(un(lampD, r => { r.bend = 5; }).includes("ringExpose") && !un(lampD, r => { r.bend = 4; }).includes("ringExpose"), "輪作り: ねじの端から心線 5mm は欠陥、4mm は欠陥でない");
ok(un(lampD, r => { const ks = Object.keys(r.conn); const a = r.conn[ks[0]]; r.conn[ks[0]] = r.conn[ks[1]]; r.conn[ks[1]] = a; }).some(k => k === "polarity" || k === "wrongTerm"), "ランプレセプタクル: 白と黒を入れ替える → 極性（W は白）か誤結線");
ok(un(sw, r => { r.pos.Sb = "上"; r.pos.Sa = "中央"; }).includes("frameCenter"), "ロを中央に付けない → 欠陥（施工条件）");
ok(un(sw, r => { r.pos.Sa = "下"; r.pos.Sc = "上"; }).includes("frameOrder"), "上からイ・ロ・ハでない → 配置の欠陥");
ok(un(sw, r => { r.face = "裏"; }).includes("frameFlip"), "取付枠を裏返し → 欠陥");
ok(un(sw, r => { r.jump = 12; }).includes("pushExpose"), "わたり線: 資料のゲージ 約10mm に 12mm → 心線が2mm見える");
ok(!un(sw, r => { Object.keys(r.conn).forEach(k => { if (r.conn[k] === "Sb.1") r.conn[k] = "Sb.2"; else if (r.conn[k] === "Sb.2") r.conn[k] = "Sb.1"; }); }).includes("wrongTerm"), "スイッチの 1・2 は入れ替えても誤結線にならない");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].size = r.j[j].size === "小" ? "中" : "小"; }).includes("sleevePick"), "A: スリーブの大きさ違い → 欠陥");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].mark = r.j[j].mark === "○" ? "小" : "○"; }).includes("sleeveMark"), "A: ダイス違い → 圧着マークが不適正");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].tip = 5; }).includes("tipLong") && !un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].tip = 4; }).includes("tipLong"), "A: 先端 5mm は欠陥、4mm は欠陥でない");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].tip = 3; }).includes("tip"), "A: 先端 3mm は資料の目安（1〜2mm）より長い（欠陥ではない）");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].tip = -1; }).includes("tipHidden") && un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].align = false; }).includes("tipHidden"), "A: 切りすぎ・先をそろえていない → 先端が見えない");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].gap = 10; }).includes("overStrip") && !un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].gap = 9; }).includes("overStrip"), "A: 被覆との間 10mm は欠陥、9mm は欠陥でない");
ok(un(A, (r) => { const j = Object.keys(r.j)[0]; r.j[j].gap = 0; }).includes("onInsul"), "A: 被覆との間 0mm → 絶縁被覆の上から圧着");
ok(un(B, (r) => { const j = Object.keys(r.j)[0]; r.j[j].conn = "4"; }).includes("connPick") && un(B, (r) => { const j = Object.keys(r.j)[0]; r.j[j].deep = false; }).includes("connTip"), "B: 本数に合わないコネクタ・途中まで → 欠陥");

console.log("\n【E】リングスリーブの表（JIS C 2806）");
{ const T = (a, b) => JSON.stringify(E(`sleeveFor(${a},${b})`));
  ok(T(2, 0) === '{"size":"小","mark":"○"}' && T(3, 0) === '{"size":"小","mark":"小"}' && T(5, 0) === '{"size":"中","mark":"中"}', "1.6mm: 2本 小・○、3本 小・小、5本 中・中");
  ok(T(0, 2) === '{"size":"小","mark":"小"}' && T(1, 1) === '{"size":"小","mark":"小"}' && T(3, 1) === '{"size":"中","mark":"中"}' && T(1, 2) === '{"size":"中","mark":"中"}', "2.0mm×2 小・小、2.0+1.6 小・小、2.0+1.6×3 中、2.0×2+1.6 中"); }

console.log("\n【F】作業の順番");
E(`openProb("k2"); setMode("order"); startOrder("ring"); drawOrder();`);
tap('#pool [data-c="r3"]');
ok(/まだ早い/.test($("omsg").textContent) && /シース/.test($("omsg").textContent) && E("orderState.miss") === 1, "シースをはぐ前に被覆をはぐ → 「まだ早い」と理由");
["r2", "r3", "r4"].forEach(c => tap(`#pool [data-c="${c}"]`));
tap('#pool [data-c="r5"]'); ok(/台座/.test($("omsg").textContent), "台座に通す前に輪を作る → 「台座の穴を通らなくなる」");
["r1", "r5", "r6"].forEach(c => tap(`#pool [data-c="${c}"]`));
ok(E("orderState.pool.length") === 0 && /間違い/.test($("body").textContent), "全部並べると、間違いの回数を言う");
E(`startOrder("flow"); drawOrder();`); ["b", "a", "c", "e", "d", "f"].forEach(c => tap(`#pool [data-c="${c}"]`));
ok(E("orderState.miss") === 0 && E("orderState.pool.length") === 0, "全体の流れ: 決まった前後だけを見る");
E(`openProb("k1"); setMode("order"); startOrder("flow"); drawOrder();`);
ok(E("orderDef('flow').cards.length") === 8 && /資料の8つ/.test(d.querySelector("#side").textContent), "No.1 の全体の流れは、資料の8つ");
["t1", "t2", "t3", "t6", "t4", "t7", "t5", "t8"].forEach(c => tap(`#pool [data-c="${c}"]`));
ok(E("orderState.pool.length") === 0 && E("orderState.miss") === 0 && /40 分/.test($("body").textContent), "④〜⑦は、はいだあとならどれからでもよい。目安 合わせて40分");
ok(E(`JSON.stringify(orderSetsFor())`) === JSON.stringify(["flow", "ring", "push", "ceil", "sleeve", "conn"]), "No.1 には、差込形コネクタの順番もある");

console.log("\n【G】画面");
E(`openProb("k1"); store[P.id] = {}; setMode("work"); unitId = units()[1].id; draw();`);
ok(d.querySelector("#bench") && d.querySelectorAll('#bench [data-h]').length === 2 && /はがない/.test($("body").textContent), "1. 電源〜A: ケーブルの図に、A 側だけ ▼外装・▲被覆 のつまみ（電源側は はがない）");
E(`unitId = units().find(u=>u.kind==='piece'&&u.piece.cut.n===2).id; draw();`);
ok(d.querySelectorAll('#bench [data-h]').length === 4 && /引掛シーリング（角） イ 側/.test($("body").textContent) && /ボックス A（B1） 側/.test($("body").textContent), "2. A〜引掛シーリング: 両端（シーリング側と A 側）に つまみ");
tap('button[data-e="b"][data-f="sheath"][data-d="5"]'); tap('button[data-e="b"][data-f="sheath"][data-d="5"]'); tap('button[data-e="b"][data-f="core"][data-d="5"]');
ok(E("store[P.id][unitId].ends.b.sheath") === 10 && E("store[P.id][unitId].ends.b.core") === 5 && /外装 10/.test($("bench").innerHTML), "＋ボタンで外装・被覆の長さが変わり、図に寸法線が出る");
tap('button[data-e="b"][data-f="core"][data-d="5"]'); tap('button[data-e="b"][data-f="core"][data-d="5"]');
ok(E("store[P.id][unitId].ends.b.core") === 10, "被覆は外装より長くはげない");
tap("#finish"); ok(/欠陥/.test($("res").textContent), "終えると、その端ごとの点検が出る");
E(`setMode("check")`); ok(/不合格/.test(d.querySelector(".verdict").textContent), "点検: 欠陥があれば不合格");
E(`allGood(); drawCheck();`);
ok(/合格/.test(d.querySelector(".verdict").textContent) && !/不合格/.test(d.querySelector(".verdict").textContent) && d.querySelectorAll("#chk .issue.good").length === 8, "点検: 全部正しく作業すれば合格・資料の見直し8つが ☑");
E(`store[P.id]["pl:SW"].face = "裏"; drawCheck();`);
ok([...d.querySelectorAll("#chk .issue")].some(x => /✗/.test(x.textContent) && /中央/.test(x.textContent)), "枠を裏返すと「ロのスイッチは取付枠の中央か」に ✗");
E(`store[P.id] = {}; save();`);

console.log("\n【Z】後始末");
ok(!errs.length, "スクリプトエラーなし" + (errs.length ? " ← " + errs.join(" | ") : ""));
console.log(fail ? `\n✗ 不合格 ${fail} 項目` : "\n✓ すべて合格");
process.exit(fail ? 1 : 0);
