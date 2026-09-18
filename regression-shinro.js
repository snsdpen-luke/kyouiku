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
const J=s=>JSON.parse(w.eval("JSON.stringify("+s+")"));
const all=sel=>Array.prototype.slice.call(d.querySelectorAll(sel));
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const near=(a,b,tol)=>Math.abs(a-b)<=tol;
const reset=()=>E("S.life='alone';S.car=true;S.bonus=4.0;S.edited={};S.quiz={};S.kx={};applyDefaults(true);go(0);");
const DIRT=["NaN","undefined","[object Object]","Infinity","null"];

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
ok(w.gakumen(0,true)===0,"必要な手取りが0円なら必要な額面も0円");
ok(w.gakumen(2000000,true)>w.gakumen(2000000,false),"同じ手取りでも2年目のほうが多い額面が要る");
ok(E("kyuyoKoujo(1900000)")===650000&&E("kyuyoKoujo(1950000)")>650000,"給与所得控除は190万円まで65万円で、そこから増える");
ok(E("kyuyoKoujo(1900001)-kyuyoKoujo(1900000)")<10,"給与所得控除の境界でとびがない（連続している）");
{
  const t=w.tedori(3000000,true), sho=3000000-E("kyuyoKoujo(3000000)");
  const ka=Math.max(0,sho-t.shaho-E("RATE.juminKiso"));
  ok(t.jumin===Math.floor(ka*0.10)+5000,"住民税＝課税所得×10%＋均等割5,000円");
}

console.log("\n【B】費目は選択式であること");
reset();
{
  const bad=[];
  E("LIVES").length; // 触っておく
  ["alone","home","dorm"].forEach(life=>{
    E("S.life='"+life+"';");
    J("ITEMS").forEach((it,i)=>{
      if(!E("shown(ITEMS["+i+"])")) return;
      const o=J("optsOf(ITEMS["+i+"])"), k=E("defIdx(ITEMS["+i+"])");
      if(!o||o.length<3) bad.push(life+"/"+it.id+":選択肢が少ない");
      if(!(k>=0&&k<o.length)) bad.push(life+"/"+it.id+":既定の番号が範囲外");
      o.forEach(c=>{ if(typeof c.v!=="number"||!c.nm||!c.d) bad.push(life+"/"+it.id+":選択肢の中身が欠けている"); });
    });
  });
  reset();
  ok(bad.length===0,"表示される全費目に3つ以上の選択肢があり、既定が正しく指せている"+
     (bad.length?" → "+bad.slice(0,4).join(" / "):""));
}
{
  const foodA=J("optsOf(itemOf('food'))");
  E("S.life='home';applyDefaults(false);");
  const foodH=J("optsOf(itemOf('food'))");
  ok(foodA[0].v!==foodH[0].v,"食費の選択肢は暮らし方で入れ替わる（実家とひとり暮らしで別の金額）");
  reset();
}
{
  const rent=()=>E("shown(itemOf('rent'))"), ine=()=>E("shown(itemOf('ineie'))");
  ok(rent()&&!ine(),"ひとり暮らしでは家賃が出て、家に入れるお金は出ない");
  E("S.life='home';applyDefaults(false);");
  ok(!rent()&&ine(),"実家では家賃が消え、家に入れるお金が出る");
  E("S.life='dorm';applyDefaults(false);");
  ok(E("shown(itemOf('dormf'))"),"寮では寮費の欄が出る");
  reset();
}
{
  const carIds=["loan","gas","park","jhoken","jzei","shaken"];
  const cnt=()=>E("["+carIds.map(i=>"'"+i+"'").join(",")+"].filter(id=>shown(itemOf(id))).length");
  ok(cnt()===6,"車ありのとき車の費目6つが出る");
  const before=w.outMonth();
  E("S.car=false;");
  ok(cnt()===0,"車なしにすると車の費目が消える");
  ok(E("shown(itemOf('teiki'))"),"車なしのときだけ定期代の欄が出る");
  ok(w.outMonth()<before,"車をやめると月の支出が減る");
  reset();
}
ok(near(E("monthOf(itemOf('shaken'))"),E("val('shaken')")/24,1),"2年に一度の車検は24で割って月割りにする");
ok(near(E("monthOf(itemOf('jzei'))"),E("val('jzei')")/12,1),"毎年の自動車税は12で割って月割りにする");
ok(near(w.outMonth(),w.sumOf("m")+w.sumOf("y"),1),"月の支出＝毎月のもの＋年に数回のものの月割り");
ok(near(w.outMonth(),E("GRPS.reduce((t,g)=>t+sumGrp(g.id),0)"),1),"グループごとの合計を足すと全体と一致する");

console.log("\n【C】画面と操作");
ok(E("STEPS.length")===5,"5つの段階になっている（暮らし方・毎月・年に数回はひとつの画面）");
ok($("tabs").children.length===5,"タブが5つ描かれている");
ok($("ver").textContent.indexOf("版")===0,"版の表示が出ている（古いファイルを開く事故を防ぐ）");
{
  w.go(0);
  const h=$("stage").innerHTML;
  const miss=J("GRPS").filter(g=>h.indexOf(g.nm)<0).map(g=>g.nm);
  ok(miss.length===0,"STEP1に「住まい」から「年に数回」まで全グループが並ぶ"+(miss.length?" → 欠け:"+miss.join(","):""));
  ok(h.indexOf("年に数回かかるお金")>=0&&h.indexOf("食べる")>=0,"毎月のものと年に数回のものが同じ画面にある");
  const jumps=all("[data-jump]");
  ok(jumps.length===J("GRPS").filter(g=>E("ITEMS.some(it=>it.grp==='"+g.id+"'&&shown(it))")).length,
     "画面が長いので、グループへ飛ぶ目次が全グループぶん出る");
  ok(jumps.every(b=>d.getElementById("grp_"+b.dataset.jump)),"目次の飛び先がすべて存在する");
}
{
  let bad=[];
  for(let i=0;i<5;i++){ w.go(i);
    if(!$("stage").innerHTML.length) bad.push(i+1);
    if($("side").innerHTML.indexOf("必要な月給")<0) bad.push("side"+(i+1));
  }
  ok(bad.length===0,"5画面すべてが描け、右のまとめ盤も常に出る"+(bad.length?" → "+bad.join(","):""));
}
{
  w.go(0);
  const before=E("val('food')");
  const btn=all(".ch").filter(b=>b.dataset.id==="food"&&b.dataset.k==="2")[0];
  btn.click();
  const o=J("optsOf(itemOf('food'))");
  ok(E("val('food')")===o[2].v,"選択肢をタップすると、その金額が入る");
  ok(E("S.pick.food")===2&&E("!!S.edited.food"),"選んだことが記録され、自分で選んだ印が立つ");
  ok(E("val('food')")!==before||o[2].v===before,"金額が選択肢どおりに変わる");
  const on=all(".ch").filter(b=>b.dataset.id==="food"&&b.classList.contains("on"))[0];
  ok(on&&on.dataset.k==="2","選んだ選択肢に印がつく");
}
{
  all(".ch").filter(b=>b.dataset.id==="food"&&b.dataset.k==="-1")[0].click();
  ok(E("S.pick.food")===-1,"「自分で入れる」を選べる");
  const inp=all("[data-free]").filter(i=>i.dataset.free==="food")[0];
  ok(!!inp,"「自分で入れる」を選ぶと入力欄が出る");
  inp.value="12,345円"; inp.onchange();
  ok(E("val('food')")===12345,"数字以外が混じった入力も数値として読む");
  const inp2=all("[data-free]").filter(i=>i.dataset.free==="food")[0];
  inp2.value=""; inp2.onchange();
  ok(E("val('food')")===0,"空欄は0円として扱う");
  reset();
}
{
  w.go(0);
  E("S.pick.food=2;S.v.food=99999;S.edited.food=1;");
  E("S.life='home';applyDefaults(false);");
  ok(E("val('food')")===99999,"自分で選んだ費目は、暮らし方を変えても書き換えられない");
  E("applyDefaults(true);");
  ok(E("val('food')")===J("optsOf(itemOf('food'))")[E("defIdx(itemOf('food'))")].v,"最初に戻すと既定の選択肢に戻る");
  reset();
}
{
  w.go(0);
  const before=w.outMonth();
  all(".ch").filter(b=>b.dataset.id==="fun"&&b.dataset.k==="2")[0].click();
  ok(w.outMonth()>before,"高い選択肢を選ぶと月の支出が増える");
  ok($("status").innerHTML.indexOf(E("yen(outMonth())"))>=0,"上のステータス帯がその場で追従する");
  ok($("side").innerHTML.indexOf(E("yen(outMonth())"))>=0,"右のまとめ盤もその場で追従する");
  reset();
}
{
  w.go(1);
  const b=E("S.bonus");
  $("bP").click(); ok(near(E("S.bonus"),b+0.5,1e-9),"賞与のか月数を0.5刻みで増やせる");
  $("bM").click(); ok(near(E("S.bonus"),b,1e-9),"賞与のか月数を戻せる");
  $("bIn").value="-3"; $("bIn").onchange();
  ok(E("S.bonus")===0,"賞与にマイナスは入らない");
  reset();
}

console.log("\n【D】アドバイス");
{
  const bad=[];
  ["alone","home","dorm"].forEach(life=>[true,false].forEach(car=>{
    E("S.life='"+life+"';S.car="+car+";S.edited={};applyDefaults(true);");
    J("ITEMS").forEach((it,i)=>{
      if(!E("shown(ITEMS["+i+"])")) return;
      J("ITEMS["+i+"]").id;
      const o=J("optsOf(ITEMS["+i+"])");
      for(let k=0;k<o.length;k++){
        E("S.pick['"+it.id+"']="+k+";S.v['"+it.id+"']="+o[k].v+";");
        let t; try{ t=E("advice(itemOf('"+it.id+"'))"); }catch(e){ bad.push(it.id+":例外 "+e.message); continue; }
        if(typeof t!=="string"){ bad.push(it.id+":文字列でない"); continue; }
        DIRT.forEach(x=>{ if(t.indexOf(x)>=0) bad.push(life+"/"+it.id+"/"+k+":"+x); });
      }
    });
  }));
  reset();
  ok(bad.length===0,"全費目×全選択肢×全暮らし方で、アドバイスが壊れない"+
     (bad.length?" → "+bad.slice(0,4).join(" / "):""));
}
{
  E("S.car=true;S.pick.jhoken=1;S.v.jhoken=120000;");
  ok(E("advice(itemOf('jhoken'))").indexOf("親の保険")>=0,"車ありのとき、任意保険で親の保険を確認するよう助言する");
  E("S.life='home';applyDefaults(false);S.pick.save=0;S.v.save=5000;");
  ok(E("advice(itemOf('save'))").indexOf("貯めどき")>=0,"実家で貯金が少ないとき、いまが貯めどきだと助言する");
  E("S.life='alone';applyDefaults(false);S.pick.rent=2;S.v.rent=70000;");
  ok(E("advice(itemOf('rent'))").indexOf("3割")>=0,"家賃が高いとき、手取りの3割という目安を出す");
  E("S.car=true;S.pick.gas=2;S.v.gas=15000;");
  ok(E("advice(itemOf('gas'))").indexOf("自分の財布")>=0,"通勤費が通勤手当の上限を超えるとき、自己負担になると助言する");
  reset();
}

console.log("\n【E】求人票（ハローワークの様式）と、タップ説明");
{
  const h=E("kyujinHTML(JOBS[0])");
  const need=["求人票（高卒）","求人番号","紹介期限日","受理安定所","仕 事 内 容","労 働 時 間",
              "賃 金 ・ 手 当","保 険 ・ 年 金 ・ 定 年 等","選 考 等","事 業 所 情 報","青 少 年 雇 用 情 報",
              "基本給（a）","定額的に支払われる手当（b）","a ＋ b","固定残業代に関する特記事項",
              "週休二日制","年間休日数","加入保険等","退職金共済","受動喫煙対策","平均勤続年数",
              "有給休暇の平均取得日数","月平均所定外労働時間"];
  const miss=need.filter(k=>h.indexOf(k)<0);
  ok(miss.length===0,"本物の求人票の区分と欄名がそろっている"+(miss.length?" → 欠け:"+miss.join(","):""));
}
{
  const keys=E("Object.keys(EXPLAIN).join(',')").split(",");
  ok(keys.length>=25,"タップで開く説明が25欄以上ある（いまは"+keys.length+"欄）");
  const bad=[];
  [0,1,2].forEach(i=>{
    E("S.kx={};");
    keys.forEach(k=>{
      let t; try{ t=E("EXPLAIN['"+k+"'](JOBS["+i+"],calcJob(JOBS["+i+"]))"); }
      catch(e){ bad.push(k+"@"+i+":例外 "+e.message); return; }
      if(typeof t!=="string"||t.length<20){ bad.push(k+"@"+i+":短すぎる"); return; }
      DIRT.forEach(x=>{ if(t.indexOf(x)>=0) bad.push(k+"@"+i+":"+x); });
    });
  });
  ok(bad.length===0,"すべての説明が3件の求人すべてで壊れない（求人ごとの数字で語る）"+
     (bad.length?" → "+bad.slice(0,4).join(" / "):""));
  const h=E("kyujinHTML(JOBS[0])");
  const orphan=keys.filter(k=>h.indexOf('"A:'+k+'"')<0);
  ok(orphan.length===0,"説明はすべて求人票のどれかの欄に結びついている"+(orphan.length?" → 迷子:"+orphan.join(","):""));
}
{
  w.go(2);
  const tap=all(".kg.tap");
  ok(tap.length>=25,"求人票の欄がタップできる状態で描かれている（"+tap.length+"欄）");
  ok(all(".kq").length===tap.length,"タップできる欄には「？」の印がついている");
  ok(all(".kx").length===0,"最初は説明が閉じている");
  const t0=all(".kg.tap").filter(e=>e.dataset.x==="A:nenkyu")[0];
  t0.click();
  ok(all(".kx").length===1,"欄をタップすると説明が開く");
  ok($("stage").innerHTML.indexOf("ここを見ると何が分かるか")>=0,"説明に見出しが出る");
  ok($("stage").innerHTML.indexOf("週 1.8日")>=0,"年間休日95日が「週1.8日」に翻訳されて出る");
  all(".kg.tap").filter(e=>e.dataset.x==="A:nenkyu")[0].click();
  ok(all(".kx").length===0,"もう一度タップすると閉じる");
  $("kxAll").click();
  ok(all(".kx").length===E("Object.keys(EXPLAIN).length"),"「説明をすべて開く」で全部開く");
  $("kxAll").click();
  ok(all(".kx").length===0,"もう一度押すと全部閉じる");
  reset();
}

console.log("\n【F】求人の計算と判定");
{
  const j=J("JOBS[0]"), c=J("calcJob(JOBS[0])");
  const teate=j.teate.reduce((s,t)=>s+t.v,0);
  ok(c.month===j.kihon+teate,"毎月の額＝基本給＋定額手当（a＋b）");
  ok(c.bonusYen===Math.round(j.kihon*j.bonus),"賞与は基本給にか月数をかけて出す（手当は含めない）");
  ok(c.year===c.month*12+c.bonusYen,"年収＝毎月の額×12＋賞与");
  ok(c.hours===(365-j.nenkyu)*j.jitsudo+j.ot*12,"年間労働時間＝（365−年間休日）×所定＋残業×12");
  ok(near(c.jikyu,c.year/c.hours,1),"1時間あたり＝年収÷年間労働時間");
  ok(c.t1.jumin===0&&c.t2.jumin>0,"求人ごとの手取りも1年目と2年目で分けて出す");
}
{
  reset(); E("S.car=true;S.pick.gas=2;S.v.gas=15000;");
  const c=J("calcJob(JOBS[0])");
  ok(c.tsukin===10000,"通勤手当は上限までしか戻らない");
  ok(c.jikoFutan===5000,"上限を超えた通勤費は自己負担になる");
  ok(near(c.net2,c.t2.net/12+c.tsukin,1),"使える額＝手取り（月）＋通勤手当で戻る分");
  reset();
}
{
  const A=J("calcJob(JOBS[0])"), Q=J("quizList()");
  ok(Q.length===7,"読み取りの練習が7問ある");
  ok(Q.every(q=>q.o.length===3&&q.a>=0&&q.a<3&&q.ex.length>20),"全問に3択と解説がある");
  ok(Q[0].o[Q[0].a]===E("yen("+A.month+")")+"（基本給＋定額の手当）","Q1の正解が a＋b の計算値と一致する");
  ok(Q[6].o[Q[6].a]===E("yen("+Math.round(A.t2.net/12/1000)*1000+")")+"ぐらい","Q7の正解が2年目の手取りの計算値と一致する");
  ok(Q[1].o[Q[1].a]===E("yen("+A.month+")")+"のまま","Q2の正解は「固定残業代は残業しなくても減らない」");
}
{
  const set=n=>E("S.edited={};ITEMS.forEach(it=>S.v[it.id]=0);S.v.food="+n+";");
  set(0); const n=Math.round(J("verdictOf(JOBS[0])").c.net2);
  set(n-30000); ok(E("verdictOf(JOBS[0]).cls")==="ok","使える額に2万円以上の余りがあれば『余裕がある』");
  set(n-10000); ok(E("verdictOf(JOBS[0]).cls")==="warn","余りが2万円未満なら『ぎりぎり』");
  set(n+10000); ok(E("verdictOf(JOBS[0]).cls")==="ng","足りなければ『足りない』");
  reset();
}
{
  const snap=E("JSON.stringify([S.life,S.car,S.v,S.pick])");
  const home=w.whatIf("home",false);
  ok(E("JSON.stringify([S.life,S.car,S.v,S.pick])")===snap,"『もし〜だったら』の試算をしても選んだものが書き換わらない");
  ok(home<w.outMonth(),"実家・車なしにすると月の支出は減る");
  ok(w.whatIf(E("S.life"),E("S.car"))===w.outMonth(),"同じ条件で試算すると今の支出と一致する");
}
{
  w.go(3);
  const html=$("stage").innerHTML;
  ok(html.indexOf("1時間あたり")>=0&&html.indexOf("年間休日")>=0,"比較画面に1時間あたりと年間休日が出る");
  ok(html.indexOf("何をどれだけ動かせば届くか")>=0,"届かないときの手当て（暮らし方ごとの比較表）が出る");
  const c=[0,1,2].map(i=>J("calcJob(JOBS["+i+"])"));
  ok(c[2].month>c[1].month&&c[1].jikyu>c[2].jikyu,
     "月給が高い求人より、休日が多い求人のほうが1時間あたりは高い（順位が入れ替わる）");
  reset();
}
{
  const dirty=[];
  [true,false].forEach(car=>["alone","home","dorm"].forEach(life=>{
    E("S.life='"+life+"';S.car="+car+";S.edited={};applyDefaults(true);");
    for(let i=0;i<5;i++){ w.go(i);
      const h=$("stage").innerHTML+$("side").innerHTML+$("status").innerHTML;
      ["NaN","undefined","[object Object]","Infinity"].forEach(bad=>{
        if(h.indexOf(bad)>=0) dirty.push(life+(car?"+車":"")+" STEP"+(i+1)+":"+bad); });
    }}));
  ok(dirty.length===0,"どの組み合わせでも NaN・undefined が画面に出ない"+
     (dirty.length?" → "+dirty.slice(0,6).join(" / "):""));
  reset();
}
{
  E("S.edited={};ITEMS.forEach(it=>S.v[it.id]=0);");
  let broke=false; try{ for(let i=0;i<5;i++) w.go(i); }catch(e){ broke=true; }
  ok(!broke&&w.outMonth()===0,"支出を全部0円にしても画面が壊れない");
  reset();
}

console.log("\n【G】サンドボックス耐性");
ok(usedModal.length===0,"ブラウザの confirm / alert に頼っていない"+
   (usedModal.length?"　→ 使われた: "+usedModal.join(" / "):""));
ok(/try\s*\{/.test(w.save.toString())&&/catch/.test(w.save.toString()),"保存は try で包んである（localStorage が使えない環境でも落ちない）");
ok(/try\s*\{/.test(w.load.toString())&&/catch/.test(w.load.toString()),"読み込みも try で包んである");
ok(typeof w.ask==="function"&&typeof w.tell==="function","自前の確認画面 ask / tell を持っている");
{
  w.go(0); $("resetBtn").click();
  ok($("veil").className.indexOf("on")>=0,"『最初に戻す』で自前の確認画面が開く");
  $("mYes").click();
  ok($("veil").className.indexOf("on")<0,"『もどす』を押すと閉じる");
}
ok(d.querySelectorAll("script[src]").length===0&&d.querySelectorAll("link[href]").length===0,
   "外部ファイルを読み込んでいない（単一HTML・通信なし）");

console.log("\n"+(fail===0?"すべて合格":"★ "+fail+" 件 失敗"));
console.log("実行時エラー: "+(errs.length?[...new Set(errs)].join("\n"):"なし"));
process.exit(fail?1:0);
