/* 進路設計工房 リグレッションテスト
   使い方: npm install jsdom && node regression-shinro.js 進路設計工房.html   */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const TARGET=process.argv[2]||"進路設計工房.html";
console.log("対象: "+TARGET+"\n");
const dom=new JSDOM(fs.readFileSync(TARGET,"utf8"),
 {runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window,d=w.document;
w.scrollTo=()=>{};
/* サンドボックス（Classroom のプレビュー等）を再現する。
   実測: あの環境の confirm() は即 false を返し、alert() は何も出さない。
   アプリがこれらに頼っていたら機能が死ぬ。使ったら記録して必ず落とす。 */
const usedModal=[];
w.alert  =m=>{ usedModal.push("alert: "+m); };
w.confirm=m=>{ usedModal.push("confirm: "+m); return false; };
const $=id=>d.getElementById(id);
const E=s=>w.eval(s);
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const near=(a,b,tol)=>Math.abs(a-b)<=tol;

/* 毎回きれいな状態から始める */
const reset=()=>E("S.life='alone';S.car=true;S.bonus=4.0;S.edited={};S.quiz={};applyDefaults(true);go(0);");

console.log("【A】税と社会保険の概算モデル");
ok(w.tedori(0,true).net===0,"年収0円なら手取りも0円");
{
  const t=w.tedori(2400000,true);
  ok(near(t.shaho/t.gross,0.147,0.001),"社会保険料は額面の約14.7%（健保5.00＋厚年9.15＋雇用0.55）");
  ok(t.kenko+t.nenkin+t.koyo===t.shaho,"社会保険の内訳の合計が shaho と一致する");
  ok(t.net===t.gross-t.shaho-t.zei-t.jumin,"手取り＝額面−社会保険−所得税−住民税");
}
ok(w.tedori(2400000,false).jumin===0,"1年目は住民税がかからない");
ok(w.tedori(2400000,true).jumin>0,"2年目は住民税がかかる");
ok(w.tedori(2400000,true).net<w.tedori(2400000,false).net,"2年目の手取りは1年目より少ない");
{
  const bad=[];
  for(let g=1800000;g<=4000000;g+=100000){
    const r=w.tedori(g,true).net/g;
    if(r<0.75||r>0.88) bad.push(g+":"+r.toFixed(3));
  }
  ok(bad.length===0,"高卒の年収帯で手取りは額面の75〜88%に収まる"+(bad.length?" → "+bad.join(" "):""));
}
{
  let mono=true,prev=-1;
  for(let g=0;g<=6000000;g+=50000){ const n=w.tedori(g,true).net; if(n<prev) mono=false; prev=n; }
  ok(mono,"額面が増えれば手取りも必ず増える（逆転しない）");
}
{
  let bad=null;
  [1200000,1800000,2400000,3000000,4500000].forEach(n=>{
    const g=w.gakumen(n,true), got=w.tedori(g,true).net;
    if(got<n||got>n+4000) bad=n+" → "+g+" → "+got;
  });
  ok(!bad,"逆算（手取り→額面）が元の手取りを満たす最小額になる"+(bad?" → "+bad:""));
}
ok(w.gakumen(2000000,true)>w.gakumen(2000000,false),"同じ手取りでも2年目のほうが多い額面が要る");
ok(E("kyuyoKoujo(1900000)")===650000&&E("kyuyoKoujo(1950000)")>650000,"給与所得控除は190万円まで65万円で、そこから増える");
ok(E("kyuyoKoujo(1900001)-kyuyoKoujo(1900000)")<10,"給与所得控除の境界でとびがない（連続している）");
{
  const t=w.tedori(3000000,true), sho=3000000-E("kyuyoKoujo(3000000)");
  const ka=Math.max(0,sho-t.shaho-E("RATE.juminKiso"));
  ok(t.jumin===Math.floor(ka*0.10)+5000,"住民税＝課税所得×10%＋均等割5,000円");
}

console.log("\n【B】費目と暮らし方");
reset();
{
  const rent=()=>E("shown(ITEMS.filter(i=>i.id==='rent')[0])");
  const ine =()=>E("shown(ITEMS.filter(i=>i.id==='ineie')[0])");
  ok(rent()&&!ine(),"ひとり暮らしでは家賃が出て、家に入れるお金は出ない");
  E("S.life='home';applyDefaults(false);");
  ok(!rent()&&ine(),"実家では家賃が消え、家に入れるお金が出る");
  E("S.life='dorm';applyDefaults(false);");
  ok(E("shown(ITEMS.filter(i=>i.id==='dormf')[0])"),"寮では寮費の欄が出る");
  reset();
}
{
  const carIds=["loan","gas","park","jhoken","jzei","shaken"];
  const cnt=()=>E("["+carIds.map(i=>"'"+i+"'").join(",")+"].filter(id=>shown(ITEMS.filter(i=>i.id===id)[0])).length");
  ok(cnt()===6,"車ありのとき車の費目6つが出る");
  const before=w.outMonth();
  E("S.car=false;");
  ok(cnt()===0,"車なしにすると車の費目が消える");
  ok(E("shown(ITEMS.filter(i=>i.id==='teiki')[0])"),"車なしのときだけ定期代の欄が出る");
  ok(w.outMonth()<before,"車をやめると月の支出が減る");
  reset();
}
ok(near(E("monthOf(ITEMS.filter(i=>i.id==='shaken')[0])"),E("S.v.shaken")/24,1),"2年に一度の車検は24で割って月割りにする");
ok(near(E("monthOf(ITEMS.filter(i=>i.id==='jzei')[0])"),E("S.v.jzei")/12,1),"毎年の自動車税は12で割って月割りにする");
ok(near(w.outMonth(),w.sumOf("m")+w.sumOf("y"),1),"月の支出＝毎月のもの＋年に数回のものの月割り");
{
  E("S.v.food=99999;S.edited.food=1;S.life='home';applyDefaults(false);");
  ok(E("S.v.food")===99999,"自分で入れた金額は、くらし方を変えても書き換えられない");
  E("S.life='alone';applyDefaults(true);");
  ok(E("S.v.food")===E("ITEMS.filter(i=>i.id==='food')[0].def.alone"),"初期値に戻すと既定値に戻る");
  reset();
}

console.log("\n【C】画面と操作");
ok(E("STEPS.length")===7,"7つの段階がある");
ok($("tabs").children.length===7,"タブが7つ描かれている");
ok($("ver").textContent.indexOf("版")===0,"版の表示が出ている（古いファイルを開く事故を防ぐ）");
{
  let bad=[];
  for(let i=0;i<7;i++){ w.go(i);
    if(!$("stage").innerHTML.length) bad.push(i+1);
    if($("side").innerHTML.indexOf("必要な月給")<0) bad.push("side"+(i+1));
  }
  ok(bad.length===0,"7画面すべてが描け、右のまとめ盤も常に出る"+(bad.length?" → "+bad.join(","):""));
}
w.go(1);
{
  const before=E("S.v.food");
  const plus=Array.prototype.filter.call(d.querySelectorAll(".step button"),b=>b.dataset.id==="food"&&b.dataset.d==="1")[0];
  plus.click();
  ok(E("S.v.food")===before+E("ITEMS.filter(i=>i.id==='food')[0].step"),"＋を押すと決まった幅で増える");
  const minus=Array.prototype.filter.call(d.querySelectorAll(".step button"),b=>b.dataset.id==="food"&&b.dataset.d==="-1")[0];
  minus.click();
  ok(E("S.v.food")===before,"−を押すと元に戻る");
}
{
  const inp=Array.prototype.filter.call(d.querySelectorAll(".step input"),i=>i.dataset.id==="food")[0];
  inp.value="12,000円"; inp.onchange();
  ok(E("S.v.food")===12000,"数字以外が混じった入力も数値として読む");
  const inp2=Array.prototype.filter.call(d.querySelectorAll(".step input"),i=>i.dataset.id==="food")[0];
  inp2.value=""; inp2.onchange();
  ok(E("S.v.food")===0,"空欄は0円として扱う");
  reset();
}
{
  w.go(1);
  const before=w.outMonth();
  const plus=Array.prototype.filter.call(d.querySelectorAll(".step button"),b=>b.dataset.id==="food"&&b.dataset.d==="1")[0];
  plus.click();
  ok(w.outMonth()>before,"費目を増やすと月の支出が増える");
  ok($("status").innerHTML.indexOf(E("yen(outMonth())"))>=0,"上のステータス帯が追従する");
  reset();
}
{
  w.go(3);
  const b=E("S.bonus");
  $("bP").click(); ok(near(E("S.bonus"),b+0.5,1e-9),"賞与のか月数を0.5刻みで増やせる");
  $("bM").click(); ok(near(E("S.bonus"),b,1e-9),"賞与のか月数を戻せる");
  $("bIn").value="-3"; $("bIn").onchange();
  ok(E("S.bonus")===0,"賞与にマイナスは入らない");
  reset();
}

console.log("\n【D】求人票と判定");
{
  const j=E("JSON.parse(JSON.stringify(JOBS[0]))"), c=E("JSON.parse(JSON.stringify(calcJob(JOBS[0])))");
  const teate=j.teate.reduce((s,t)=>s+t.v,0);
  ok(c.month===j.kihon+teate,"毎月の額＝基本給＋定額手当（a＋b）");
  ok(c.bonusYen===Math.round(j.kihon*j.bonus),"賞与は基本給にか月数をかけて出す（手当は含めない）");
  ok(c.year===c.month*12+c.bonusYen,"年収＝毎月の額×12＋賞与");
  ok(c.hours===(365-j.nenkyu)*j.jitsudo+j.ot*12,"年間労働時間＝（365−年間休日）×所定＋残業×12");
  ok(near(c.jikyu,c.year/c.hours,1),"1時間あたり＝年収÷年間労働時間");
  ok(c.t1.jumin===0&&c.t2.jumin>0,"求人ごとの手取りも1年目と2年目で分けて出す");
}
{
  reset(); E("S.car=true;S.v.gas=15000;");
  const c=E("JSON.parse(JSON.stringify(calcJob(JOBS[0])))");
  ok(c.tsukin===10000,"通勤手当は上限までしか戻らない");
  ok(c.jikoFutan===5000,"上限を超えた通勤費は自己負担になる");
  ok(near(c.net2,c.t2.net/12+c.tsukin,1),"使える額＝手取り（月）＋通勤手当で戻る分");
  reset();
}
{
  const A=E("JSON.parse(JSON.stringify(calcJob(JOBS[0])))");
  const Q=E("JSON.parse(JSON.stringify(quizList()))");
  ok(Q.length===7,"読み取りの練習が7問ある");
  ok(Q.every(q=>q.o.length===3&&q.a>=0&&q.a<3&&q.ex.length>20),"全問に3択と解説がある");
  ok(Q[0].o[Q[0].a]===E("yen("+A.month+")")+"（基本給＋定額の手当）","Q1の正解が a＋b の計算値と一致する");
  ok(Q[6].o[Q[6].a]===E("yen("+Math.round(A.t2.net/12/1000)*1000+")")+"ぐらい","Q7の正解が2年目の手取りの計算値と一致する");
  ok(Q[1].o[Q[1].a]===E("yen("+A.month+")")+"のまま","Q2の正解は「固定残業代は残業しなくても減らない」");
}
{
  /* 判定のしきい値。支出をわざと作って境界を踏む */
  const set=n=>E("S.edited={};ITEMS.forEach(it=>S.v[it.id]=0);S.v.food="+n+";");
  const net2=()=>E("JSON.parse(JSON.stringify(verdictOf(JOBS[0])))").c.net2;
  set(0); const n=Math.round(net2());
  set(n-30000); ok(E("verdictOf(JOBS[0]).cls")==="ok","使える額に2万円以上の余りがあれば『余裕がある』");
  set(n-10000); ok(E("verdictOf(JOBS[0]).cls")==="warn","余りが2万円未満なら『ぎりぎり』");
  set(n+10000); ok(E("verdictOf(JOBS[0]).cls")==="ng","足りなければ『足りない』");
  reset();
}
{
  /* whatIf は「今の入力を壊さずに試す」ための道具。壊したら生徒の入力が消える */
  reset();
  const snap=E("JSON.stringify([S.life,S.car,S.v])");
  const home=w.whatIf("home",false);
  ok(E("JSON.stringify([S.life,S.car,S.v])")===snap,"『もし〜だったら』の試算をしても入力が書き換わらない");
  ok(home<w.outMonth(),"実家・車なしにすると月の支出は減る");
  ok(w.whatIf(E("S.life"),E("S.car"))===w.outMonth(),"同じ条件で試算すると今の支出と一致する");
}
{
  w.go(5);
  const html=$("stage").innerHTML;
  ok(E("JOBS.length")===3,"比べる求人が3件ある");
  ok(html.indexOf("1時間あたり")>=0,"比較画面に1時間あたりの金額が出る");
  ok(html.indexOf("年間休日")>=0,"比較画面に年間休日が出る");
  ok(html.indexOf("何をどれだけ動かせば届くか")>=0,"届かないときの手当て（暮らし方ごとの比較表）が出る");
  const c=[0,1,2].map(i=>E("JSON.parse(JSON.stringify(calcJob(JOBS["+i+"])))"));
  ok(c[2].month>c[1].month&&c[1].jikyu>c[2].jikyu,
     "月給が高い求人より、休日が多い求人のほうが1時間あたりは高い（順位が入れ替わる）");
  reset();
}

{
  /* 画面に計算のかけらが漏れていないか。NaN や undefined は生徒の目に直接入る */
  const dirty=[];
  [true,false].forEach(car=>["alone","home","dorm"].forEach(life=>{
    E("S.life='"+life+"';S.car="+car+";S.edited={};applyDefaults(true);");
    for(let i=0;i<7;i++){ w.go(i);
      const h=$("stage").innerHTML+$("side").innerHTML+$("status").innerHTML;
      ["NaN","undefined","[object Object]","Infinity"].forEach(bad=>{
        if(h.indexOf(bad)>=0) dirty.push(life+(car?"+車":"")+" STEP"+(i+1)+":"+bad); });
    }}));
  ok(dirty.length===0,"どの組み合わせでも NaN・undefined が画面に出ない"+
     (dirty.length?" → "+dirty.slice(0,6).join(" / "):""));
  reset();
}
{
  /* 支出0円という極端な入力でも壊れないこと */
  E("S.edited={};ITEMS.forEach(it=>S.v[it.id]=0);");
  let broke=false; try{ for(let i=0;i<7;i++) w.go(i); }catch(e){ broke=true; }
  ok(!broke&&w.outMonth()===0,"支出を全部0円にしても画面が壊れない");
  ok(E("gakumen(0,true)")===0,"必要な手取りが0円なら必要な額面も0円");
  reset();
}

console.log("\n【E】サンドボックス耐性");
ok(usedModal.length===0,"ブラウザの confirm / alert に頼っていない"+
   (usedModal.length?"　→ 使われた: "+usedModal.join(" / "):""));
ok(/try\s*\{/.test(w.save.toString())&&/catch/.test(w.save.toString()),"保存は try で包んである（localStorage が使えない環境でも落ちない）");
ok(/try\s*\{/.test(w.load.toString())&&/catch/.test(w.load.toString()),"読み込みも try で包んである");
ok(typeof w.ask==="function"&&typeof w.tell==="function","自前の確認画面 ask / tell を持っている");
{
  w.go(0); $("resetBtn").click();
  ok($("veil").className.indexOf("on")>=0,"『初期値に戻す』で自前の確認画面が開く");
  $("mYes").click();
  ok($("veil").className.indexOf("on")<0,"『もどす』を押すと閉じる");
}
ok(d.querySelectorAll("script[src]").length===0&&d.querySelectorAll("link[href]").length===0,
   "外部ファイルを読み込んでいない（単一HTML・通信なし）");

console.log("\n"+(fail===0?"すべて合格":"★ "+fail+" 件 失敗"));
console.log("実行時エラー: "+(errs.length?[...new Set(errs)].join("\n"):"なし"));
process.exit(fail?1:0);
