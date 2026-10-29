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
  const t = teach();
  if (u.kind === "cut") { const r = { done: true, len: {} }; t.cut.forEach(c => { r.len[c.n] = c.len; }); return r; }
  if (u.kind === "box") { const g = guideOf(u.conn ? "conn" : "joint"), r = { done: true, sheath: {}, core: u.conn ? gaugeOf("conn") : 20, j: {} };
    P.cables.filter(c => c.a === u.box || c.b === u.box).forEach(c => { r.sheath[c.id] = 100; });
    u.joints.forEach(j => { if (u.conn) { r.j[j.id] = { conn: String(j.n), deep: true }; return; }
      const s = sleeveFor(j.n16, j.n20); r.j[j.id] = { size: s.size, mark: s.mark, align: true, gap: 2, tip: 2 }; });
    return r; }
  const kind = u.work[0], g = guideOf(kind), core = { ring: 20, push: gaugeOf("push"), ceil: gaugeOf("ceil"), block: 11 }[kind];
  const r = { done: true, sheath: {}, core: {}, bend: 3, dir: "右", wrap: 1, conn: {}, face: "表", pos: {} };
  cablesAt(u.place).forEach(({ c }) => { r.sheath[c.id] = Math.round((g.sheath[0] + g.sheath[1]) / 2); r.core[c.id] = core; });
  r.core.jump = core;
  const n = u.frame.length, order = t && t.frame && t.frame.order.every(id => u.frame.includes(id)) ? t.frame.order : u.frame;
  order.forEach((id, i) => { r.pos[id] = n === 1 ? "中央" : n === 2 ? ["上", "下"][i] : ["上", "中央", "下"][i]; });
  connRows(u).forEach(x => { r.conn[x.key] = x.e.part + "." + x.e.term; });
  return r; };
window.defsOf = (u, r) => evalUnit(u, r).defects.map(x => Object.keys(DEF).find(k => DEF[k] === x.def));`);

console.log("【A】全13問: 正しく作業すると欠陥なし・何もしないと未完成");
for (const id of JSON.parse(E("JSON.stringify(KIT.map(p=>p.id))"))) {
  const r = JSON.parse(E(`(()=>{ openProb(${JSON.stringify(id)}); const out = { n: 0, bad: [], tips: 0, empty: [] };
    units().forEach(u => { out.n++; const res = evalUnit(u, goodParams(u)); if (res.defects.length) out.bad.push(u.name + ": " + res.defects.map(x => x.where).join(" / "));
      out.tips += res.tips.length; const e = evalUnit(u, Object.assign(defaults(u), { done: true })); if (!e.defects.some(x => x.def === DEF.unfinished)) out.empty.push(u.name); });
    return JSON.stringify(out); })()`));
  ok(r.n > 0 && !r.bad.length && !r.tips, `No.${id.slice(1)}: ${r.n} の作業すべて、正しい値なら欠陥・目安はずれ 0` + (r.bad.length ? " ← " + r.bad.join(" | ") : ""));
  ok(!r.empty.length, `No.${id.slice(1)}: 何もしないと、どの作業も「未完成」` + (r.empty.length ? " ← " + r.empty.join(", ") : ""));
}

console.log("\n【B】リングスリーブ（JIS C 2806）");
{ const T = (a, b) => JSON.stringify(E(`sleeveFor(${a},${b})`));
  ok(T(2, 0) === '{"size":"小","mark":"○"}' && T(3, 0) === '{"size":"小","mark":"小"}' && T(5, 0) === '{"size":"中","mark":"中"}', "1.6mm: 2本 小・○、3本 小・小、5本 中・中");
  ok(T(0, 2) === '{"size":"小","mark":"小"}' && T(1, 1) === '{"size":"小","mark":"小"}' && T(3, 1) === '{"size":"中","mark":"中"}' && T(1, 2) === '{"size":"中","mark":"中"}', "2.0mm×2 小・小、2.0+1.6 小・小、2.0+1.6×3 中、2.0×2+1.6 中"); }
E(`openProb("k1")`);
const box = "units().find(u => u.kind === 'box')";
const jd = (mut) => JSON.parse(E(`(()=>{ const u = ${box}, r = goodParams(u), j = u.joints[0], x = r.j[j.id]; (${mut})(r, x, j); return JSON.stringify(defsOf(u, r)); })()`));
ok(jd("(r,x,j)=>{ x.size = x.size === '小' ? '中' : '小'; }").includes("sleevePick"), "スリーブの大きさ違い → 「リングスリーブの選択を誤ったもの」");
ok(jd("(r,x,j)=>{ x.mark = x.mark === '○' ? '小' : '○'; }").includes("sleeveMark"), "ダイス違い → 「圧着マークが不適正のもの」");
ok(jd("(r,x)=>{ x.tip = 5; }").includes("tipLong") && !jd("(r,x)=>{ x.tip = 4; }").includes("tipLong"), "先端 5mm は欠陥、4mm は欠陥でない（上端から5mm以上）");
ok(jd("(r,x)=>{ x.tip = -1; }").includes("tipHidden") && jd("(r,x)=>{ x.align = false; }").includes("tipHidden"), "切りすぎ・先をそろえていない → 先端が見えない");
ok(jd("(r,x)=>{ x.gap = 10; }").includes("overStrip") && !jd("(r,x)=>{ x.gap = 9; }").includes("overStrip"), "被覆との間 10mm は欠陥、9mm は欠陥でない（下端から10mm以上）");
ok(jd("(r,x)=>{ x.gap = 0; }").includes("onInsul"), "被覆との間 0mm → 「絶縁被覆の上から圧着したもの」");
ok(jd("(r)=>{ const k = Object.keys(r.sheath)[0]; r.sheath[k] = 40; }").includes("sheathShort") && !jd("(r)=>{ const k = Object.keys(r.sheath)[0]; r.sheath[k] = 41; }").includes("sheathShort"), "シース40mm・被覆20mm（被覆20mm）は欠陥、41mm は欠陥でない（絶縁被覆が20mm以下）");

console.log("\n【C】器具への結線");
const dev = (type, mut) => JSON.parse(E(`(()=>{ for (const p of KIT) { if (TEACH[p.id]) continue; openProb(p.id); const u = units().find(u => u.kind === "dev" && u.work[0] === ${JSON.stringify(type)});
  if (u) { const r = goodParams(u); (${mut})(r, u); return JSON.stringify(defsOf(u, r)); } } return "null"; })()`));
ok(dev("ring", r => { r.dir = "左"; }).includes("leftWrap"), "輪作り: 左巻き → 欠陥");
ok(dev("ring", r => { r.wrap = 0.5; }).includes("wrapBad") && dev("ring", r => { r.wrap = 1.25; }).includes("wrapBad"), "輪作り: 半周（不足）・重ね巻き → 欠陥");
ok(dev("ring", r => { r.bend = 5; }).includes("ringExpose") && !dev("ring", r => { r.bend = 4; }).includes("ringExpose"), "輪作り: ねじの端から心線 5mm は欠陥、4mm は欠陥でない");
ok(dev("ring", r => { const k = Object.keys(r.sheath)[0]; r.sheath[k] = 60; }).includes("noBase"), "ランプレセプタクル: シースをはぎすぎ → 外装が台座に入らない");
ok(dev("push", r => { const k = Object.keys(r.sheath)[0]; r.core[k] = 14; }).includes("pushExpose") && !dev("push", r => { const k = Object.keys(r.sheath)[0]; r.core[k] = 13; }).includes("pushExpose"), "埋込器具: ゲージ12mm に 14mm（2mm 見える）は欠陥、13mm は欠陥でない");
ok(dev("push", r => { const k = Object.keys(r.sheath)[0]; r.core[k] = 8; }).includes("pullOut"), "埋込器具: 被覆を短くはぐ → 引っ張って外れる");
ok(dev("ceil", r => { const k = Object.keys(r.sheath)[0]; r.core[k] = 11; }).includes("pushExpose"), "引掛シーリング: 1mm 見えると欠陥");
ok(dev("ceil", r => { const k = Object.keys(r.sheath)[0]; r.sheath[k] = 30; }).includes("ceilInsul"), "引掛シーリング: 被覆が台座から5mm以上出る → 欠陥");
ok(dev("block", r => { const k = Object.keys(r.sheath)[0]; r.core[k] = 15; }).includes("blockExpose") && dev("block", r => { const k = Object.keys(r.sheath)[0]; r.core[k] = 5; }).includes("notScrewed"), "端子台: 心線 5mm 出る・ねじが心線を締めない → 欠陥");
ok(dev("ring", (r, u) => { const ks = Object.keys(r.conn); const a = r.conn[ks[0]]; r.conn[ks[0]] = r.conn[ks[1]]; r.conn[ks[1]] = a; }).some(k => k === "polarity" || k === "wrongTerm"), "ランプレセプタクル: 白と黒を入れ替える → 極性（W は白）か誤結線");
{ const res = dev("push", (r, u) => { const k = Object.keys(r.conn).find(k => /\.1$/.test(r.conn[k]) && partOf(r.conn[k].split(".")[0]).type === "sw1"); if (k) { r.conn[k] = r.conn[k].replace(/\.1$/, ".2"); r.swapped = 1; } });
  ok(!res.includes("wrongTerm"), "スイッチの 1・2 は入れ替えても誤結線にならない"); }

console.log("\n【D】作業の順番");
E(`openProb("k2"); setMode("order"); startOrder("ring"); drawOrder();`);
tap('#pool [data-c="r3"]');
ok(/まだ早い/.test($("omsg").textContent) && /シース/.test($("omsg").textContent) && E("orderState.miss") === 1, "シースをはぐ前に被覆をはぐ → 「まだ早い」と理由");
["r2", "r3", "r4"].forEach(c => tap(`#pool [data-c="${c}"]`));
tap('#pool [data-c="r5"]'); ok(/台座/.test($("omsg").textContent), "台座に通す前に輪を作る → 「台座の穴を通らなくなる」");
["r1", "r5", "r6"].forEach(c => tap(`#pool [data-c="${c}"]`));
ok(E("orderState.pool.length") === 0 && /間違い/.test($("body").textContent), "全部並べると、間違いの回数を言う");
E(`startOrder("flow"); drawOrder();`); ["b", "a", "c", "e", "d", "f"].forEach(c => tap(`#pool [data-c="${c}"]`));
ok(E("orderState.miss") === 0 && E("orderState.pool.length") === 0, "全体の流れ: 複線図が先・ボックス接続が先でもよい（決まった前後だけを見る）");
ok(E(`JSON.stringify(orderSetsFor())`) === JSON.stringify(["flow", "ring", "push", "sleeve"]), "No.2 では、出てくる作業の順番だけを選べる");

console.log("\n【G】先生の資料（No.1）");
E(`openProb("k1"); setMode("order"); startOrder("flow"); drawOrder();`);
ok(E("orderDef('flow').cards.length") === 8 && /資料の8つ/.test(d.querySelector("#side").textContent) && /先生の配布資料/.test(d.querySelector("#side").textContent), "No.1 の全体の流れは、資料の8つ（①複線図〜⑧見直す）");
tap('#pool [data-c="t3"]'); ok(/まだ早い/.test($("omsg").textContent), "資料の順: ケーブルを切る前に はがす → まだ早い");
["t1", "t2", "t3", "t6", "t4", "t7", "t5", "t8"].forEach(c => tap(`#pool [data-c="${c}"]`));
ok(E("orderState.pool.length") === 0 && /40 分/.test($("body").textContent), "④〜⑦は、はいだあとならどれからでもよい。目安の時間 合わせて40分");
ok(E(`JSON.stringify(orderSetsFor())`) === JSON.stringify(["flow", "ring", "push", "ceil", "sleeve", "conn"]), "No.1 には、差込形コネクタの順番もある（B は差込形コネクタ）");
ok(E("units()[0].kind") === "cut" && E("units().find(u=>u.box==='B2').conn") === true && /A（B1）/.test(E("units().find(u=>u.box==='B1').name")), "No.1 の作業: ケーブルを切る・A（B1）はリングスリーブ・B（B2）は差込形コネクタ");
const k1 = (sel, mut) => JSON.parse(E(`(()=>{ openProb("k1"); const u = units().find(${sel}), r = goodParams(u); (${mut})(r, u); return JSON.stringify(defsOf(u, r).concat(evalUnit(u, r).tips.length ? ["tip"] : [])); })()`));
ok(k1("u=>u.kind==='cut'", r => {}).length === 0, "切る長さを資料どおり（250・300・300・300・350・300・250）にすると欠陥なし");
ok(k1("u=>u.kind==='cut'", r => { r.len[2] = 280; }).includes("tip") && !k1("u=>u.kind==='cut'", r => { r.len[2] = 280; }).includes("dimShort") && k1("u=>u.kind==='cut'", r => { r.len[2] = 220; }).includes("dimShort"), "2 を 280mm → 資料と違う（目安・欠陥ではない）、220mm（図の150が70になる）→ 寸法50%以下の欠陥");
ok(k1("u=>u.conn", r => { const j = Object.keys(r.j)[0]; r.j[j].conn = "4"; }).includes("connPick"), "B: 本数に合わないコネクタ → 欠陥");
ok(k1("u=>u.conn", r => { r.core = 14; }).includes("connBottom") && k1("u=>u.conn", r => { r.core = 10; }).includes("connTip"), "B: 被覆14mm（根元に心線）・10mm（先が見えない）→ 欠陥（ゲージ12mm）");
ok(k1("u=>u.conn", r => { const j = Object.keys(r.j)[0]; r.j[j].deep = false; }).includes("connTip"), "B: 途中まで → 先から心線が見えない");
ok(k1("u=>u.place==='SW'", r => { r.pos.Sb = "上"; r.pos.Sa = "中央"; }).includes("frameCenter"), "ロを中央に付けない → 欠陥（施工条件）");
ok(k1("u=>u.place==='SW'", r => { r.pos.Sa = "下"; r.pos.Sc = "上"; }).includes("frameOrder"), "上からイ・ロ・ハでない → 配置の欠陥");
ok(k1("u=>u.place==='SW'", r => { r.face = "裏"; }).includes("frameFlip"), "取付枠を裏返し → 欠陥");
ok(k1("u=>u.place==='SW'", r => { const k = Object.keys(r.core).find(k=>k!=="jump"); r.core[k] = 12; }).includes("pushExpose"), "スイッチ: 資料のゲージ 約10mm に 12mm → 心線が2mm見える");
ok(k1("u=>u.box==='B1'", r => { const j = Object.keys(r.j)[0]; r.j[j].tip = 3; }).includes("tip"), "A: 先端 3mm は資料の目安（1〜2mm）より長い（欠陥ではない）");
E(`openProb("k1"); units().forEach(u => { store[P.id][u.id] = goodParams(u); }); setMode("check");`);
ok(d.querySelectorAll("#chk .issue.good").length === 8 && /合格/.test(d.querySelector(".verdict").textContent), "点検: 資料の⑧見直すチェック 8つが全部 ☑");
E(`store[P.id]["pl:SW"].face = "裏"; drawCheck();`);
ok([...d.querySelectorAll("#chk .issue")].some(x => /✗/.test(x.textContent) && /中央/.test(x.textContent)), "枠を裏返すと「ロのスイッチは取付枠の中央か」に ✗");
E(`store[P.id] = {}; save();`);

console.log("\n【E】画面");
E(`setMode("work")`);
ok(d.querySelectorAll("#side .list button").length === E("units().length") && d.querySelector("#body input[type=range]"), "作業の一覧と、はぐ長さのスライダー");
tap("#finish"); ok(/欠陥/.test($("res").textContent) && /未完成/.test($("res").textContent), "何もせずに終えると、未完成の欠陥が出る");
E(`setMode("check")`); ok(/不合格/.test(d.querySelector(".verdict").textContent), "点検: 欠陥があれば不合格");
E(`openProb("k1"); units().forEach(u => { store[P.id][u.id] = goodParams(u); }); setMode("check");`);
ok(/合格/.test(d.querySelector(".verdict").textContent) && !/不合格/.test(d.querySelector(".verdict").textContent), "点検: 全部正しく作業すれば合格");

console.log("\n【F】後始末");
ok(!errs.length, "スクリプトエラーなし" + (errs.length ? " ← " + errs.join(" | ") : ""));
console.log(fail ? `\n✗ 不合格 ${fail} 項目` : "\n✓ すべて合格");
process.exit(fail ? 1 : 0);
