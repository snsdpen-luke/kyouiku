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
ok(B.length >= 300, `問題が 300 問以上ある（${B.length} 問）`);
ok(new Set(B.map(q => q.id)).size === B.length, "id が重複していない");
ok(B.every(q => ["c", "n", "s", "d"].includes(q.t)), "答え方は 語群選択・数値・記述（文章）・記述（図示）の4つだけ");
ok(B.every(q => G.CATS.some(c => c.id === q.cat)), "どの問題も分野がある");
ok(B.every(q => q.src), "どの問題にも出典（根拠）がある");
ok(B.filter(q => q.t === "c").every(q => q.o.length >= 2 && q.o.length <= 4 && Number.isInteger(q.a) && q.a >= 0 && q.a < q.o.length), "語群選択：選択肢は 2〜4、正解の番号が範囲内");
ok(B.filter(q => q.t === "c").every(q => new Set(q.o.map(String)).size === q.o.length || q.oSvg), "語群選択：同じ選択肢が2つない");
ok(B.filter(q => q.t === "n").every(q => Number.isInteger(q.a) && q.a >= 0 && String(q.a).length <= (q.digits || 3)), "数値：答えが位の数に収まる整数");
ok(B.filter(q => q.t === "s").every(q => G.judge(q, q.model)), "記述（文章）：模範解答は指定語句をすべて含み、正解になる");
ok(B.filter(q => q.t === "s").every(q => !G.judge(q, q.keys.map(k => k[0]).join("").slice(0, 3))), "記述（文章）：短すぎる答えは正解にならない");
const counts = {}; B.forEach(q => counts[q.t] = (counts[q.t] || 0) + 1);
console.log("    内訳: " + JSON.stringify(counts) + "　分野: " + G.CATS.map(c => c.name + " " + B.filter(q => q.cat === c.id).length).join("・"));

console.log("\n【B】図示：お手本は満点、白紙・誤りは減点");
const D = B.filter(q => q.t === "d");
ok(D.length >= 17, `図示の問題が 17 以上（${D.length}）`);
const ansVal = q => JSON.parse(E(`(()=>{ const q=GINOU.BANK.find(x=>x.id===${JSON.stringify(q.id)}), z=q.z, P=zPrep(z);
  const map={}, cnt={}; Object.keys(P.ansGroups).forEach(j=>{const b=j.split(":")[0]; cnt[b]=(cnt[b]||0)+1; map[j]=b+"#"+cnt[b];});
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
  const q = D.find(x => x.z.id === "r1"), v = ansVal(q);
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
  k8: { "ボックス": ["4本用", "4本用", "○", "○", "○"] }, k9: { A: ["2本用", "2本用", "3本用"], B: ["中", "中", "○"] }, k10: { "ボックス": ["中", "小", "3本用"] },
  k11: { "ボックス": ["中", "小", "2本用", "2本用"] }, k12: { A: ["3本用", "2本用", "2本用"], B: ["小", "小", "○", "○"] }, k13: { A: ["小", "小", "○"], B: ["4本用", "3本用", "2本用"] },
};
Object.entries(OFFICIAL).forEach(([id, exp]) => {
  const q = D.find(x => x.z.id === id), v = ansVal(q), got = {};
  Object.entries(v.marks).forEach(([s, m]) => { const b = q.z.boxes.find(b => b.id === s.split("#")[0]).name; (got[b] = got[b] || []).push(m); });
  const same = Object.keys(exp).every(b => JSON.stringify((got[b] || []).slice().sort()) === JSON.stringify(exp[b].slice().sort())) && Object.keys(got).length === Object.keys(exp).length;
  ok(same, `No.${q.z.no}: ${Object.entries(exp).map(([b, m]) => b + " " + m.join("・")).join(" ／ ")}` + (same ? "" : " → アプリ: " + JSON.stringify(got)));
});
/* 接続点ごとの語群選択の正解も同じ表から */
ok(B.filter(q => q.group && q.group.startsWith("pt-")).length >= 40, "接続点ごとの刻印・コネクタの問題が 40 問以上");

console.log("\n【D】画面と模擬テスト");
G.startExam();
const S = G.S;
ok(S.ids.length === 30, "模擬テストは 30 問");
const kc = {}; S.ids.forEach(id => { const t = B.find(q => q.id === id).t; kc[t] = (kc[t] || 0) + 1; });
ok(kc.c === 20 && kc.n === 4 && kc.s === 4 && kc.d === 2, "配分：語群 20・数値 4・文章 4・図示 2（" + JSON.stringify(kc) + "）");
ok(new Set(S.ids.map(id => { const q = B.find(x => x.id === id); return q.group || q.id; })).size === 30, "同じ内容の問題が2つ出ない");
ok(Object.values(G.EXAM.kinds).reduce((s, n, i) => s + n * Object.values(G.EXAM.pts)[i], 0) === 100, "満点は 100 点");
/* 語群：ぬる */
const ci = S.ids.findIndex(id => B.find(q => q.id === id).t === "c"); S.i = ci; E("render()");
d.querySelector(".bub[data-o]").click();
ok(d.querySelector(".bub.fill") && d.querySelector(".opt.pick"), "語群：解答欄の ○ をぬると、選択肢にも印が付く");
/* 数値：位ごとにぬる */
const ni = S.ids.findIndex(id => B.find(q => q.id === id).t === "n"); S.i = ni; E("render()");
const nq = B.find(q => q.id === S.ids[ni]), digs = String(nq.a).padStart(nq.digits || 3, " ").split("");
digs.forEach((ch, c) => { if (ch !== " ") d.querySelector(`.bub[data-c="${c}"][data-d="${ch}"]`).click(); });
ok(G.judge(nq, S.ans[nq.id]), `数値：位ごとにぬると ${nq.a} と読める`);
/* 図示：タップで線を引く */
const di = S.ids.findIndex(id => B.find(q => q.id === id).t === "d"); S.i = di; E("render()");
const dq = B.find(q => q.id === S.ids[di]);
const t0 = d.querySelector("[data-t]"), s0 = [...d.querySelectorAll("[data-s]")];
const P = E("zPrep")(dq.z), t0id = t0.dataset.t;
const slot = s0.find(s => P.wireOf(t0id, s.dataset.s));
t0.dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
d.querySelector(`[data-s="${slot.dataset.s}"]`).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(S.ans[dq.id] && S.ans[dq.id].lines.length === 1, "図示：端子 → 接続点 のタップで線が1本引ける");
d.querySelector(`[data-s="${slot.dataset.s}"]`).dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
d.querySelector('[data-zm="○"]').click();
ok(S.ans[dq.id].marks[slot.dataset.s] === "○", "図示：接続点をタップして刻印を書き込める");
d.querySelector("[data-l]").dispatchEvent(new w.MouseEvent("click", { bubbles: true }));
ok(S.ans[dq.id].lines.length === 0, "図示：線をタップすると消える");
d.getElementById("zundo").click();
ok(S.ans[dq.id].lines.length === 1, "図示：1つ戻す");
/* 採点まで */
E("finish()");
ok(/点/.test(d.querySelector(".score").textContent), "採点すると点数が出る");
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
