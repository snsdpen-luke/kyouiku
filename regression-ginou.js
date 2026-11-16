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

console.log("【A】問題の形（後期中間考査の範囲：選択40＋記述10。剛さんの指示 2026-11-16）");
const C5 = B.filter(q => q.t === "c"), EQ = B.filter(q => q.t === "e");
ok(B.length === 50 && C5.length === 40 && EQ.length === 10, `範囲は 50問＝選択 40問＋記述 10問（${B.length}・${C5.length}・${EQ.length}）`);
ok(B.every(q => ["c", "e"].includes(q.t)), "答え方は 選択（ア〜オ）と 記述（複線図の誤り）だけ");
ok(C5.every(q => q.o.length === 5 && Number.isInteger(q.a) && q.a >= 0 && q.a < 5), "選択はすべて ア〜オ の5択で、正解の番号が範囲内");
ok(G.CATS.filter(c => c.id !== "goshiki").every(c => C5.filter(q => q.cat === c.id).length === 5), "選択は分野ごとに 5問（8分野）");
ok(B.every(q => ["知", "思"].includes(q.kan) && ["A", "B", "C"].includes(q.lv)), "どの問題にも観点（知・思）と難易度（A・B・C）がある");
ok(new Set(B.map(q => q.id)).size === B.length, "id が重複していない");
ok(B.every(q => G.CATS.some(c => c.id === q.cat)), "どの問題も分野がある");
ok(B.every(q => q.src), "どの問題にも出典（根拠）がある");
ok(C5.every(q => new Set(q.o.map(String)).size === 5 || q.oSvg), "選択：同じ選択肢が2つない");
ok(new Set(B.map(q => q.q + (q.figZ || "") + (q.fig || "") + (q.o || []).join("|"))).size === B.length, "同じ問題（問題文・図・選択肢）が2つない");
{ const L = s => String(s).length, lg = C5.filter(q => { const m = Math.max(...q.o.map(L)); return L(q.o[q.a]) === m && q.o.filter(o => L(o) === m).length === 1; });
  ok(lg.length <= 4, `正解だけが一番長い選択問題は 4問まで（${lg.length}：${lg.map(q => q.id).join(" ")}）`); }
{ const fx = C5.filter(q => q.fix).map(q => q.a), cnt = [0, 1, 2, 3, 4].map(i => fx.filter(a => a === i).length);
  ok(Math.max(...cnt) <= Math.ceil(fx.length / 2), `並べかえない問題（${fx.length}問）の正解の位置がかたよらない（ア〜オ ${cnt.join("・")}）`); }
ok(C5.every(q => q.ex && /です|ます|。/.test(q.ex) || !q.ex), "選択の解説は文になっている");
console.log("    分野: " + G.CATS.map(c => c.name + " " + B.filter(q => q.cat === c.id).length).join("・"));

console.log("\n【B】記述（複線図の誤り）：公表の単線図・複線図の画像と、答えの番号が合う");
const mapped = (z, lines) => JSON.parse(E(`(()=>{ const z=ZUSHI.find(x=>x.id===${JSON.stringify(z.id)}), P=zPrep(z), map=zAnsMap(z);
  const lines=${JSON.stringify(lines)}.map(l=>({a:map[l.a]||l.a,b:map[l.b]||l.b,c:l.c}));
  const by={}; lines.forEach(l=>[l.a,l.b].forEach(e=>{ if(P.slots[e]) (by[e]=by[e]||[]).push(l); }));
  const marks={}; Object.keys(by).forEach(s=>marks[s]=needMark(z,P.slots[s].box,by[s]));
  return JSON.stringify({lines,marks}); })()`));
const zs = E("zushiScore"), FIGS = E("FIGS");
ok(new Set(EQ.map(q => q.no)).size === 10, "10問とも別の候補問題（No." + EQ.map(q => q.no).join("・") + "）");
EQ.forEach(q => {
  const w = FIGS["fk" + q.no + "w"], g = FIGS["fk" + q.no + "ok"], m = FIGS["fk" + q.no + "meta"];
  ok(/^data:image\/png;base64,/.test(w) && /^data:image\/png;base64,/.test(g) && w !== g, `${q.id}（No.${q.no}）: 公表の複線図の画像（誤りを入れたもの・正しいもの）があり、2枚は違う`);
  ok(/^data:image\/png;base64,/.test(FIGS["tan" + q.no]), `${q.id}: 公表の単線図の画像がある`);
  ok(q.nc === m.n && q.nc >= 6 && q.ln + 1 === m.ans && q.ln >= 0 && q.ln < q.nc, `${q.id}: 番号の候補 ${q.nc} 個・答えの番号 ${q.ln + 1} が画像の番号と合う`);
  ok(G.judge(q, { n: q.ln + 1, s: q.model }), `${q.id}: 番号と模範解答 → 正解`);
  ok(!G.judge(q, { n: q.ln === 0 ? 2 : 1, s: q.model }) && !G.judge(q, { n: q.ln + 1, s: "" }) && !G.judge(q, { n: q.ln + 1, s: "まちがいです" }), `${q.id}: 番号ちがい・空欄・言葉の足りない文 → 不正解`);
  ok(new RegExp("番号 " + (q.ln + 1) + " ").test(q.ex), `${q.id}: 解説の番号が正解の番号と同じ`);
  ok(/施工条件：電源からの接地側電線には白/.test(q.q), `${q.id}: 問題文に色の施工条件がある（図のヒントの注記は消してある）`);
});
ok(new Set(EQ.map(q => q.ln + 1)).size >= 5, "誤っている箇所の番号がばらける（" + EQ.map(q => q.ln + 1).join("・") + "）");
/* 図示の採点（範囲からは外したが、誤り探しの確かめに使う）：入れかえてよい端子 */
{
  const ansVal = id => { const z = E("ZUSHI").find(x => x.id === id); return mapped(z, z.ref.map(([a, b, c]) => ({ a, b, c }))); };
  const z1 = E("ZUSHI").find(x => x.id === "r1"), v = ansVal("r1"), q = { t: "d", z: z1 };
  const sw = v.lines.map(l => ({ ...l, a: l.a === "Sa.1" ? "Sa.2" : l.a === "Sa.2" ? "Sa.1" : l.a, b: l.b === "Sa.1" ? "Sa.2" : l.b === "Sa.2" ? "Sa.1" : l.b }));
  ok(G.judge(q, { lines: sw, marks: v.marks }), "採点：スイッチの端子 1 と 2 を入れかえても正解");
  const lamp = v.lines.map(l => ({ ...l, a: l.a === "La.W" ? "La.C" : l.a === "La.C" ? "La.W" : l.a, b: l.b === "La.W" ? "La.C" : l.b === "La.C" ? "La.W" : l.b }));
  ok(!G.judge(q, { lines: lamp, marks: v.marks }), "採点：ランプの受金ねじ部（W）と中心を入れかえると不正解（極性）");
}

console.log("\n【C】複線図の正解の刻印・コネクタが、令和8年度の公表の解答と同じ");
const ansVal = id => { const z = E("ZUSHI").find(x => x.id === id); return mapped(z, z.ref.map(([a, b, c]) => ({ a, b, c }))); };
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
const CONNEXP = { "kouho-14": "小", "kouho-24": "4本用", "kouho-71": "3本用" };
Object.entries(CONNEXP).forEach(([id, m]) => { const q = B.find(x => x.id === id);
  ok(q && q.need === m && q.o.length === 5 && q.o[q.a].endsWith(m.length > 1 ? m : "「" + m + "」") && q.figZ && !/（1\.6mm）|（2\.0mm）/.test(q.q), `${id}: 電線のリストなし・5つから選ぶ・単線図つき → ${m}`); });

console.log("\n【F】剛さんの指摘（2026-10-30）");
const allText = q => [q.q, q.ex || "", q.model || "", (q.o || []).join("|"), q.sub || "", q.src || ""].join(" ");
ok(B.every(q => !/No\.\s?\d/.test(allText(q))), "候補問題の番号（No.7 など）を問題・選択肢・解説・出典に出さない");
ok(B.filter(q => q.figZ).every(q => /<svg|<img class="pdfz" src="data:image\/png/.test(E("tanSvg")(q.figZ))), "番号の代わりに付ける単線図が描ける（候補問題は公表の単線図の画像）");
ok(B.filter(q => /^k\d+$/.test(q.figZ || "")).every(q => /<img class="pdfz"/.test(E("tanSvg")(q.figZ))), "候補問題の単線図は、どれも公表の PDF から作った画像");
ok(B.every(q => !(q.o || []).some(o => /大スリーブ|刻印「大」/.test(o) || o === "大")), "リングスリーブの「大」を選択肢に出さない");
ok(!E("MARKS").sleeve.includes("大"), "図示の刻印にも「大」を出さない");
ok(B.every(q => !/外装（シース）をはぐ|外装をはぐ/.test(q.q + (q.o || []).join(""))), "「外装をはぐ」ではなく「ケーブルをはぐ」");
ok(!B.some(q => /9711/.test(q.q) || /1\.6mm の心線 2本をリングスリーブでつなぐときの/.test(q.q) || /エコケーブル（EM-EEF）の外装をはぐときに/.test(q.q) || /絶縁被覆の傷は/.test(q.q)), "指摘の4問を消した");
ok(B.every(q => !/欠陥になるか。\n/.test(q.q) && !(q.o || []).includes("欠陥にならない")), "欠陥の2択（なる・ならない）が無い");
const K5 = B.filter(q => q.cat === "kekkan" && q.t === "c" && q.o[4] === "欠陥はない");
ok(K5.length === 4 && K5.filter(q => q.a === 4).length === 1, `欠陥の5択（ア〜エ＋オ 欠陥はない）は4問で、オが正解は1問だけ（${K5.length}）`);
ok(!/→ 白|→ 黒/.test(E("UKEGANE")), "受金ねじ部の図に、電線の色（答え）を書かない");
ok(E("GLOSS").every(g => !/白色を使う|黒色を使う|中央|ねじ切れる|切のとき|一点鎖線|小・中|○・小・中/.test(g.d)), "用語の説明に、問題で問う決まり（答え）を書かない");
ok(!/＋100|＋50/.test(B.find(q => q.id === "tejun-11").q), "tejun-11：＋100・＋50 のヒントを消した");
{ const A = id => { const q = B.find(x => x.id === id); return q.o[q.a]; };
  ok(A("sleeve-new1") === "4本" && A("tejun-11") === "300mm" && A("tejun-14") === "250mm" && A("tejun-19") === "100mm" && A("tejun-20") === "20mm" && A("fukusen-19") === "3つ", "数値から5択にした問題の正解が元の数と同じ（4本・300・250・100・20mm・3つ）"); }
{ const SL = q => q.o[q.a]; const R = { "sleeve-3": "小", "sleeve-6": "小", "sleeve-11": "中", "sleeve-14": "中" };
  ok(Object.entries(R).every(([id, m]) => SL(B.find(x => x.id === id)) === (m === "小" ? "小スリーブ・刻印「小」" : "中スリーブ・刻印「中」")), "スリーブの5択の正解が JIS の表どおり"); }
ok(K5.every(q => { const d = E("KK").filter(k => q.o.slice(0, 4).includes(k[1])); return d.length === 4 && d.filter(k => k[2]).length === (q.a === 4 ? 0 : 1) && new Set(d.map(k => k[0])).size === 4; }), "欠陥の5択は、欠陥が0か1つだけで、同じ話題が2つ入らない");
ok(B.filter(q => /受金ねじ部/.test(q.q + (q.o || []).join(""))).every(q => /受金ねじ部/.test(E("figOf")(q))), "受金ねじ部が出る問題には、受金ねじ部の図が付く");
{ const z = E("ZUSHI").find(x => x.id === "k1"), P = E("zPrep")(z), b = P.box.B1;
  ok(Object.values(P.slots).filter(s => s.box === "B1").every(s => Math.abs(Math.hypot(s.x - b.x, s.y - b.y) - 44) < 0.01), "接続点はボックスのふちに並ぶ（中を通る線とかぶらない）");
  const m = E("zAnsMap")(z); ok(new Set(Object.values(m)).size === Object.keys(m).length, "お手本の接続点は、それぞれ別の場所に置く"); }

console.log("\n【D】画面と模擬テスト（選択 40問＋記述 10問・50分）");
let okMany = true;
for (let k = 0; k < 20; k++) { const X = E("makeExam")(), qs = X.ids.map(id => B.find(q => q.id === id));
  if (!(X.ids.length === 50 && new Set(X.ids).size === 50 && qs.slice(0, 40).every(q => q.t === "c") && qs.slice(40).every(q => q.t === "e"))) { okMany = false; break; } }
ok(okMany && G.EXAM.minutes === 50, "模擬テストは範囲の 50問すべて（選択 40問のあとに記述 10問）、50分");
G.startExam();
const S = G.S;
d.querySelector(".bub[data-o]").click();
ok(d.querySelector(".bub.fill") && d.querySelector(".opt.pick"), "選択：解答欄の ○ をぬると、選択肢にも印が付く");
ok(d.querySelectorAll(".bub[data-o]").length === 5 && /ア.*イ.*ウ.*エ.*オ/s.test(d.querySelector(".sheet").textContent), "選択：解答欄は ア〜オ の5つ");
S.i = 40; E("render()");
const eq = B.find(q => q.id === S.ids[40]);
ok(d.querySelector(".efig .fig img.pdfz") && d.querySelector(".zbox img.eimg").getAttribute("src") === E("FIGS")["fk" + eq.no + "w"] && d.querySelectorAll(".bub[data-en]").length === eq.nc, "記述：公表の単線図と、誤りを入れた番号つきの複線図（画像）と、番号の解答欄が出る");
d.querySelector(`.bub[data-en="${eq.ln + 1}"]`).click();
const ta = d.getElementById("tin"); ta.value = eq.model; ta.dispatchEvent(new w.Event("input"));
ok(S.ans[eq.id].n === eq.ln + 1 && S.ans[eq.id].s === eq.model && G.judge(eq, S.ans[eq.id]), "記述：番号をぬって文を書くと、両方が答えに残り正解になる");
d.querySelector(`.bub[data-en="${eq.ln + 1}"]`).click();
ok(!S.ans[eq.id].n && S.ans[eq.id].s === eq.model, "記述：同じ番号をもう一度押すと消える（文は残る）");
E("finish()");
const tx = d.getElementById("card").textContent;
ok(/\d+ \/ 50 問 正解/.test(d.querySelector(".score").textContent) && /選択（ア〜オ） \d+ \/ 40 問/.test(tx) && /記述（複線図の誤り） \d+ \/ 10 問/.test(tx), "採点すると、合計と 選択 / 40・記述 / 10 が出る");
G.startPractice([EQ[0].id], "t");
d.querySelector(`.bub[data-en="${EQ[0].ln + 1}"]`).click();
const t2 = d.getElementById("tin"); t2.value = EQ[0].model; t2.dispatchEvent(new w.Event("input")); d.getElementById("check").click();
ok(/正解/.test(d.querySelector(".fb").textContent) && d.querySelector(".zbox.ans img.eimg").getAttribute("src") === E("FIGS")["fk" + EQ[0].no + "ok"], "練習：答え合わせで正解と、正しい複線図（答えの箇所に黄色の印）が出る");
G.home();
ok(/50問/.test(d.getElementById("card").textContent) && d.querySelectorAll(".menu button").length === 9, "はじめの画面：50問・9分野");

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
