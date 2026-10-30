/* 技能試験 筆記トレーニング（技能筆記練習.html）リグレッションテスト
   使い方: npm install jsdom && node regression-ginou.js 技能筆記練習.html
   問題を足したり直したりしたら、必ずこれを通す。
   【C】は、図示問題の正解から求めた刻印・コネクタが、令和8年度の公表の解答と同じかを見る（表は公表の解答から書き写したもの） */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs");
const errs = [];
const vc = new VirtualConsole(); vc.on("jsdomError", e => errs.push(String(e && e.message || e)));
const TARGET = process.argv[2] || "技能筆記練習.html";
console.log("対象: " + TARGET + "\n");
const dom = new JSDOM(fs.readFileSync(TARGET, "utf8"), { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.org/" });
const w = dom.window, d = w.document;
const used = [];
w.alert = m => used.push("alert"); w.confirm = m => { used.push("confirm"); return false; };
w.onerror = (m, s, l, c, e) => { errs.push((e && e.stack || m).split("\n")[0]); return true; };
let fail = 0;
const ok = (c, msg) => { if (!c) { fail++; console.log("  ✗ " + msg); } else console.log("  ✓ " + msg); };
const G = w.GINOU, B = G.BANK, E = s => w.eval(s);

console.log("【A】問題の形");
ok(B.length === 150, `試験範囲は 150 問（${B.length} 問）`);
ok(B.every(q => ["知", "思"].includes(q.kan) && ["A", "B", "C"].includes(q.lv)), "どの問題にも観点（知・思）と難易度（A・B・C）がある");
ok(new Set(B.map(q => q.id)).size === B.length, "id が重複していない");
ok(B.every(q => ["c", "m", "n", "s", "d"].includes(q.t)), "答え方は 語群選択（1つ・すべて）・数値・記述（文章）・記述（図示）だけ");
ok(B.filter(q => q.t === "m").every(q => Array.isArray(q.a) && q.a.length >= 1 && q.a.every(i => i >= 0 && i < q.o.length - 1) && q.o[q.o.length - 1] === "欠陥はない"), "すべて選べ：正解は オ 以外の1つ以上");
ok(B.every(q => G.CATS.some(c => c.id === q.cat)), "どの問題も分野がある");
ok(B.every(q => q.src), "どの問題にも出典（根拠）がある");
ok(B.filter(q => q.t === "c").every(q => q.o.length >= 2 && q.o.length <= 6 && Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length), "語群選択：選択肢は 2〜6、正解の番号が範囲内");
ok(B.filter(q => q.t === "c").every(q => new Set(q.o.map(String)).size === q.o.length || q.oSvg), "語群選択：同じ選択肢が2つない");
ok(B.filter(q => q.t === "n").every(q => Number.isInteger(q.a) && q.a >= 0 && String(q.a).length <= (q.digits || 3)), "数値：答えが位の数に収まる整数");
ok(B.filter(q => q.t === "s").every(q => G.judge(q, q.model)), "記述（文章）：模範解答は指定語句をすべて含み、正解になる");
ok(B.filter(q => q.t === "s").every(q => !G.judge(q, q.keys.map(k => k[0]).join("").slice(0, 3))), "記述（文章）：短すぎる答えは正解にならない");
const counts = {}; B.forEach(q => counts[q.t] = (counts[q.t] || 0) + 1);
console.log("    内訳: " + JSON.stringify(counts) + "　分野: " + G.CATS.map(c => c.name + " " + B.filter(q => q.cat === c.id).length).join("・"));

console.log("\n【B】図示：お手本は満点、白紙・誤りは減点");
const D = B.filter(q => q.t === "d");
ok(D.length === 9, `図示の問題は 9（${D.length}）`);
const ansVal = q => JSON.parse(E(`(()=>{ const z=ZUSHI.find(x=>x.id===${JSON.stringify(q.z ? q.z.id : q)}), P=zPrep(z);
  const map=zAnsMap(z);
  const lines=z.ref.map(([a,b,c])=>({a:map[a]||a,b:map[b]||b,c}));
  const by={}; lines.forEach(l=>[l.a,l.b].forEach(e=>{ if(P.slots[e]) (by[e]=by[e]||[]).push(l); }));
  const marks={}; Object.keys(by).forEach(s=>marks[s]=needMark(z,P.slots[s].box,by[s]));
  return JSON.stringify({lines,marks}); })()`));
D.forEach(q => {
  const v = ansVal(q), sc = E(`zushiScore`)(q.z, v);
  ok(sc.ok && sc.frac === 1, `${q.sub || q.id}: お手本 → 満点`);
  ok(!G.judge(q, { lines: [], marks: {} }), `${q.sub || q.id}: 白紙 → 不正解`);
  const v2 = JSON.parse(JSON.stringify(v)); const k = Object.keys(v2.marks)[0]; v2.marks[k] = v2.marks[k] === "○" ? "小" : "○";
  ok(!G.judge(q, v2), `${q.sub || q.id}: 刻印を1つ変える → 不正解`);
  const v3 = JSON.parse(JSON.stringify(v)); const i3 = v3.lines.findIndex(l => l.c === "白"); v3.lines[i3].c = "黒";
  ok(!G.judge(q, v3), `${q.sub || q.id}: 白い線を1本黒にする → 不正解`);
  const v4 = JSON.parse(JSON.stringify(v)); v4.lines.pop();
  ok(!G.judge(q, v4), `${q.sub || q.id}: 線を1本消す → 不正解`);
});
/* 入れかえてよい端子：スイッチの 1–2、3路の 1–3 は入れかえても正解 */
{
  const q = { t: "d", z: E("ZUSHI").find(x => x.id === "r1") }, v = ansVal("r1");
  const sw = v.lines.map(l => ({ ...l, a: l.a === "Sa.1" ? "Sa.2" : l.a === "Sa.2" ? "Sa.1" : l.a, b: l.b === "Sa.1" ? "Sa.2" : l.b === "Sa.2" ? "Sa.1" : l.b }));
  ok(G.judge(q, { lines: sw, marks: v.marks }), "練習1: スイッチの端子 1 と 2 を入れかえても正解");
  const q4 = D.find(x => x.z.id === "r4"), v4 = ansVal(q4);
  const s3 = v4.lines.map(l => ({ ...l, a: l.a === "Sb.1" ? "Sb.3" : l.a === "Sb.3" ? "Sb.1" : l.a, b: l.b === "Sb.1" ? "Sb.3" : l.b === "Sb.3" ? "Sb.1" : l.b }));
  ok(G.judge(q4, { lines: s3, marks: v4.marks }), "練習4: 片方の3路スイッチの 1 と 3 を入れかえても正解");
  const lamp = v.lines.map(l => ({ ...l, a: l.a === "La.W" ? "La.C" : l.a === "La.C" ? "La.W" : l.a, b: l.b === "La.W" ? "La.C" : l.b === "La.C" ? "La.W" : l.b }));
  ok(!G.judge(q, { lines: lamp, marks: v.marks }), "練習1: ランプの受金ねじ部（W）と中心を入れかえると不正解（極性）");
}

console.log("\n【C】図示の正解の刻印・コネクタが、令和8年度の公表の解答と同じ");
const OFFICIAL = {
  k1: { A: ["小", "小", "○", "○", "○"], B: ["3本用", "2本用", "2本用"] }, k2: { A: ["小", "小", "○"], B: ["4本用", "3本用", "3本用"] },
  k3: { A: ["小", "小", "○"], B: ["4本用", "3本用", "2本用"] }, k4: { A: ["3本用", "3本用", "2本用"], B: ["小", "小", "○"] },
  k6: { A: ["3本用", "3本用", "2本用", "2本用"], B: ["小", "小", "○", "○"] }, k7: { A: ["小", "小", "○", "○"], B: ["3本用", "3本用", "2本用", "2本用", "2本用", "2本用"] },
  k5: { "ボックス": ["4本用", "小", "○", "○"] }, k8: { "ボックス": ["4本用", "4本用", "○", "○", "○"] }, k9: { A: ["2本用", "2本用", "3本用"], B: ["中", "中", "○"] }, k10: { "ボックス": ["中", "小", "3本用"] },
  k11: { "ボックス": ["中", "小", "2本用", "2本用"] }, k12: { A: ["3本用", "2本用", "2本用"], B: ["小", "小", "○", "○"] }, k13: { A: ["小", "小", "○"], B: ["4本用", "3本用", "2本用"] },
};
Object.entries(OFFICIAL).forEach(([id, exp]) => {
  const z = E("ZUSHI").find(x => x.id === id), v = ansVal(id), got = {};
  Object.entries(v.marks).forEach(([s, m]) => { const b = z.boxes.find(b => b.id === s.split("#")[0]).name; (got[b] = got[b] || []).push(m); });
  const same = Object.keys(exp).every(b => JSON.stringify((got[b] || []).slice().sort()) === JSON.stringify(exp[b].slice().sort())) && Object.keys(got).length === Object.keys(exp).length;
  ok(same, `No.${z.no}: ${Object.entries(exp).map(([b, m]) => b + " " + m.join("・")).join(" ／ ")}` + (same ? "" : " → アプリ: " + JSON.stringify(got)));
});
/* 接続点ごとの語群選択の正解も同じ表から */
/* 接続の作り直し12問（電線のリストを消し、スリーブかコネクタかも選ぶ）。正解は選定表と同じ */
const CONNEXP = { "kouho-14": "小", "kouho-16": "○", "kouho-24": "4本用", "kouho-30": "4本用", "kouho-40": "4本用", "kouho-43": "小", "kouho-61": "4本用", "kouho-66": "中", "kouho-68": "中", "kouho-71": "3本用", "kouho-73": "中", "kouho-76": "中" };
Object.entries(CONNEXP).forEach(([id, m]) => { const q = B.find(x => x.id === id);
  ok(q && q.need === m && q.o.length === 6 && q.figZ && !/（1\.6mm）|（2\.0mm）/.test(q.q), `${id}: 電線のリストなし・6つから選ぶ・単線図つき → ${m}`); });

console.log("\n【F】剛さんの指摘（2026-10-30）");
const allText = q => [q.q, q.ex || "", q.model || "", (q.o || []).join("|"), q.sub || "", q.src || ""].join(" ");
ok(B.every(q => !/No\.\s?\d/.test(allText(q))), "候補問題の番号（No.7 など）を問題・選択肢・解説・出典に出さない");
ok(B.filter(q => q.figZ).every(q => /<svg/.test(E("tanSvg")(q.figZ))), "番号の代わりに付ける単線図が描ける");
ok(B.every(q => !(q.o || []).some(o => /大スリーブ|刻印「大」/.test(o) || o === "大")), "リングスリーブの「大」を選択肢に出さない");
ok(!E("MARKS").sleeve.includes("大"), "図示の刻印にも「大」を出さない");
ok(B.every(q => !/外装（シース）をはぐ|外装をはぐ/.test(q.q + (q.o || []).join(""))), "「外装をはぐ」ではなく「ケーブルをはぐ」");
ok(!B.some(q => /9711/.test(q.q) || /1\.6mm の心線 2本をリングスリーブでつなぐときの/.test(q.q) || /エコケーブル（EM-EEF）の外装をはぐときに/.test(q.q) || /絶縁被覆の傷は/.test(q.q)), "指摘の4問を消した");
ok(B.every(q => !/欠陥になるか。\n/.test(q.q) && !(q.o || []).includes("欠陥にならない")), "欠陥の2択（なる・ならない）が無い");
const K5 = B.filter(q => q.cat === "kekkan" && q.t === "c" && q.o.length === 5);
ok(K5.length >= 15 && K5.every(q => q.o[4] === "欠陥はない"), `欠陥の5択（ア〜エ＋オ 欠陥はない）が 15 問以上（${K5.length}）`);
ok(K5.filter(q => q.a === 4).length === 2 && K5.some(q => q.a < 4), "欠陥はない（オ）が正解の問題は2問だけ（迷ったらオ、で当たらないように）");
{ const M = B.filter(q => q.t === "m"), EXP = { "kekkan-23": "0,2", "kekkan-26": "0,1", "kekkan-33": "1,2", "kekkan-40": "0,2" };
  ok(M.length === 4 && M.every(q => EXP[q.id] === q.a.join()), "すべて選べ 4問（kekkan-23・26・33・40）の正解が選定表のとおり"); }
ok(!/→ 白|→ 黒/.test(E("UKEGANE")), "受金ねじ部の図に、電線の色（答え）を書かない");
ok(E("GLOSS").every(g => !/白色を使う|黒色を使う|中央|ねじ切れる|切のとき|一点鎖線|小・中|○・小・中/.test(g.d)), "用語の説明に、問題で問う決まり（答え）を書かない");
ok(B.find(q => q.id === "kekkan-14").a === 125, "kekkan-14：250mm の 50% → 125mm（暗記で解けない形）");
ok(!/＋100|＋50/.test(B.find(q => q.id === "tejun-11").q), "tejun-11：＋100・＋50 のヒントを消した");
ok(B.find(q => q.id === "sleeve-new1").a === 4 && B.find(q => q.id === "sleeve-new2").a === 2, "新規：小スリーブで 1.6mm は 4本まで・2.0mm は 2本まで");
ok(K5.every(q => { const d = E("KK").filter(k => q.o.slice(0, 4).includes(k[1])); return d.length === 4 && d.filter(k => k[2]).length === (q.a === 4 ? 0 : 1) && new Set(d.map(k => k[0])).size === 4; }), "5択は、欠陥が0か1つだけで、同じ話題が2つ入らない");
ok(B.filter(q => /受金ねじ部/.test(q.q + (q.o || []).join(""))).every(q => /受金ねじ部/.test(E("figOf")(q))), "受金ねじ部が出る問題には、受金ねじ部の図が付く");
{ const z = E("ZUSHI").find(x => x.id === "k1"), P = E("zPrep")(z), b = P.box.B1;
  ok(Object.values(P.slots).filter(s => s.box === "B1").every(s => Math.abs(Math.hypot(s.x - b.x, s.y - b.y) - 44) < 0.01), "接続点はボックスのふちに並ぶ（中を通る線とかぶらない）");
  const m = E("zAnsMap")(z); ok(new Set(Object.values(m)).size === Object.keys(m).length, "お手本の接続点は、それぞれ別の場所に置く"); }

console.log("\n【D】画面と模擬テスト（定期考査と同じ組み方）");
let okMany = true;
for (let k = 0; k < 40; k++) {   // 何回作っても条件を守る
  const X = E("makeExam")(), qs = X.ids.map(id => B.find(q => q.id === id));
  const pts = X.ids.reduce((s, id) => s + X.pts[id], 0), chi = X.ids.filter(id => G.EXAM.sec[X.sec[id]].kan === "知").reduce((s, id) => s + X.pts[id], 0);
  const figs = new Set(qs.filter(q => q.figZ).map(q => q.figZ));
  const good = X.ids.length === 47 && pts === 100 && chi === 50 && qs.filter(q => q.t === "m").length >= 2 && qs.every(q => q.t !== "d") && figs.size <= 2
    && new Set(qs.map(q => q.group || q.id)).size === 47 && qs.filter(q => q.t === "s").length === 2 && qs.every(q => !(q.rel || []).some(r => X.ids.includes(r)));
  if (!good) { okMany = false; console.log("    × " + JSON.stringify({ n: X.ids.length, pts, chi, figs: [...figs] })); break; }
}
ok(okMany, "模擬テストは 47問・100点（知識・技能 50点／思考・判断・表現 50点）、すべて選べ 2問以上、記述（文章）2問、図示なし、単線図は2つまで、同じ問題なし、記述の指定語句が答えになる問題と一緒に出さない（40回作って確かめる）");
G.startExam();
const S = G.S;
/* 語群：ぬる */
const ci = S.ids.findIndex(id => B.find(q => q.id === id).t === "c"); S.i = ci; E("render()");
d.querySelector(".bub[data-o]").click();
ok(d.querySelector(".bub.fill") && d.querySelector(".opt.pick"), "語群：解答欄の ○ をぬると、選択肢にも印が付く");
/* すべて選ぶ */
const mi = S.ids.findIndex(id => B.find(q => q.id === id).t === "m"); S.i = mi; E("render()");
const mq = B.find(q => q.id === S.ids[mi]);
mq.a.forEach(i => d.querySelector(`.bub[data-o="${i}"]`).click());
ok(G.judge(mq, S.ans[mq.id]), "すべて選べ：正解を全部ぬると正解");
d.querySelector(`.bub[data-o="4"]`).click();
ok(JSON.stringify(S.ans[mq.id]) === "[4]" && !G.judge(mq, S.ans[mq.id]), "すべて選べ：「欠陥はない」をぬると、ほかの印は消える");
ok(!G.judge(mq, [mq.a[0]]), "すべて選べ：1つ足りないと不正解（部分点なし）");
/* 数値：位ごとにぬる */
const ni = S.ids.findIndex(id => B.find(q => q.id === id).t === "n"); S.i = ni; E("render()");
const nq = B.find(q => q.id === S.ids[ni]), digs = String(nq.a).padStart(nq.digits || 3, " ").split("");
digs.forEach((ch, c) => { if (ch !== " ") d.querySelector(`.bub[data-c="${c}"][data-d="${ch}"]`).click(); });
ok(G.judge(nq, S.ans[nq.id]), `数値：位ごとにぬると ${nq.a} と読める`);
/* 採点まで */
E("finish()");
ok(/点/.test(d.querySelector(".score").textContent) && /知識・技能 \d+ \/ 50 点/.test(d.getElementById("card").textContent) && /思考・判断・表現 \d+ \/ 50 点/.test(d.getElementById("card").textContent), "採点すると、合計と観点別（知識・技能 / 50・思考・判断・表現 / 50）が出る");
/* 図示：タップで線を引く（練習で） */
const dq = D[0]; G.startPractice([dq.id], "t");
const t0 = d.querySelector("[data-t]"), s0 = [...d.querySelectorAll("[data-s]")];
const P = E("zPrep")(dq.z), t0id = t0.dataset.t;
const slot = s0.find(s => P.wireOf(t0id, s.dataset.s));
t0.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
d.querySelector(`[data-s="${slot.dataset.s}"]`).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
const SS = G.S;
ok(SS.ans[dq.id] && SS.ans[dq.id].lines.length === 1, "図示：端子 → 接続点 のタップで線が1本引ける");
d.querySelector(`[data-s="${slot.dataset.s}"]`).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
d.querySelector('[data-zm="○"]').click();
ok(SS.ans[dq.id].marks[slot.dataset.s] === "○", "図示：接続点をタップして刻印を書き込める");
d.querySelector("[data-l]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(SS.ans[dq.id].lines.length === 0, "図示：線をタップすると消える");
d.getElementById("zundo").click();
ok(SS.ans[dq.id].lines.length === 1, "図示：1つ戻す");
/* 練習モード */
G.startPractice([B.find(q => q.t === "s").id], "t"); const sq = B.find(q => q.t === "s");
const ta = d.getElementById("tin"); ta.value = sq.model; ta.dispatchEvent(new w.Event("input")); d.getElementById("check").click();
ok(/正解/.test(d.querySelector(".fb").textContent), "記述（文章）：模範解答を書いて答え合わせ → 正解");

console.log("\n【E】約束");
const src = fs.readFileSync(TARGET, "utf8");
ok(!/\b(confirm|alert)\s*\(/.test(src.replace(/\/\*[\s\S]*?\*\//g, "")), "ブラウザの confirm / alert を使っていない");
ok(!/fetch\(|XMLHttpRequest|sendBeacon|<link[^>]+href="http|<script[^>]+src=/.test(src), "通信しない（外部フォント・外部スクリプトなし）");
ok(/const VER = "\d{4}-\d{2}-\d{2}[a-z]?"/.test(src), "版の表示（VER）がある");
ok(!/claude\.ai\/artifact/.test(src), "非公開の Artifact の URL を書いていない");
ok(used.length === 0, "alert / confirm が呼ばれていない");
ok(errs.length === 0, "エラーなし" + (errs.length ? " → " + errs.slice(0, 3).join(" | ") : ""));

console.log(fail ? `\n✗ ${fail} 件 不合格` : "\n✓ 全項目合格");
process.exit(fail ? 1 : 0);
