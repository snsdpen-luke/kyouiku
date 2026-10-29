/* 複線図練習.html の候補問題 No.1〜13 から、作業シミュレータが使う「作業の材料」を取り出し、
   作業シミュレータ.html の「// KIT-BEGIN」〜「// KIT-END」の行の間に書き込む。
   使い方: node tools/export-kit.js   （複線図練習.html の問題データを直したら必ず走らせる） */
const { JSDOM, VirtualConsole } = require("jsdom");
const fs = require("fs"), path = require("path");
const ROOT = path.join(__dirname, "..");
const vc = new VirtualConsole();
const dom = new JSDOM(fs.readFileSync(path.join(ROOT, "複線図練習.html"), "utf8"),
  { runScripts: "dangerously", pretendToBeVisual: true, virtualConsole: vc, url: "https://example.org/" });
const w = dom.window;
w.alert = () => {}; w.confirm = () => false;
const kit = JSON.parse(w.eval(`JSON.stringify(PROBLEMS.filter(p => p.official).map(pr => {
  openProblem(pr.id);
  const st = refState(P); view = st;
  const omit = p => !!(p.omit || /施工省略/.test(TYPES[p.type].name));
  const endOf = e => e[0] === "#" ? { kind: "joint", box: st.joints.find(j => j.id === e).box, joint: e }
                                  : { kind: "term", part: P.term[e].part.id, term: P.term[e].k, lab: P.term[e].lab || "", w: !!P.term[e].w };
  return {
    id: P.id, no: P.no, title: P.title, note: P.note || "", cond: P.cond || [],
    parts: P.parts.map(p => ({ id: p.id, type: p.type, name: PNAME(p), typeName: TYPES[p.type].name, label: p.label || "", place: p.place, omit: omit(p), x: p.ax, y: p.ay,
      terms: p.terms.map(t => ({ k: t.k, lab: t.lab || "", desc: t.desc || "", w: !!t.w })) })),
    boxes: P.boxes.map(b => ({ id: b.id, kind: b.kind || "box", join: b.join || "sleeve", x: b.ax, y: b.ay })),
    places: Object.keys(P.place).map(k => ({ id: k, parts: P.place[k].map(p => p.id) })),
    cables: P.cables.map(c => ({ id: c.id, a: c.a, b: c.b, spec: c.spec, colors: c.colors, mm: (/(\\d\\.\\d)/.exec(c.spec) || [0, "1.6"])[1], name: CABNAME(c) })),
    wires: st.cores.map(k => { const r = routeOf(k.a, k.b); return { cable: r ? r.id : null, color: k.c, a: endOf(k.a), b: endOf(k.b) }; }),
    joints: st.joints.map(j => { const ws = wiresAt(st, j.id); return { id: j.id, box: j.box, join: j.join || null, n: ws.n, n16: ws.n16, n20: ws.n20 }; }),
  };
}))`));
const SIM = path.join(ROOT, "作業シミュレータ.html");
let s = fs.readFileSync(SIM, "utf8");
const A = "// KIT-BEGIN（tools/export-kit.js が書く。手で直さない）", B = "// KIT-END";
const a = s.indexOf(A), b = s.indexOf(B);
if (a < 0 || b < 0) throw new Error("作業シミュレータ.html に KIT-BEGIN / KIT-END の行が無い");
s = s.slice(0, a) + A + "\nconst KIT = " + JSON.stringify(kit) + ";\n" + s.slice(b);
fs.writeFileSync(SIM, s);
console.log("書き込んだ: 作業シミュレータ.html（" + kit.length + " 問、" + kit.reduce((n, p) => n + p.wires.length, 0) + " 本の線）");
process.exit(0);   // jsdom のタイマーが残って終わらないので
