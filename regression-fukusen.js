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
  ok(E(`(()=>{openProblem("${id}");const r=judge(newState());view=S;return r.some(x=>x.cat==="部品");})()`),id+": 空の図 → 部品（置き忘れ）");
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
  ok(cats(id,`st=>{ /* 最初のスイッチ（リレー等）の端子につながる線のうち、電源の L の●以外へ行くものを、L の●へ付け替える */
      const l=st.cores.find(k=>k.a==="PW.L"||k.b==="PW.L"), lj=l.a==="PW.L"?l.b:l.a, sw=P.switches[0];
      const k=st.cores.find(k=>[k.a,k.b].some(e=>e.startsWith(sw.id+"."))&&[k.a,k.b].some(e=>e[0]==="#"&&e!==lj));
      if(k){ if(k.a[0]==="#") k.a=lj; else k.b=lj; } }`).length>0,id+": スイッチの帰り線を電源側へ → 不合格");
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
ok(/単線図/.test(d.getElementById("stage").textContent) && d.querySelectorAll(`#tansen path[stroke-width="4"]`).length===3,"最初は何も置いていない。単線図にはケーブル3本が描かれている");
ok(d.querySelectorAll("#palette button").length>=9,"部品図が並んでいる");
/* 部品を置く: 部品図をタップ → 図をタップ → 記号を選ぶ */
const put=(type,x,y,lab)=>{ tap(`#palette button[data-type="${type}"]`); w.svgPoint=()=>({x,y}); tap("#stage");
  if(lab!==undefined){ const b=[...d.querySelectorAll("#partLabels button")].find(b=>b.dataset.lab===lab); b.click(); } };
put("src",120,300); put("box",480,300);
ok(d.querySelectorAll(`#stage line[stroke-width="30"]`).length===1,"電源とボックスを置くと、その間のケーブルだけ出る");
put("lamp",480,90);
ok(d.querySelectorAll(`#stage line[stroke-width="30"]`).length===1,"記号なしのランプは単線図と合わないので、ケーブルは出ない");
ok($("partbar").classList.contains("show"),"置いた部品を選んだ状態になり、記号のボタンが出る");
{ const u=E("S.placed[S.placed.length-1].u"), hs=[...d.querySelectorAll(`[data-hit="tx:${u}"]`)];
  ok(hs.length===2,"記号がまだでも、置いた時からランプの端子（○）が2つ出る");
  const g=$("stage").innerHTML;
  ok(/>W<\/text>/.test(g)&&/>B<\/text>/.test(g),"W と B の札も出る");
  hs[0].dispatchEvent(new w.MouseEvent("click",{bubbles:true}));
  ok($("status").classList.contains("err")&&/記号/.test($("status").textContent),"記号が合うまでは線を引けないと伝える"); }
[...d.querySelectorAll("#partLabels button")].find(b=>b.dataset.lab==="イ").click();
ok(d.querySelectorAll(`#stage line[stroke-width="30"]`).length===2,"記号をイにすると単線図と合い、ケーブルが出る");
tap(`#palette button[data-type="sw1"]`); w.svgPoint=()=>({x:480,y:540}); tap("#stage");
ok(d.querySelectorAll(`[data-hit="tx:${E("S.placed[S.placed.length-1].u")}"]`).length===2,"スイッチも置いた時から端子（点）が2つ出る");
[...d.querySelectorAll("#partLabels button")].find(b=>b.dataset.lab==="ロ").click();
tap("#judgeBtn");
ok(/部品/.test($("result").textContent),"記号ちがいのスイッチ → 判定で「部品」の指摘");
tap(`[data-hit="part:${E("S.placed[S.placed.length-1].u")}"]`);
[...d.querySelectorAll("#partLabels button")].find(b=>b.dataset.lab==="イ").click();
ok(d.querySelectorAll(`#stage line[stroke-width="30"]`).length===3,"記号を直すとケーブルが出る");
tap("#unselP");
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
ok(E("S.cores.length")===0 && E("S.placed.length")===4,"「線だけ消す」→ 線は消え、部品は残る");
tap("#clearBtn"); $("altBtn").click();
ok(E("S.placed.length")===0,"「部品も全部片づける」→ 部品も消える");
// お手本
tap("#refBtn"); yes();
ok($("refBanner").classList.contains("show")&&E("view.cores.length")===6,"お手本を表示");
tap("#backMine");
ok(E("view===S"),"自分の図に戻る");

console.log("\n【G】端子の表示・電源の入れ替え");
E(`openProblem("r1")`);
ok(E(`P.term["La.W"].lab`)==="W" && E(`P.term["La.C"].lab`)==="B","ランプレセプタクルの端子は W と B");
ok(/受金ねじ部/.test(E(`ENDNAME("La.W")`)),"メッセージでは W（受金ねじ部）と説明する");
ok(E(`["ceil","outlet","fan"].every(t=>TYPES[t].terms.map(x=>x.lab).join()==="W,B")`),"引掛シーリング・コンセント・換気扇も W と B");
E(`try{localStorage.clear()}catch(e){}`); E(`openProblem("r1"); S=refState(P); view=S; save(); render();`);
const yL=E(`P.term["PW.L"].y`), yN=E(`P.term["PW.N"].y`);
tap(`[data-hit="flip:PW"]`);
ok(E(`P.term["PW.L"].y`)===yN && E(`P.term["PW.N"].y`)===yL,"電源の L と N を上下入れ替えられる");
ok(E(`d=document.querySelector('[data-hit="t:PW.L"]'),+d.getAttribute("cy")`)===yN,"図の端子も入れ替わる");
E(`openProblem("r2")`); E(`openProblem("r1")`);
ok(E(`P.term["PW.L"].y`)===yN,"入れ替えは保存され、開き直しても残る");
ok(JSON.parse(judgeRef("r1")).length===0,"入れ替えても判定は変わらない（お手本は合格）");
tap(`[data-hit="flip:PW"]`);
ok(E(`P.term["PW.L"].y`)===yL,"もう一度押すと元に戻る");

console.log("\n【H】接続点をあとからいじる");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); S=refState(P); view=S; render();`);
const J=t=>E(`(()=>{const k=S.cores.find(k=>k.a==="${t}"||k.b==="${t}");return k.a[0]==="#"?k.a:k.b;})()`);
// 動かす
const jL=J("PW.L");
tap(`[data-hit="j:${jL}"]`);
ok($("jointbar").classList.contains("show"),"●をタップすると接続点の操作が出る");
tap("#mvJoint");
w.svgPoint=()=>({x:470,y:280});
tap(`[data-hit="box:B1"]`);
ok(E(`(()=>{const j=S.joints.find(j=>j.id==="${jL}");return j.x===470&&j.y===280;})()`),"動かすを押して、ボックスの中をタップした所へ●が動く");
ok(E(`jointPos(S.joints.find(j=>j.id==="${jL}")).x`)===470,"動かした位置で描かれる");
tap(`[data-hit="j:${jL}"]`); tap("#mvJoint");
w.svgPoint=()=>({x:900,y:600});
tap(`[data-hit="box:B1"]`);
ok(E(`S.joints.find(j=>j.id==="${jL}").x`)===470 && $("status").classList.contains("err"),"ボックスの外へは動かせない");
tap("#unselJ");
w.svgPoint=()=>({x:0,y:0});
// まとめる（Nの●とスイッチ帰りの●をまとめる → 不合格になる）
const jN=J("PW.N"), jR=J("Sa.2");
tap(`[data-hit="j:${jR}"]`); tap("#mgJoint"); tap(`[data-hit="j:${jN}"]`);
ok(E("S.joints.length")===2 && E(`S.cores.filter(k=>k.a==="${jN}"||k.b==="${jN}").length`)===4,"まとめると●が1つ減り、線はまとめ先へ移る");
// つなぎ先を変える（La.C の線を新しい●へ）
const iC=E(`S.cores.findIndex(k=>k.a==="La.C"||k.b==="La.C")`);
tap(`[data-hit="core:${iC}"]`); tap("#reCore"); tap(`[data-hit="box:B1"]`);
ok(E("S.joints.length")===3 && E(`S.cores.filter(k=>k.a==="${jN}"||k.b==="${jN}").length`)===3,"線のつなぎ先を、ボックスの新しい●へ変えられる");
const iS=E(`S.cores.findIndex(k=>k.a==="Sa.2"||k.b==="Sa.2")`), jNew=J("La.C");
tap(`[data-hit="core:${iS}"]`); tap("#reCore"); tap(`[data-hit="j:${jNew}"]`);
tap("#judgeBtn");
ok(d.querySelector("#result .cat.pass")&&d.querySelectorAll("#result .cat:not(.pass)").length===0,"まとめ・付け替えで元の正しい形に戻せば合格");
// 渡り線は付け替えできない
E(`openProblem("r3"); S=refState(P); view=S; render();`);
const iW=E(`S.cores.findIndex(k=>k.a[0]!=="#"&&k.b[0]!=="#")`);
tap(`[data-hit="core:${iW}"]`); tap("#reCore");
ok($("status").classList.contains("err"),"渡り線は付け替えの対象外と伝える");
tap("#unsel");
// 消す
const jd=E(`S.joints[0].id`), n1=E("S.cores.length"), m1=E(`S.cores.filter(k=>k.a==="${jd}"||k.b==="${jd}").length`);
tap(`[data-hit="j:${jd}"]`); tap("#delJoint"); yes();
ok(E("S.cores.length")===n1-m1 && !E(`S.joints.some(j=>j.id==="${jd}")`),"●を消すと、つながる線も消える（自前の確認つき）");

console.log("\n【I】●をドラッグで動かす");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); S=refState(P); view=S; sel=null; render();`);
const jg=E(`S.cores.find(k=>k.a==="PW.N").b`);
const pev=(type,x,y,el)=>{ const ev=new w.MouseEvent(type,{bubbles:true,clientX:x,clientY:y}); Object.defineProperty(ev,"pointerId",{value:1}); (el||$("stage")).dispatchEvent(ev); };
w.svgPoint=e=>({x:e.clientX,y:e.clientY});
pev("pointerdown",500,310,d.querySelector(`[data-hit="j:${jg}"]`));
pev("pointermove",502,311);
ok(E(`S.joints.find(j=>j.id==="${jg}").x`)===undefined,"少し（6px 未満）動かしただけでは動かない");
pev("pointermove",520,340); pev("pointermove",530,350);
ok(E(`(()=>{const j=S.joints.find(j=>j.id==="${jg}");return j.x===530&&j.y===350;})()`),"ドラッグについてくる");
pev("pointerup",530,350); tap("#stage");
ok(!$("jointbar").classList.contains("show") && E("sel")===null,"ドラッグの終わりは「タップして選んだ」にならない");
ok(E(`(()=>{try{return JSON.parse(localStorage.getItem("fukusen:r1")).joints.some(j=>j.id==="${jg}"&&j.x===530)}catch(e){return false}})()`),"動かした位置は保存される");
pev("pointerdown",530,350,d.querySelector(`[data-hit="j:${jg}"]`)); pev("pointermove",540,360); pev("pointermove",900,600); pev("pointerup",900,600); tap("#stage");
ok(E(`S.joints.find(j=>j.id==="${jg}").x`)===530 && /やめた/.test($("status").textContent),"ボックスの外まで引っぱって何も無い所で離すと、●は元の位置のまま（線も引かない）");
pev("pointerdown",0,0,d.querySelector(`[data-hit="j:${jg}"]`)); pev("pointerup",0,0); tap(`[data-hit="j:${jg}"]`);
ok($("jointbar").classList.contains("show"),"動かさずに離せば、ふつうのタップ（選ぶ）になる");
tap("#unselJ");

console.log("\n【J】部品の配置");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); S=refState(P); view=S; sel=null; render();`);
// 端子の札の色
{ const g=$("stage").innerHTML;
  ok(/fill="#1f1f1f"[^>]*\/?>(<\/rect>)?<text[^>]*fill="#fff">B</.test(g) && /fill="#fff" stroke="#6b7280"[^>]*\/?>(<\/rect>)?<text[^>]*>W</.test(g),"B は黒地、W は白地の札");
  ok(/fill="#1f1f1f"[^>]*\/?>(<\/rect>)?<text[^>]*fill="#fff">L</.test(g) && /fill="#fff" stroke="#6b7280"[^>]*\/?>(<\/rect>)?<text[^>]*>N</.test(g),"L は黒地、N は白地の札");
  ok(/stroke-opacity="0.45"/.test(g),"ケーブルの帯は薄く（透明度を上げて）表示"); }
// 部品のドラッグ
const uLa=E(`S.placed.find(i=>i.pid==="La").u`);
w.svgPoint=e=>({x:e.clientX,y:e.clientY});
pev("pointerdown",500,80,d.querySelector(`[data-hit="part:${uLa}"]`)); pev("pointermove",520,90); pev("pointermove",600,120); pev("pointerup",600,120); tap("#stage");
ok(E(`(()=>{const i=S.placed.find(i=>i.u==="${uLa}");return i.x===600&&i.y===120;})()`),"部品をドラッグで動かせる");
ok(E(`P.term["La.W"].x`)!==500-19,"端子も一緒に動く");
// ボックスのドラッグで、動かした●も一緒に動く
const jj=E(`S.joints[0].id`); E(`moveJoint("${jj}",480,300); render();`);
pev("pointerdown",500,310,d.querySelector(`[data-hit="box:B1"]`)); pev("pointermove",520,310); pev("pointermove",540,330); pev("pointerup",540,330); tap("#stage");
ok(E(`(()=>{const j=S.joints.find(j=>j.id==="${jj}");return j.x===520&&j.y===320;})()`),"ボックスをドラッグすると、中の●も一緒に動く");
// 部品を消すと、その部品の線も消える
const n0b=E("S.cores.length");
tap(`[data-hit="part:${uLa}"]`); tap("#delPart"); yes();
ok(E("S.cores.length")===n0b-2 && !E(`S.placed.some(i=>i.u==="${uLa}")`),"部品を消すと、つながっていた線も消える（自前の確認つき）");
ok(E(`judge(S).some(x=>x.cat==="部品")`),"消したランプは「置き忘れ」になる"); E("view=S");
// 3路: 同じ種類・記号が2つ → お手本の配置で近い方に対応
E(`openProblem("r4"); S=newState(); view=S; render();`);
ok(E(`(()=>{const a=placeItem("sw3",700,540); a.label="イ"; a.pid=null; assign(a); return a.pid;})()`)==="Sb","右に置いた3路スイッチは、単線図の右のスイッチに対応する");
// 古い版の保存（部品を置く前）: お手本の配置で開く
E(`localStorage.setItem("fukusen:r1", JSON.stringify({joints:[{id:"#j900",box:"B1"}],cores:[{a:"PW.L",b:"#j900",c:"黒"}],flip:{}}))`);
E(`openProblem("r1")`);
ok(E("S.placed.length")===4 && E("S.cores.length")===1,"古い版で描いた図は、お手本の配置で部品を置いて開く");
ok(E("seq")>900,"古い図の番号とぶつからない");
// お手本は単線図の配置
E(`openProblem("r1")`); tap("#refBtn"); yes();
ok(E(`P.part.La.x===P.part.La.ax && P.part.La.y===P.part.La.ay`),"お手本は単線図どおりの配置で出る");
tap("#backMine");
// 単線図の拡大
tap("#tansen"); ok($("big").classList.contains("show"),"単線図をタップすると大きく出る"); tap("#bigClose");
ok(!$("big").classList.contains("show"),"閉じられる");

console.log("\n【K】端子からドラッグで線を伸ばす");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); { const r=refState(P); S=newState(); S.placed=r.placed; } view=S; sel=null; render();`);
w.svgPoint=e=>({x:e.clientX,y:e.clientY});
const dragWire=(from,to,midHit)=>{ w.hitAt=()=>midHit||null; pev("pointerdown",0,0,d.querySelector(`[data-hit="t:${from}"]`)); pev("pointermove",20,20); pev("pointermove",200,200);
  w.hitAt=()=>to; pev("pointerup",210,210); tap("#stage"); };
tap(`#pens .pen[data-c="黒"]`);
w.hitAt=()=>null; pev("pointerdown",0,0,d.querySelector(`[data-hit="t:PW.L"]`)); pev("pointermove",20,20); pev("pointermove",300,300);
ok(/stroke-dasharray="10 6"/.test($("stage").innerHTML),"ドラッグ中は、指まで伸びる線が出る");
ok(/fill="#eff6ff"/.test($("stage").innerHTML),"ドラッグ中は、つなげるボックスが青くなる");
w.hitAt=()=>"box:B1"; pev("pointerup",300,300); tap("#stage");
ok(E("S.cores.length")===1 && E("S.joints.length")===1 && E("S.cores[0].c")==="黒","ボックスの上で離すと、●ができて線がつながる");
ok(!$("jointbar").classList.contains("show") && E("sel")===null,"離したあと、何かが選ばれた状態にはならない");
const jd1=E("S.joints[0].id");
dragWire("Sa.1","j:"+jd1,"j:"+jd1);
ok(E("S.cores.length")===2 && E("S.joints.length")===1,"●の上で離すと、その●につながる");
{ const n=E("S.joints.length"); w.svgPoint=()=>({x:470,y:330}); w.hitAt=()=>null; pev("pointerdown",0,0,d.querySelector(`[data-hit="t:PW.N"]`)); pev("pointermove",20,20); pev("pointermove",200,200);
  w.hitAt=()=>"core:0"; pev("pointerup",210,210); tap("#stage"); w.svgPoint=e=>({x:e.clientX,y:e.clientY});
  ok(E("S.cores.length")===3 && E("S.joints.length")===n+1,"ボックスの中なら、線の上で離しても新しい●につながる");
  E("S.cores.pop(); tidy(); render();"); }
dragWire("La.W",null);
ok(E("S.cores.length")===2 && /やめた/.test($("status").textContent),"何も無い所で離すと、線は引かない");
dragWire("La.W","t:Sa.2");
ok(E("S.cores.length")===2 && $("status").classList.contains("err"),"ケーブルの無い所へは、ドラッグでもつなげない");
// ●のドラッグは今までどおり●を動かす
pev("pointerdown",500,310,d.querySelector(`[data-hit="j:${jd1}"]`)); pev("pointermove",520,320); pev("pointermove",530,330); pev("pointerup",530,330); tap("#stage");
ok(E(`S.joints.find(j=>j.id==="${jd1}").x`)===530 && E("S.cores.length")===2,"●からのドラッグは、●を動かす（線は伸ばさない）");
// タップで引く方法も残っている
tap(`[data-hit="t:PW.N"]`); tap(`[data-hit="box:B1"]`);
ok(E("S.cores.length")===3,"タップ → タップでも線を引ける");
w.hitAt=()=>null;

console.log("\n【L】●からドラッグで線を伸ばす");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); { const r=refState(P); S=newState(); S.placed=r.placed; } view=S; sel=null; render();`);
tap(`#pens .pen[data-c="黒"]`);
tap(`[data-hit="t:PW.L"]`); tap(`[data-hit="box:B1"]`);
const jLw=E("S.joints[0].id");
// ボックスの中だけで動かす → ●が動く
w.svgPoint=()=>({x:500,y:310}); pev("pointerdown",0,0,d.querySelector(`[data-hit="j:${jLw}"]`));
w.svgPoint=()=>({x:520,y:320}); pev("pointermove",30,30); w.svgPoint=()=>({x:530,y:330}); pev("pointermove",40,40); pev("pointerup",40,40); tap("#stage");
ok(E(`S.joints[0].x`)===530 && E("S.cores.length")===1,"ボックスの中で動かすと、●が動く（線は増えない）");
// ボックスの外へ引っぱり出す → 線を伸ばす、●は元の位置へ
w.hitAt=()=>null;
w.svgPoint=()=>({x:530,y:330}); pev("pointerdown",0,0,d.querySelector(`[data-hit="j:${jLw}"]`));
w.svgPoint=()=>({x:540,y:340}); pev("pointermove",30,30);
w.svgPoint=()=>({x:500,y:450}); pev("pointermove",60,60);
ok(/stroke-dasharray="10 6"/.test($("stage").innerHTML),"ボックスの外へ引っぱり出すと、線が伸びる");
ok(E(`S.joints[0].x`)===530,"●は元の位置に戻る");
ok(!$("jointbar").classList.contains("show"),"線を伸ばしている間は、接続点の操作の帯を出さない");
w.hitAt=()=>"t:Sa.1"; w.svgPoint=()=>({x:470,y:520}); pev("pointerup",60,60); tap("#stage");
ok(E("S.cores.length")===2 && E(`S.cores.some(k=>(k.a==="${jLw}"&&k.b==="Sa.1")||(k.b==="${jLw}"&&k.a==="Sa.1"))`),"器具の端子で離すと、●からその端子へ線がつながる");
// 外へ出てから自分のボックスに戻って離す → 取りやめ
w.hitAt=()=>null; w.svgPoint=()=>({x:530,y:330}); pev("pointerdown",0,0,d.querySelector(`[data-hit="j:${jLw}"]`));
w.svgPoint=()=>({x:500,y:450}); pev("pointermove",60,60);
w.hitAt=()=>"box:B1"; w.svgPoint=()=>({x:490,y:300}); pev("pointerup",60,60); tap("#stage");
ok(E("S.cores.length")===2 && !$("status").classList.contains("err") && /やめた/.test($("status").textContent),"自分のボックスに戻って離すと、取りやめ");
// ケーブルの無い器具へ → つながらない
w.hitAt=()=>null; w.svgPoint=()=>({x:530,y:330}); pev("pointerdown",0,0,d.querySelector(`[data-hit="j:${jLw}"]`));
w.svgPoint=()=>({x:300,y:100}); pev("pointermove",60,60);
w.hitAt=()=>"t:PW.N"; pev("pointerup",60,60); tap("#stage");
ok(E("S.cores.length")===3,"電源の N へ（ケーブルが通っている）ならつながる");
w.hitAt=()=>null; w.svgPoint=e=>({x:e.clientX,y:e.clientY});

console.log("\n【M】部品図（公表問題の図記号）");
E(`try{localStorage.clear()}catch(e){}`); E(`openProblem("r1")`);
{ const types=JSON.parse(E("JSON.stringify(PALETTE.flatMap(g=>g.items))"));
  ok(types.length>=25 && d.querySelectorAll("#palette button").length===types.length,"部品図に公表問題の器具が並ぶ（"+types.length+"種）");
  ok(!types.includes("fan"),"公表問題に無い換気扇は部品図に出さない");
  ok(d.querySelectorAll("#palTabs button").length===4,"見出しは4つ（ボックス・電源／照明／点滅器／コンセント）");
  ok(d.querySelectorAll("#palette button:not([hidden])").length===E("PALETTE[0].items.length"),"見出しの1つ目の部品だけが見えている");
  [...d.querySelectorAll("#palTabs button")][2].click();
  ok([...d.querySelectorAll("#palette button:not([hidden])")].every(b=>E(`PALETTE[2].items.includes("${b.dataset.type}")`)),"見出しを押すと、その部品に切り替わる");
  const bad=[];
  types.forEach(t=>{ const svgs=d.querySelector(`#palette button[data-type="${t}"] svg`); if(!svgs||svgs.innerHTML.length<30) bad.push(t); });
  ok(!bad.length,"どの部品にも図記号が描かれている"+(bad.length?" → "+bad.join(","):""));
  const noTerm=[];
  E(`S=newState(); view=S; render();`);
  types.forEach((t,i)=>{ if(E(`isBox("${t}")`)) return; E(`placeItem("${t}", ${100+(i%8)*110}, ${120+Math.floor(i/8)*150}); render();`);
    const it=JSON.parse(E("JSON.stringify(S.placed[S.placed.length-1])"));
    if(d.querySelectorAll(it.pid?`[data-hit^="t:${it.pid}."]`:`[data-hit="tx:${it.u}"]`).length<1) noTerm.push(t); });
  ok(!noTerm.length,"どの器具も、置いた時から端子が出る"+(noTerm.length?" → "+noTerm.join(","):""));
  ok(/fill="#1a7f3a"[^>]*\/?>(<\/rect>)?<text[^>]*fill="#fff">E</.test($("stage").innerHTML),"接地の E は緑の札");
  const sw=E(`JSON.stringify(PALETTE[2].items.map(t=>[t,!!TYPES[t].sw]))`);
  ok(JSON.parse(sw).every(([t,v])=>v),"点滅器はどれも入/切ができる");
}
// ボックスの種類を取り違えない
E(`openProblem("r1"); S=newState(); view=S;`);
ok(E(`(()=>{const a=placeItem("obox",500,310); return a.label==="B1" && a.pid===null;})()`),"単線図がジョイントボックスの所にアウトレットボックスを置いても、対応しない");
ok(E(`(()=>{S=newState(); view=S; const a=placeItem("box",500,310); return a.label==="B1" && a.pid==="B1";})()`),"ジョイントボックスなら対応する");
E(`S=newState(); view=S; placeItem("obox",500,310);`);
E(`render()`);
ok(d.querySelector('rect[data-hit^="part:"][stroke-dasharray]')!==null,"アウトレットボックスは図の中で四角に描く");

console.log("\n【N】1つ戻す");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1")`);
ok($("undoBtn").disabled,"開いた直後は戻せない");
put("src",120,300); put("box",480,300);
ok(E("S.placed.length")===2 && !$("undoBtn").disabled,"部品を置くと戻せるようになる");
tap(`#pens .pen[data-c="黒"]`); tap(`[data-hit="t:PW.L"]`); tap(`[data-hit="box:B1"]`);
ok(E("S.cores.length")===1,"線を1本引いた");
tap("#undoBtn");
ok(E("S.cores.length")===0 && E("S.joints.length")===0 && E("S.placed.length")===2,"1つ戻すと、線と●が消え、部品は残る");
d.dispatchEvent(new w.KeyboardEvent("keydown",{key:"z",ctrlKey:true,bubbles:true}));
ok(E("S.placed.length")===1,"Ctrl+Z でも戻る（ボックスが消える）");
tap("#undoBtn");
ok(E("S.placed.length")===0 && $("undoBtn").disabled,"最初まで戻ると、もう戻せない");
put("src",120,300); put("box",480,300); tap(`[data-hit="t:PW.L"]`); tap(`[data-hit="box:B1"]`);
tap(`[data-hit="core:0"]`); tap(`#selPens .pen[data-c="赤"]`); tap("#undoBtn");
ok(E("S.cores[0].c")==="黒","色を変えたのも戻せる");
tap("#clearBtn"); $("altBtn").click(); tap("#undoBtn");
ok(E("S.placed.length")===2 && E("S.cores.length")===1,"全部片づけたのも戻せる");
ok(E(`JSON.parse(localStorage.getItem("fukusen:r1")).cores.length`)===1,"戻した図が保存される");
E(`openProblem("r2")`); ok($("undoBtn").disabled,"問題を切り替えると、戻す履歴は空になる");

console.log("\n【O】拡大・移動");
E(`try{localStorage.clear()}catch(e){}`); E(`openProblem("r1")`);
ok($("stage").getAttribute("viewBox")==="0 0 1000 620","最初は全体が見える");
tap("#zoomIn");
ok(E("vbox.w")<1000 && $("stage").getAttribute("viewBox")!=="0 0 1000 620","＋で拡大する");
tap("#panBtn"); ok(E("panMode")===true && $("panBtn").classList.contains("on"),"✋ 移動を押すと、移動モードになる");
{ const x0=E("vbox.x"); pev("pointerdown",300,300); pev("pointermove",250,300); pev("pointermove",200,300); pev("pointerup",200,300); tap("#stage");
  ok(E("vbox.x")!==x0 && E("S.placed.length")===0,"移動モードでは、ドラッグで図が動き、何も描かれない"); }
tap("#panBtn"); ok(E("panMode")===false,"もう一度押すと、描くのに戻る");
tap("#zoomFit"); ok($("stage").getAttribute("viewBox")==="0 0 1000 620","全体で元に戻る");
for(let i=0;i<8;i++) tap("#zoomIn"); ok(E("vbox.w")>=250,"拡大しすぎない");
for(let i=0;i<8;i++) tap("#zoomOut"); ok(E("vbox.w")===1000,"縮小しすぎない");
tap("#zoomIn"); E(`openProblem("r2")`); ok(E("vbox.w")===1000,"問題を切り替えると全体表示に戻る");

console.log("\n【P】複線図のスイッチは接点の記号");
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); S=refState(P); view=S; mode="draw"; render();`);
{ const g=$("stage").innerHTML, sx=E("P.part.Sa.x"), sy=E("P.part.Sa.y");
  ok(!new RegExp('<circle cx="'+sx+'" cy="'+sy+'" r="9"').test(g),"複線図のスイッチに黒い●を描かない");
  ok(/stroke-width="4" stroke-linecap="round"/.test(g),"端子の○と刃で描く"); }
tap("#modeBtn");
{ const before=$("stage").innerHTML; tap(`[data-hit="sw:Sa"]`); const after=$("stage").innerHTML;
  ok(before!==after && after.includes(`x2="${E("P.term['Sa.2'].x")}" y2="${E("P.term['Sa.2'].y")}"`),"確かめるモードで入にすると、刃がもう片方の端子に倒れる"); }
tap("#modeBtn");
ok(d.querySelector(`#palette button[data-type="sw1"] svg circle`)!==null,"部品図のスイッチは公表問題の●のまま");
ok(E(`TYPES.sw3.terms.map(t=>t.k).join()`)==="1,0,3","3路は 1・0・3 の順（0 が真ん中）");

console.log("\n【Q】線を曲げる・単線図の曲がり");
const JS=x=>JSON.parse(E("JSON.stringify("+x+")"));
E(`try{localStorage.clear()}catch(e){}`);
E(`openProblem("r1"); S=refState(P); view=S; sel=null; mode="draw"; render();`);
tap(`[data-hit="core:0"]`);
ok(d.querySelector(`[data-hit="bend:0"]`)!==null,"線を選ぶと、真ん中に曲げるつまみが出る");
{ const a=JS(`endPos(S.cores[0].a)`), b=JS(`endPos(S.cores[0].b)`), mx=(a.x+b.x)/2, my=(a.y+b.y)/2;
  w.svgPoint=e=>({x:e.clientX,y:e.clientY});
  pev("pointerdown",mx,my,d.querySelector(`[data-hit="bend:0"]`)); pev("pointermove",mx+10,my+10); pev("pointermove",mx+40,my+60); pev("pointerup",mx+40,my+60); tap("#stage");
  ok(E("S.cores[0].q")!==undefined && /Q/.test(d.querySelector(`[data-hit="core:0"]`).getAttribute("d")),"つまみをドラッグすると、線が曲がる");
  const m=JS(`bendMid(S.cores[0], endPos(S.cores[0].a), endPos(S.cores[0].b))`);
  ok(Math.abs(m.x-(mx+40))<=1 && Math.abs(m.y-(my+60))<=1,"曲線は、指を離した所を通る"); }
ok(E(`JSON.parse(localStorage.getItem("fukusen:r1")).cores[0].q!==undefined`),"曲げた形は保存される");
ok(JSON.parse(judgeRef("r1")).length===0 && E("judge(S).length")===0,"曲げても判定は変わらない"); E("view=S");
tap(`[data-hit="core:0"]`); tap("#straightCore");
ok(E("S.cores[0].q")===undefined,"「まっすぐに戻す」で元に戻る");
tap("#undoBtn"); ok(E("S.cores[0].q")!==undefined,"1つ戻すで、曲げた形に戻る");
w.svgPoint=()=>({x:0,y:0});
E(`openProblem("k5")`);
ok(/Q/.test([...d.querySelectorAll('#tansen path[stroke-width="4"]')].map(p=>p.getAttribute("d")).join(" ")),"単線図の線は、角を丸く曲がる");

console.log("\n【F】後始末");
ok(usedModal.length===0,"ブラウザの confirm / alert に頼っていない"+(usedModal.length?" → "+usedModal.join(" / "):""));
ok(errs.length===0,"スクリプトエラーなし"+(errs.length?" → "+errs.join(" / "):""));
ok(/版 \d{4}-\d{2}-\d{2}[a-z]?/.test($("ver").textContent),"版の表示がある");

console.log("\n"+(fail?"✗ 不合格 "+fail+" 項目":"✓ すべて合格"));
process.exit(fail?1:0);
