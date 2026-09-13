/* ラダー工房 リグレッションテスト（引き継ぎ書 §6 の実装）
   使い方: npm install jsdom && node regression.js            */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const TARGET=process.argv[2]||"ラダー工房.html";
console.log("対象: "+TARGET+"\n");
const dom=new JSDOM(fs.readFileSync(TARGET,"utf8"),
 {runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
w.scrollTo=()=>{};
/* サンドボックス（Classroom のプレビュー等）を再現する。
   実測: あの環境の confirm() はダイアログを出さず即 false を返し、alert() は何も出さない。
   アプリがこれらに頼っていたら機能が死ぬ。使ったら記録して必ず落とす。 */
const usedModal=[];
w.alert  =m=>{ usedModal.push("alert: "+m); };
w.confirm=m=>{ usedModal.push("confirm: "+m); return false; };
/* アプリ自前の確認画面で「はい」を押す */
const yes=()=>{ const b=$("okBtn"); if(b) b.click(); };
w.HTMLElement.prototype.scrollIntoView=function(){};   // jsdom 未実装
const $=id=>d.getElementById(id);
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const judge=()=>$("verdict").className.includes("ok");

console.log("【A】実行意味論");
const run=(p,setup,n)=>JSON.parse(w.eval(`(()=>{const p=newPLC();${setup||""}
 const prog=${p};const log=[];for(let i=0;i<${n};i++){scanOnce(p,prog,null);
 log.push({Y0:!!p.Y["0"],M0:!!p.M["0"],T0:!!p.T["0"]});}return JSON.stringify(log);})()`));
ok(run(`[R([C("X0")],{t:"OUT",dev:"M0"}),R([C("M0")],{t:"OUT",dev:"Y0"})]`,`p.X["0"]=true;`,1)[0].Y0,
   "上→下は同一スキャンで伝わる");
const rv=run(`[R([C("M0")],{t:"OUT",dev:"Y0"}),R([C("X0")],{t:"OUT",dev:"M0"})]`,`p.X["0"]=true;`,2);
ok(!rv[0].Y0&&rv[1].Y0,"下→上は1スキャン遅れる");
ok(run(`[R([C("X0")],{t:"OUT",dev:"Y0"}),R([C("X1")],{t:"OUT",dev:"Y0"})]`,`p.X["0"]=true;`,1)[0].Y0===false,
   "二重コイルは後の行が勝つ");
ok(w.eval(`!/p\\.X\\s*\\[/.test(scanOnce.toString())`),"scanOnceが入力Xを書き換えない");
/* scanOnce の第4引数 onRow（ステップ実行の覗き窓）が計算に影響しないこと */
if(w.eval("scanOnce.length>=4")){
  const PR='[R([C("X0")],{t:"OUT",dev:"M0"}),R([C("M0")],{t:"OUT",dev:"Y0"}),R([C("X0")],{t:"TON",dev:"T0",k:2})]';
  const snap='JSON.stringify([p.Y,p.M,p.T,p.Tacc,p.scans,p.t])';
  const plain=w.eval(`(()=>{const p=newPLC();p.X["0"]=true;const pr=${PR};
    for(let i=0;i<5;i++)scanOnce(p,pr,null);return ${snap};})()`);
  const hooked=w.eval(`(()=>{const p=newPLC();p.X["0"]=true;const pr=${PR};const seen=[];
    for(let i=0;i<5;i++)scanOnce(p,pr,null,ri=>seen.push(ri));
    return ${snap}+"|"+seen.join(",");})()`);
  ok(hooked.split("|")[0]===plain, "onRow を付けても計算結果は1ビットも変わらない");
  ok(hooked.split("|")[1]==="0,1,2,0,1,2,0,1,2,0,1,2,0,1,2", "onRow は行を上から順に1回ずつ呼ぶ");
}

console.log("【B】全レッスン ref=正解 / start=未完成 / halfway=未完成");
const n=w.eval("LESSONS.length");
for(let i=0;i<n;i++){
  if(w.eval(`!!LESSONS[${i}].free`))continue;
  const nm=w.eval(`LESSONS[${i}].name`), id=w.eval(`LESSONS[${i}].id`);
  w.eval(`idx=${i};load();prog=clone(L().ref);`); $("checkBtn").click();
  ok(judge(), `${nm}: お手本が正解`);
  w.eval(`idx=${i};load();`); $("checkBtn").click();
  if(id!==1) ok(!judge(), `${nm}: 初期は未完成`);
  if(w.eval(`!!LESSONS[${i}].halfway`)){
    w.eval(`idx=${i};load();prog=clone(L().halfway);`); $("checkBtn").click();
    ok(!judge(), `${nm}: 半分回路は未完成`);
  }
}

console.log("【C】典型的な誤答が落ちるか");
const wrong=[
 [7,'[R([PAR([C("X0")],[C("Y0")])],{t:"OUT",dev:"Y0"}),R([C("X1")],{t:"TON",dev:"T0",k:30})]',"自動ドア: タイマなし"],
 [8,'[R([PAR([C("X0")],[C("Y0")]),C("X1",true)],{t:"OUT",dev:"Y0"}),R([C("Y0")],{t:"TON",dev:"T0",k:30}),R([C("Y0")],{t:"OUT",dev:"Y1"})]',"踏切: 遮断機が即下りる"],
 [9,'[R([PAR([C("X0")],[C("M0")])],{t:"OUT",dev:"M0"}),R([C("M0"),C("X1")],{t:"OUT",dev:"Y0"})]',"自販機: 解除なし"],
 [10,'[R([PAR([C("X0")],[C("Y0")]),C("X2",true)],{t:"OUT",dev:"Y0"}),R([PAR([C("X1")],[C("Y1")]),C("X2",true)],{t:"OUT",dev:"Y1"})]',"正逆転: インターロックなし"],
 [11,'[R([PAR([C("X1")],[C("Y0")]),C("X3",true)],{t:"OUT",dev:"Y0"}),R([PAR([C("X0")],[C("Y1")]),C("X2",true)],{t:"OUT",dev:"Y1"})]',"エレベーター: インターロックなし"],
 [11,'[R([PAR([C("X1")],[C("Y0")]),C("Y1",true)],{t:"OUT",dev:"Y0"}),R([PAR([C("X0")],[C("Y1")]),C("Y0",true)],{t:"OUT",dev:"Y1"})]',"エレベーター: リミットで止めない"],
];
wrong.forEach(([i,p,nm])=>{ w.eval(`idx=${i};load();prog=${p};`); $("checkBtn").click();
  ok(!judge(), nm+" が落ちる"); });

console.log("【D】UIの基本動作");
w.eval("idx=2;load();");
d.querySelector("#ladder .el").click();
ok($("pop").classList.contains("show"),"接点タップで編集が開く");
$("pPar").click();
ok(w.eval("JSON.stringify(prog)").includes('"p"'),"並列が追加される");
w.eval("idx=11;load();");
ok($("machbox").style.display!=="none" && $("mach").innerHTML.length>200,"機械の絵が描画される");
ok(d.querySelectorAll("#xrow .sens").length===2,"センサがタップ不可の枠で出る");
w.eval("idx=7;load();"); $("hintBtn").click();
ok($("hintbox").innerHTML.includes("ヒント1"),"ヒントが段階表示される");

/* 「最初からやり直す」（v2 以降。旧版には無いので存在するときだけ検査する） */
if($("resetProg")){
  w.eval("idx=11;load();prog=clone(L().ref);mstate.pos=0.73;");
  $("resetProg").click(); yes();
  ok(w.eval("JSON.stringify(prog)===JSON.stringify(clone(LESSONS[11].start))"),
     "最初からやり直す: 回路が start に戻る（ref ではない）");
  ok(w.eval("JSON.stringify(mstate)===JSON.stringify(MACHINES.elev.init())"),
     "最初からやり直す: 機械の状態もリセットされる");
  ok(w.eval("plc.scans===0"), "最初からやり直す: スキャン回数が 0 に戻る");
  ok(!/お手本に戻す/.test(d.body.innerHTML), "「お手本に戻す」という嘘のラベルが残っていない");
}

/* 編集モード／運転モード（v2 以降）。実機の書込み／モニタに当たる */
if(d.body.dataset.mode!==undefined && $("progState")){
  w.eval("idx=2;load();closePop();");
  ok(d.body.dataset.mode==="edit", "はじめは編集モード");
  ok(!$("addRung").disabled, "編集モードでは行を追加できる");
  $("runBtn").click();
  ok(d.body.dataset.mode==="run", "RUN で運転モードになる");
  ok($("addRung").disabled && $("resetProg").disabled,
     "運転中は回路を変えるボタンが押せない");
  ok(d.querySelectorAll("#ladder .ins").length>0, "挿入ボタン自体はDOM上にある");
  const p0=w.eval("JSON.stringify(prog)");
  d.querySelector("#ladder .el").click();
  ok(!$("pop").classList.contains("show"), "運転中は接点をタップしても編集が開かない");
  ok(w.eval("JSON.stringify(prog)")===p0, "運転中に回路が変わらない");
  $("runBtn").click();
  ok(d.body.dataset.mode==="edit", "STOP で編集モードに戻る");
  ok(!$("addRung").disabled, "STOP で編集ボタンが戻る");
}

/* 接点の追加・削除（v2 以降）。図の上の「＋」と、行ごとの「この行を消す」 */
if(d.querySelector("#ladder .ins")){
  w.eval("idx=1;load();closePop();");
  const n0=w.eval("prog[0].elems.length");
  d.querySelectorAll("#ladder .ins")[0].click();
  ok(w.eval("prog[0].elems.length")===n0+1, "図の＋で接点が1つ増える");
  ok(w.eval('JSON.stringify(prog[0].elems[0])')===w.eval('JSON.stringify(C("X0"))'),
     "いちばん左の＋は、いちばん左に入る（末尾ではない）");

  w.eval("idx=8;load();closePop();prog=clone(L().ref);sel=null;drawLadder();");   // 踏切 = 3行
  const rows=w.eval("prog.length"), second=w.eval("JSON.stringify(prog[1])");
  ok(rows===3, "踏切のお手本は3行");
  d.querySelectorAll("#ladder .rungno")[0].click();                    // 1行目の行番号をタップ
  ok($("pop").classList.contains("show") && !!$("rDel"), "行番号タップで行のメニューが開く");
  $("rDel").click(); yes();                                            // 1行目を消す
  ok(w.eval("prog.length")===rows-1, "「この行を消す」で行が1つ減る");
  ok(w.eval("JSON.stringify(prog[0])")===second,
     "消えたのは押した行。最後の行ではない（旧 delRung の嘘の再発防止）");
  ok(!/選んだ行を削除/.test(d.body.innerHTML), "「選んだ行を削除」という嘘のラベルが残っていない");
  // 行の下に足す
  w.eval("idx=8;load();closePop();prog=clone(L().ref);sel=null;drawLadder();");
  d.querySelectorAll("#ladder .rungno")[0].click(); $("rAdd").click();
  ok(w.eval("prog.length")===4, "「この行の下に新しい行を足す」で行が増える");
  ok(w.eval("JSON.stringify(prog[2])")===w.eval("JSON.stringify(clone(LESSONS[8].ref)[1])"),
     "足した行は2番目に入り、元の2行目は3番目へ下がる");
  // 右端にボタンを置かない（横幅を食わないこと）
  ok(d.querySelectorAll("#ladder .delbtn").length===0,
     "回路の右端に削除ボタンを置いていない（図の横幅を食わない）");
}

/* ステップ実行（v2 以降） */
if($("stepBtn")){
  w.eval("idx=0;load();closePop();");
  const s0=w.eval("plc.scans");
  $("stepBtn").click();
  ok(w.eval("plc.scans")===s0+1, "「1スキャン」でスキャン回数が1つだけ増える");
  ok(w.eval("stepping")===true, "再生中はステップ状態になる");
  ok($("addRung").disabled && $("stepBtn").disabled, "ステップ再生中は編集もRUNも止まる");
  w.eval("stop();");
  ok(w.eval("stepping")===false && w.eval("scanIdx")===-1, "止めると再生も終わり、走査位置が戻る");
  ok(!$("addRung").disabled, "止めたあとは編集に戻る");
}

/* RUN / STOP でステータス帯の MODE が追従するか（v2 以降） */
if($("scanbar") && $("scanbar").textContent.includes("MODE")){
  w.eval("idx=0;load();");
  $("runBtn").click();
  ok($("scanbar").textContent.includes("RUN"), "RUN を押すと MODE が RUN になる");
  $("runBtn").click();
  ok($("scanbar").textContent.includes("STOP"), "STOP を押すと MODE が STOP に戻る");
  ok(!$("ledRun").className.includes("on"), "STOP で RUN ランプが消える");
}

/* 「お手本を見る」（v2 以降）: 別枠に出る・自分の回路を壊さない */
if($("refbox")){
  w.eval("idx=4;load();prog[0].elems.push(C('X2'));");   // 生徒が途中まで組んだ状態
  const mine=w.eval("JSON.stringify(prog)");
  $("ansBtn").click(); yes();
  ok(w.eval("JSON.stringify(prog)")===mine, "お手本を見ても自分の回路が消えない");
  ok($("refbox").style.display!=="none", "お手本が別枠で開く");
  ok($("refladder").innerHTML.includes("coilsym"), "お手本の回路が描かれている");
  ok($("refnote").innerHTML.length>0, "お手本に回路の説明がつく");
  ok(w.eval("!!sawAns[5]"), "お手本を見たことが記録に残る");
  $("ansBtn").click();
  ok($("refbox").style.display==="none", "もう一度押すと閉じる");
  $("ansBtn").click(); yes(); $("refUse").click(); yes();
  ok(w.eval("JSON.stringify(prog)===JSON.stringify(clone(LESSONS[4].ref))"),
     "「この回路を入れて試す」でお手本が入る");
  w.eval("idx=5;load();");
  ok($("refbox").style.display==="none", "レッスンを移るとお手本枠は閉じる");
}

console.log("【E】サンドボックス耐性");
ok(usedModal.length===0,
   "ブラウザの confirm / alert に頼っていない" +
   (usedModal.length?"　→ 使われた: "+usedModal.join(" / "):""));

console.log("\n"+(fail===0?"すべて合格":"★ "+fail+" 件 失敗"));
console.log("実行時エラー: "+(errs.length?[...new Set(errs)].join("\n"):"なし"));
process.exit(fail?1:0);
