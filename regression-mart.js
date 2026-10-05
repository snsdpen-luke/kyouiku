/* 翔陽ミニマート（翔陽ミニマート.html）リグレッションテスト
   使い方: npm install jsdom && node regression-mart.js 翔陽ミニマート.html
   画面（Canvas）は jsdom に無いので描けない。計算部分（window.MART）だけを叩く。
   値段や速さを触ったら、必ずこれを通す。【G】が落ちたら「10〜20分で全部建つ」から外れている。 */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const TARGET=process.argv[2]||"翔陽ミニマート.html";
console.log("対象: "+TARGET+"\n");
const src=fs.readFileSync(TARGET,"utf8");
const dom=new JSDOM(src,{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const M=w.MART;
ok(!!M,"window.MART（検証用の窓口）がある");
const DT=1/30;
const run=(g,sec,inp)=>{ for(let i=0;i<Math.round(sec/DT);i++) M.step(g,DT,inp); };
const put=(a,p)=>{ a.x=p.x; a.y=p.y; };          // 瞬間移動（検証用）
const inRect=(p,r)=>p.x>=r[0]&&p.x<=r[0]+r[2]&&p.y>=r[1]&&p.y<=r[1]+r[3];
const overlap=(a,b)=>a[0]<b[0]+b[2]&&b[0]<a[0]+a[2]&&a[1]<b[1]+b[3]&&b[1]<a[1]+a[3];

console.log("【A】定義");
{
  const C=M.COURSES;
  ok(C.length===9,"区画は 9（8コース ＋ 商業のレジ係）");
  ok(new Set(C.map(c=>c.id)).size===9,"id が重複していない");
  ok(C[0].price===0&&C[1].price===0&&C.slice(2).every((c,i,a)=>c.price>0&&(i===0||c.price>a[i-1].price)),"最初の2つは無料、以降は値段が上がっていく");
  ok(C.every(c=>c.name&&c.short&&c.desc),"全区画に名前・略称・説明がある");
  const names=C.map(c=>c.name).join(" ");
  ok(["機械","電気","建築","家庭科","農業園芸","農業食品製造","商業","普通科"].every(n=>names.includes(n)),"翔陽高校の 8コース全部が入っている");
  ok(C.filter(c=>c.kind==="machine").every(c=>M.PRODUCTS[c.in]&&M.PRODUCTS[c.out]&&M.PRODUCT_ORDER.includes(c.out)),"加工の in/out は品物として定義され、out は棚に並ぶ");
  ok(M.PRODUCT_ORDER.every(p=>M.PRODUCTS[p]&&M.PRODUCTS[p].price>0)&&M.PRODUCTS.mat.price===0,"売り物は値段がある。ざいりょうは売らない（0円）");
  ok(M.PRODUCT_ORDER.length===M.SHELF_SLOTS.length,"棚の数と売り物の数が同じ");
  ok(M.PRODUCT_ORDER.every(p=>C.some(c=>c.id===M.PRODUCTS[p].course&&(c.kind==="source"||c.out===p))),"売り物はどれかのコースが作る");
  const rects=C.filter(c=>c.rect).map(c=>c.rect).concat(C.filter(c=>c.yard).map(c=>c.yard));
  ok(rects.every(r=>r[0]>=0&&r[1]>=0&&r[0]+r[2]<=M.WORLD_W&&r[1]+r[3]<=M.WORLD_H),"区画はすべて世界の中");
  ok(rects.every((r,i)=>rects.every((q,j)=>i===j||!overlap(r,q))),"区画どうしが重なっていない");
  const shop=M.COURSE_BY_ID.shop.rect;
  ok(M.SHELF_SLOTS.every(s=>inRect({x:s[0],y:s[1]},shop)),"棚は全部 売店の中");
  ok(inRect(M.REG,shop)&&inRect(M.CASH,shop),"レジとお金の山は売店の中");
  ok(M.QUEUE0.y+M.QUEUE_STEP*M.CUST_MAX<M.GATE.y-60,"会計の列が最大まで伸びても校門にかからない");
  ok(C.every(c=>{const s=M.spotOf(c);return c.rect?inRect(s,c.rect):inRect(s,shop);}),"建設の丸は自分の区画（レジ係は売店）の中");
  ok(!rects.some(r=>inRect(M.GATE,r))&&!rects.some(r=>inRect(M.START,r)),"校門と最初の位置は区画の外（通路）");
  ok(M.SHELF_SLOTS.every(s=>Math.hypot(s[0]-M.REG.x,s[1]+38-M.REG.y)>M.NEAR*1.5),"棚の前に立ってもレジの店員扱いにならない距離");
}

console.log("【B】はじめの状態");
{
  const g=M.newGame(1);
  ok(Object.keys(g.unlocked).sort().join()==="agri,shop","最初は農業園芸と商業だけ");
  ok(g.build&&g.build.course==="food"&&g.build.paid===0,"最初に建てるのは食品製造");
  ok(g.money===0&&g.shelves.veg&&g.shelves.veg.stock===0,"お金 0、やさいの棚は空");
  ok(g.plots.veg.length===6&&g.plots.veg.every(p=>p.grow>=1),"畑は 6区画、最初から収穫できる");
  ok(!g.helper&&!g.reg.cashier,"手伝いもレジ係もいない");
  ok(M.nextCourse(g).id==="food","nextCourse は順番どおり");
  const gt=M.guideTarget(g);
  ok(gt&&gt.label==="収穫","最初の矢印は「収穫」を指す");
}

console.log("【C】拾う・置く・加工");
{
  const g=M.newGame(1); const p=g.player; g.nextCust=1e9;        // お客は来させない（棚の数を数えるため）
  put(p,g.plots.veg[0]); M.step(g,DT);
  ok(p.carry.length===1&&g.plots.veg[0].grow<0.1,"畑に近づくと 1個 収穫し、その区画は空になる（育ち始める）");
  M.step(g,DT);
  ok(p.carry.length===1,"PICK_INTERVAL の間は次を拾わない（連射しない）");
  run(g,2);
  ok(p.carry.length===1,"同じ区画に立ち続けても育つまでは拾えない");
  run(g,M.GROW_TIME+0.2);
  ok(p.carry.length===2,"GROW_TIME 経つと育って また拾える");
  // 畑を全部まわって上限まで
  for(let k=0;k<20&&p.carry.length<M.CARRY_MAX;k++){ for(const pl of g.plots.veg){ put(p,pl); run(g,M.PICK_INTERVAL+0.01);} run(g,M.GROW_TIME); }
  ok(p.carry.length===M.CARRY_MAX,"背負えるのは CARRY_MAX まで");
  put(p,M.shelfPos("veg").front); run(g,3);
  ok(g.shelves.veg.stock===M.SHELF_CAP&&p.carry.length===0,"棚の前に立つと置く。棚は SHELF_CAP まで");
  ok(M.sourceCount(g,"mat")===0,"建築が建つ前は ざいりょう を拾えない");
  put(p,g.plots.mat[0]); run(g,1);
  ok(p.carry.length===0,"資材置き場に立っても建築前は何も起きない");
}
{
  const g=M.newGame(1); const p=g.player;
  M.unlock(g,"food");
  ok(g.machines.food&&g.shelves.jam&&g.build.course==="home","食品製造を建てると加工機とジャムの棚ができ、次は家庭科");
  p.carry=["veg","veg","veg","jam"];
  const mp=M.machinePos("food"); put(p,mp.in); run(g,1);
  const m=g.machines.food;
  ok(m.in+m.out===3&&p.carry.join()==="jam","投入口に立つと やさい だけ入る。ジャムは手に残る");
  ok(m.prog>0||m.out>0,"入れたそばから加工が始まる");
  run(g,M.MACHINE_TIME*3+0.5);
  ok(m.in===0&&m.out===3,"MACHINE_TIME ごとに 1個 加工され、出口に溜まる");
  put(p,mp.out); run(g,2);
  ok(g.machines.food.out===0&&p.carry.filter(x=>x==="jam").length===4,"出口に立つと できた物を拾う");
  put(p,{x:100,y:100}); g.machines.food.in=M.MACHINE_IN_CAP; g.machines.food.out=M.MACHINE_OUT_CAP; run(g,M.MACHINE_TIME*2);
  ok(g.machines.food.in===M.MACHINE_IN_CAP&&g.machines.food.out===M.MACHINE_OUT_CAP,"出口がいっぱいなら加工は止まる（あふれない）");
}

console.log("【D】お客とレジ");
{
  const g=M.newGame(2); const p=g.player;
  g.shelves.veg.stock=8;
  const c=M.spawnCustomer(g);
  ok(c&&c.want==="veg"&&c.qty>=1&&c.qty<=3,"お客は棚にある物を欲しがる（1〜3個）");
  ok(c.x>M.GATE.x-60&&c.x<M.GATE.x+60&&Math.abs(c.y-M.GATE.y)<1,"お客は校門から来る");
  put(p,{x:100,y:100}); g.nextCust=1e9;                          // 自分は遠くに。次のお客は来ない
  run(g,12);
  ok(c.state==="queue"&&g.reg.queue[0]===c&&c.carry.length===c.qty,"棚で品を取り、レジの列に並ぶ");
  ok(g.shelves.veg.stock===8-c.qty,"取ったぶん棚が減る");
  run(g,3);
  ok(g.reg.payProg===0&&c.state==="queue","誰もレジにいないと会計は進まない");
  put(p,M.REG); run(g,M.PAY_TIME+0.3);
  const expect=c.qty*M.PRODUCTS.veg.price;
  ok(c.state==="leave"&&Math.abs(g.reg.cash-expect)<1e-6&&g.sold===c.qty&&g.served===1,"レジのそばに立つと PAY_TIME で会計。お金がレジに積もる");
  ok(g.money===0,"積もったお金はまだ自分の物ではない");
  put(p,M.CASH); M.step(g,DT);
  ok(g.money===expect&&g.reg.cash===0,"お金の山に近づくと全部もらう");
  run(g,8);
  ok(g.customers.length===0,"会計を終えたお客は校門から帰って消える");
}
{
  const g=M.newGame(3); const p=g.player; put(p,{x:100,y:100}); g.nextCust=1e9;
  const c=M.spawnCustomer(g);                                   // 棚は空
  ok(c&&c.want==="veg","棚が空でも最初の数人は来る");
  run(g,M.CUST_PATIENCE+6);
  ok(g.left===1&&c.state==="leave","棚が空のまま CUST_PATIENCE 待つと帰る（left に数える）");
  run(g,8);
  ok(g.customers.length===0,"帰ったお客は消える");
  g.customers=[]; for(let i=0;i<3;i++) g.customers.push({state:"atShelf",x:0,y:0,want:"veg",carry:[],qty:1,wait:0,patience:0,bubbleT:0});
  ok(M.spawnCustomer(g)===null,"空っぽの店に 3人以上の行列は作らない");
  g.customers=[]; for(let i=0;i<M.CUST_MAX;i++) g.customers.push({state:"leave",x:0,y:0,carry:[],bubbleT:0});
  g.shelves.veg.stock=5;
  ok(M.spawnCustomer(g)===null,"お客は CUST_MAX まで");
}
{
  const g=M.newGame(4); const p=g.player; put(p,{x:100,y:100});
  M.unlock(g,"cashier");
  M.step(g,DT);
  ok(g.reg.operator===true,"レジ係がいれば自分が遠くても会計が進む");
  const g2=M.newGame(4); put(g2.player,{x:100,y:100}); M.step(g2,DT);
  ok(g2.reg.operator===false,"レジ係がいなくて自分も遠ければ会計は止まる");
}
{
  const g=M.newGame(5);
  ok(g.nextCust<=3,"最初のお客は 3秒以内に来る（客がいないと何をする店か分からない）");
  const a=M.newGame(5); a.unlocked.gen=true; let fast=0,slow=0;
  for(let i=0;i<50;i++){ a.nextCust=0; M.step(a,DT); fast+=a.nextCust; }
  const b=M.newGame(5); for(let i=0;i<50;i++){ b.nextCust=0; M.step(b,DT); slow+=b.nextCust; }
  ok(fast<slow*0.75,"普通科を建てるとお客の来る間隔が短くなる");
}

console.log("【E】建てる");
{
  const g=M.newGame(1); const p=g.player;
  const spot=M.spotOf(M.COURSE_BY_ID.food);
  put(p,spot); g.money=10; run(g,0.2);
  const rate=Math.max(M.BUILD_MIN_RATE,M.COURSE_BY_ID.food.price/3);
  ok(g.build.paid>0&&g.build.paid<=10+1e-6&&Math.abs(g.build.paid-Math.min(10,rate*0.2))<rate*DT*2,"丸に立つとお金が BUILD 速度で流れ込む");
  run(g,2);
  ok(Math.abs(g.build.paid-10)<1e-6&&g.money<1e-6,"持っているお金が尽きたら止まる（借金しない）");
  put(p,M.spotOf(M.COURSE_BY_ID.home)); g.money=1000; run(g,2);
  ok(!g.unlocked.home&&g.money===1000,"順番を飛ばして次の次は建てられない");
  put(p,spot); let shown=false; for(let i=0;i<120&&!g.unlocked.food;i++){ M.step(g,DT); if(g.floats.some(f=>f.s.includes("完成"))) shown=true; }
  ok(g.unlocked.food&&g.build.course==="home"&&g.build.paid===0,"払いきると建つ。次の建設に切り替わる");
  ok(Math.abs(g.money-(1000-(M.COURSE_BY_ID.food.price-10)))<1e-6,"払ったぶんだけ減る（払いすぎない）");
  ok(shown,"「完成！」の文字が出る");
}
{
  const g=M.newGame(1);
  for(const id of ["food","home"]) M.unlock(g,id);
  M.unlock(g,"gen");
  ok(g.helper&&g.helper.carry.length===0,"普通科を建てると手伝いの生徒が来る");
  ok(inRect(g.helper,M.COURSE_BY_ID.gen.rect),"手伝いは本部に現れる");
  for(const id of ["arch","mech","elec"]) M.unlock(g,id);
  ok(M.sourceCount(g,"mat")===6,"建築が建つと資材置き場から ざいりょう を拾える");
  ok(!g.complete&&g.build.course==="cashier","8コースが建っても レジ係 が残っていれば未完成");
  M.unlock(g,"cashier");
  ok(g.complete&&g.build===null&&g.reg.cashier,"全部建つと complete。建設の丸は消える");
}
{
  const g=M.newGame(6); M.unlock(g,"food"); M.unlock(g,"home"); M.unlock(g,"gen");
  const h=g.helper; g.shelves.veg.stock=0;
  run(g,40);
  ok(g.shelves.veg.stock>0||g.machines.food.in>0||g.machines.home.in>0||h.carry.length>0,"手伝いは勝手に 畑→棚 や 畑→加工機 を運ぶ");
  ok(h.x>=20&&h.x<=M.WORLD_W-20&&h.y>=20&&h.y<=M.WORLD_H-20,"手伝いは世界の外に出ない");
}

console.log("【F】保存と復元");
{
  const g=M.newGame(1); M.unlock(g,"food"); M.unlock(g,"home");
  g.money=123.7; g.shelves.veg.stock=5; g.shelves.jam.stock=2; g.machines.food.in=3; g.machines.food.out=4; g.build.paid=40.9;
  g.player.carry=["veg","jam"]; g.reg.cash=17.2; g.sold=9; g.revenue=70; g.served=4; g.player.x=500; g.player.y=900;
  const s=M.serialize(g); const r=M.restore(JSON.parse(JSON.stringify(s)));
  ok(Object.keys(r.unlocked).sort().join()==="agri,food,home,shop","建った区画が戻る");
  ok(r.money===123&&r.shelves.veg.stock===5&&r.shelves.jam.stock===2,"お金（整数）と棚が戻る");
  ok(r.machines.food.in===3&&r.machines.food.out===4,"加工機の中身が戻る");
  ok(r.build.course==="gen"&&r.build.paid===40,"建設の途中経過が戻る");
  ok(r.player.carry.join()==="veg,jam"&&r.player.x===500&&r.player.y===900,"手荷物と立ち位置が戻る");
  ok(r.reg.cash===17&&r.sold===9&&r.revenue===70&&r.served===4,"レジのお金と成績が戻る");
  ok(!r.helper&&!r.reg.cashier,"普通科・レジ係が未建設なら手伝いもレジ係もいない");
  const g2=M.newGame(1); for(const id of ["food","home","gen","arch","mech","elec","cashier"]) M.unlock(g2,id);
  const r2=M.restore(JSON.parse(JSON.stringify(M.serialize(g2))));
  ok(r2.helper&&r2.reg.cashier&&r2.complete&&r2.build===null,"全部建った状態も戻る（手伝い・レジ係・完成）");
  const bad=M.restore({ver:1,unlocked:["shop","agri","food"],shelves:{veg:99,jam:-5},machines:{food:[99,99]},build:{course:"home",paid:99999},carry:["veg","nope"]});
  ok(bad.shelves.veg.stock===M.SHELF_CAP&&bad.shelves.jam.stock===0&&bad.machines.food.in===M.MACHINE_IN_CAP&&bad.build.paid===M.COURSE_BY_ID.home.price&&bad.player.carry.join()==="veg","壊れた保存データも上限に丸めて読む");
  ok(M.restore(null).money===0&&M.restore({ver:99}).money===0,"保存が無い／版が違うなら最初から");
}

console.log("【G】バランス（自動操縦で全部建つまで）");
function auto(seed){
  const g=M.newGame(seed); g.auto=true; const marks={};
  while(g.t<1800&&!g.complete){ M.step(g,DT); for(const id in g.unlocked) if(!(id in marks)) marks[id]=g.t; }
  return {g,marks};
}
{
  const first=[],total=[],leftRate=[];
  for(const seed of [1,2,3]){
    const {g,marks}=auto(seed);
    first.push(marks.food); total.push(g.completeAt); leftRate.push(g.left/Math.max(1,g.served+g.left));
    console.log("    seed "+seed+": 食品製造 "+Math.round(marks.food)+"秒 / 完成 "+(g.complete?Math.round(g.completeAt/60)+"分"+Math.round(g.completeAt%60)+"秒":"未完成")+" / 売上 ¥"+g.revenue+" / 帰った客 "+g.left+"/"+(g.served+g.left));
    ok(g.complete,"seed "+seed+": 30分以内に全部建つ（詰まない）");
  }
  ok(first.every(t=>t<=120),"最初の区画（食品製造）は 2分以内に建つ（立ち止まった来校者にも「建った」を見せる）");
  ok(total.every(t=>t>=480&&t<=1200),"自動操縦の完成は 8〜20分（人はこれより少し遅い。10〜20分の狙い）");
  ok(leftRate.every(r=>r<0.15),"棚が空で帰る客は 15% 未満");
}
{
  const g=M.newGame(9); g.auto=true;
  run(g,20); const t0=g.t;
  M.step(g,10);
  ok(Math.abs(g.t-t0-0.05)<1e-9,"dt は 0.05 秒で頭打ち（タブを切り替えて戻ってもワープしない）");
  run(g,30);
  const p=g.player;
  ok(p.x>=20&&p.x<=M.WORLD_W-20&&p.y>=20&&p.y<=M.WORLD_H-20,"自分は世界の外に出ない");
  ok(g.customers.every(c=>c.x>=20&&c.x<=M.WORLD_W-20&&c.y>=20&&c.y<=M.WORLD_H-20),"お客も世界の外に出ない");
}

console.log("\n【エラー】");
ok(errs.length===0,"読み込みと計算中に JavaScript エラーが出ていない"+(errs.length?"：\n    "+errs.join("\n    "):""));

console.log(fail===0?"\nすべて合格":"\n"+fail+" 件 失敗");
process.exit(fail===0?0:1);
