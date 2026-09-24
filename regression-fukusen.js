/* 複線図れんしゅう リグレッションテスト
   使い方: npm install jsdom && node regression-fukusen.js 複線図練習.html   */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",e=>{errs.push(String(e&&e.message||e));});
const TARGET=process.argv[2]||"複線図練習.html";
console.log("対象: "+TARGET+"\n");
const errs=[];
const dom=new JSDOM(fs.readFileSync(TARGET,"utf8"),
 {runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"https://example.org/"});
const w=dom.window,d=w.document;
/* Classroom のプレビュー等を再現する。confirm は即 false、alert は何も出さない */
const usedModal=[];
w.alert  =m=>{ usedModal.push("alert: "+m); };
w.confirm=m=>{ usedModal.push("confirm: "+m); return false; };
w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
const $=id=>d.getElementById(id);
const E=s=>w.eval(s);
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const tap=sel=>{ const el=d.querySelector(sel); if(!el) throw new Error("見つからない: "+sel); el.dispatchEvent(new w.MouseEvent("click",{bubbles:true})); };
const yes=()=>{ const b=$("okBtn"); if(b) b.click(); };

/* 判定を問題ごとに呼ぶ。st は refState の形 */
const judgeRef=(id,mut)=>E(`(()=>{ openProblem(${JSON.stringify(id)}); const st=refState(P); (${mut||"()=>{}"})(st); const r=judge(st); view=S; return JSON.stringify(r.map(x=>x.cat)); })()`);
const cats=(id,mut)=>JSON.parse(judgeRef(id,mut));
const ids=JSON.parse(E("JSON.stringify(PROBLEMS.map(p=>p.id))"));

console.log("【A】お手本は合格し、何も描かないと不合格");
ids.forEach(id=>{
  ok(cats(id).length===0,id+": お手本 → 指摘なし"+(cats(id).length?" → "+cats(id).join(","):""));
  ok(E(`(()=>{openProblem("${id}");const r=judge(newState());view=S;return r.some(x=>x.cat==="未完成");})()`),id+": 空の図 → 未完成");
});

console.log("\n【B】典型的な誤答が落ちる");
ids.forEach(id=>{
  // 1本消す
  ok(cats(id,"st=>st.cores.pop()").includes("未完成"),id+": 線を1本消す → 未完成");
  // ランプの受金（接地側）と中心を入れ替える（極性の逆）
  const hasW=E(`(()=>{openProblem("${id}");return P.parts.some(p=>p.terms.some(t=>t.w)&&p.type!=="outlet");})()`);
  if(hasW){
    const c=cats(id,`st=>{ const p=P.parts.find(p=>p.type!=="outlet"&&p.terms.some(t=>t.w)); const w=p.terms.find(t=>t.w).id, o=p.terms.find(t=>!t.w).id;
      st.cores.forEach(k=>{ ["a","b"].forEach(s=>{ if(k[s]===w) k[s]=o; else if(k[s]===o) k[s]=w; }); }); }`);
    ok(c.includes("接地側"),id+": 照明の接地側と非接地側を逆につなぐ → 接地側"+" → "+c.join(","));
  }
  // 接地側の白を黒にする
  ok(cats(id,`st=>{ const k=st.cores.find(k=>k.c==="白"&&(k.a==="PW.N"||k.b==="PW.N")); k.c="黒"; }`).includes("色"),id+": 電源Nの白を黒にする → 色");
  // 電源 L と N を同じ接続点に（短絡）
  ok(cats(id,`st=>{ const k=st.cores.find(k=>k.a==="PW.N"); const l=st.cores.find(k=>k.a==="PW.L"); k.b=l.b; }`).includes("短絡"),id+": 電源のLとNを同じ接続点へ → 短絡");
  // スイッチを飛ばす（スイッチの帰り線を電源側の接続点へ）
  ok(cats(id,`st=>{ const k=st.cores.find(k=>/^Sa\\.(2|3)$/.test(k.a)); const l=st.cores.find(k=>k.a==="PW.L"); k.b=l.b; }`).length>0,id+": スイッチの帰り線を電源側へ → 不合格");
});

console.log("\n【C】3路スイッチ");
ok(cats("r4",`st=>{ st.cores.forEach(k=>{ if(k.a==="Sb.1") k.a="Sb.3"; else if(k.a==="Sb.3") k.a="Sb.1"; }); }`).length===0,"片方の1と3を入れ替えても合格（どちらでも正しい）");
ok(cats("r4",`st=>{ st.cores.forEach(k=>{ if(k.a==="Sb.0") k.a="Sb.1"; else if(k.a==="Sb.1") k.a="Sb.0"; }); }`).includes("動作"),"0と1を入れ替える → 動作");

console.log("\n【D】電気の計算");
E(`openProblem("r1")`);
ok(E(`(()=>{const r=simulate(refState(P),{Sa:true});return r.load.La.on;})()`),"練習1 スイッチ入 → ランプ点灯");
ok(E(`(()=>{const r=simulate(refState(P),{Sa:false});return !r.load.La.on;})()`),"練習1 スイッチ切 → ランプ消灯");
E(`openProblem("r2")`);
ok(E(`(()=>{const r=simulate(refState(P),{Sa:false});return r.load.O1.on;})()`),"練習2 スイッチ切でもコンセントに電圧");
console.log("\n【E】画面をタップして描ける");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1")`);
const pen=c=>tap(`#pens .pen[data-c="${c}"]`);
const line=(a,b)=>{ tap(`[data-hit="t:${a}"]`); tap(b.startsWith("box:")?`[data-hit="${b}"]`:`[data-hit="${b}"]`); };
const jointOf=(t)=>E(`(()=>{const k=S.cores.find(k=>k.a==="${t}"||k.b==="${t}");return k.a[0]==="#"?k.a:k.b;})()`);
pen("黒"); line("PW.L","box:B1");
const j1=jointOf("PW.L");
line("Sa.1","j:"+j1);
pen("白"); line("PW.N","box:B1");
const j2=jointOf("PW.N");
line("La.W","j:"+j2);
line("Sa.2","box:B1");
const j3=jointOf("Sa.2");
pen("黒"); line("La.C","j:"+j3);
ok(E("S.cores.length")===6 && E("S.joints.length")===3,"6本の線と3つの接続点ができた");
tap("#judgeBtn");
ok(/合格/.test($("result").textContent),"判定 → 合格");
ok(d.querySelector("#probs button.on").classList.contains("done"),"合格した問題に印がつく");
// 線をタップして色を変える → 不合格 → ヒント
tap(`[data-hit="core:0"]`);
ok($("selbar").classList.contains("show"),"線をタップすると色・消すの操作が出る");
tap(`#selPens .pen[data-c="赤"]`);
ok(E("S.cores[0].c")==="赤","色を赤に変えた");
tap("#judgeBtn");
ok(/色/.test($("result").textContent),"判定 → 色の指摘");
ok(!$("hintBtn").disabled,"ヒントが押せる");
tap("#hintBtn"); const h1=d.querySelector("#result .hint").textContent;
ok(E("judged[0].lv3")&&h1.indexOf(E("judged[0].lv3"))<0,"ヒント1段目は場所だけ（理由はまだ出ない）");
tap("#hintBtn"); ok(d.querySelector("#result .hint").textContent.indexOf(E("judged[0].lv3"))>=0,"ヒント2段目で理由が出る");
// ケーブルが無い所へは引けない
const n0=E("S.cores.length");
tap(`[data-hit="t:La.W"]`); tap(`[data-hit="t:Sa.1"]`);
ok(E("S.cores.length")===n0 && $("status").classList.contains("err"),"ケーブルの無い所へは線を引けない");
tap("#unsel");
// スイッチ操作
tap("#modeBtn");
tap(`[data-hit="sw:Sa"]`);
ok(E("swState.Sa")===true,"確かめるモードでスイッチを入れられる");
tap("#modeBtn");
// 消す
tap("#clearBtn"); yes();
ok(E("S.cores.length")===0,"自前の確認で「消す」→ すべて消える");
// お手本
tap("#refBtn"); yes();
ok($("refBanner").classList.contains("show")&&E("view.cores.length")===6,"お手本を表示");
tap("#backMine");
ok(E("view===S"),"自分の図に戻る");

console.log("\n【F】後始末");
ok(usedModal.length===0,"ブラウザの confirm / alert に頼っていない"+(usedModal.length?" → "+usedModal.join(" / "):""));
ok(errs.length===0,"スクリプトエラーなし"+(errs.length?" → "+errs.join(" / "):""));
ok(/版 \d{4}-\d{2}-\d{2}[a-z]?/.test($("ver").textContent),"版の表示がある");

console.log("\n"+(fail?"✗ 不合格 "+fail+" 項目":"✓ すべて合格"));
process.exit(fail?1:0);
