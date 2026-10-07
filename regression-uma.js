/* 翔陽ダービー（馬レース.html）リグレッションテスト
   使い方: npm install jsdom && node regression-uma.js 馬レース.html
   画面（Canvas）は jsdom に無いので描けない。計算部分（window.UMA）だけを叩く。
   文化祭当日に数値を触ったら、必ずこれを通す。 */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const TARGET=process.argv[2]||"馬レース.html";
console.log("対象: "+TARGET+"\n");
const src=fs.readFileSync(TARGET,"utf8");
const dom=new JSDOM(src,{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc});
const w=dom.window;
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const U=w.UMA;
ok(!!U,"window.UMA（検証用の窓口）がある");

/* 自分の馬を機械的に走らせる。hz: 左右交互タップの速さ、jump: 障害物の手前で跳ぶか */
function run(hz,jump,seed,dmin,dmax){
  dmin=dmin==null?30:dmin; dmax=dmax==null?80:dmax;
  const g=U.newRace(seed); let side="L",nextTap=0,ms=0;
  while(!g.over){ const dt=1/60; ms+=dt*1000;
    if(hz>0&&ms>=nextTap){ U.applyTap(g,side,ms); side=side==="L"?"R":"L"; nextTap+=1000/hz; }
    if(jump) for(const o of U.OBSTACLES){ const d=o.x-g.player.x; if(d>dmin&&d<dmax) U.applyJump(g); }
    U.step(g,dt); }
  return g;
}

console.log("【A】コースの定義");
ok(U.SECTIONS[0].from===0&&U.SECTIONS[U.SECTIONS.length-1].to===U.COURSE_LEN,"区間は 0 からゴールまで");
ok(U.SECTIONS.every((s,i)=>i===0||s.from===U.SECTIONS[i-1].to),"区間に隙間も重なりもない");
ok(U.OBSTACLES.every(o=>o.x>600),"最初の 600px に障害物はない（操作を覚える猶予）");
ok(U.OBSTACLES.every((o,i)=>i===0||o.x-U.OBSTACLES[i-1].x>=300),"障害物の間隔は 300px 以上（連続で跳ばされない）");
ok(U.OBSTACLES.every(o=>o.x+o.w<U.COURSE_LEN-500),"ゴール直前 500px に障害物はない");
const gaps=U.OBSTACLES.filter(o=>o.type==="gap");
ok(gaps.length===1&&U.sectionAt(gaps[0].x).id==="sky","中庭の穴は「大ジャンプ」区間に1つだけ");
ok(U.OBSTACLES.filter(o=>o.type==="teacher").every(o=>o.h<=60),"先生の高さは跳び越えられる範囲（60以下）");
ok(U.HORSES.length===4&&U.HORSES.filter(h=>!h.cpu).length===1,"馬は4頭、自分は1頭");
ok(!U.HORSES[U.PLAYER_LANE].cpu,"PLAYER_LANE 番目の馬が自分（描画のレーンと一致）");
ok(U.HORSES.every(h=>h.name&&h.short&&h.color),"全馬に名前・略称・色がある");

console.log("【B】タップの計算");
{
  const g=U.newRace(1); const p=g.player; const v0=p.v;
  ok(U.applyTap(g,"L",1000)==="ok"&&p.v>v0,"最初のタップで加速する");
  const v1=p.v;
  ok(U.applyTap(g,"L",1300)==="same"&&p.v===v1,"同じ側を2回は加速しない（足がもつれる）");
  ok(U.applyTap(g,"R",1340)==="spam"&&p.v===v1,"70ms 未満の連打は無視");
  ok(U.applyTap(g,"R",1550)==="good"&&p.v>v1,"交互・良い間隔なら good");
  U.applyTap(g,"L",3000);
  ok(U.applyTap(g,"R",3800)==="ok","間隔が開きすぎる（800ms）と good ではない");
  for(let i=0;i<40;i++) U.applyTap(g,i%2?"R":"L",4000+i*200);
  ok(p.v===U.V_MAX,"連打しても V_MAX で頭打ち");
  ok(g.taps>0&&g.goodTaps>0&&g.wrongSide===1,"タップ数・良いタップ数・同側ミスを数えている");
}
{
  const g=U.newRace(1); const p=g.player;
  for(let i=0;i<120;i++) U.step(g,1/60);
  ok(Math.abs(p.v-U.V_MIN)<1e-6&&p.x>0,"何もしなくても V_MIN で前に進む（止まって詰まない）");
  U.applyTap(g,"L",0); U.applyTap(g,"R",250); const vb=p.v;
  for(let i=0;i<60;i++) U.step(g,1/60);
  ok(p.v<vb&&p.v>U.V_MIN,"タップをやめると減速するが V_MIN より下がらない");
}

console.log("【C】ジャンプと障害物");
{
  const g=U.newRace(1); const p=g.player;
  ok(U.applyJump(g)===true&&p.vy>0,"地上ならジャンプできる");
  ok(U.applyJump(g)===false,"空中では二段ジャンプできない");
  let maxY=0; for(let i=0;i<90;i++){ U.step(g,1/60); maxY=Math.max(maxY,p.y); }
  ok(p.y===0&&maxY>110&&maxY<140,"放物線で戻る。最高点は 110〜140px（机40・ワゴン55・先生58 を越える）");
}
{
  const g=run(0,false,1); const p=g.player;
  ok(p.hits>0,"タップせず跳ばなければ障害物に当たる");
  ok(g.t>=U.TIME_CAP-0.1&&g.over&&g.result.rank===4,"何もしないと "+U.TIME_CAP+" 秒で強制終了、4位");
  ok(g.result.time==null&&g.result.title.length>0,"未完走でもタイムは無し・称号はある");
}
{
  const g=U.newRace(1); const p=g.player; const t=U.OBSTACLES.find(o=>o.type==="teacher");
  p.x=t.x-20; p.v=300; for(let i=0;i<8;i++) U.step(g,1/60);
  ok(p.stop>1.5&&p.stopWhy==="teacher"&&g.msg&&/廊下/.test(g.msg.text),"先生にぶつかると「廊下は走らない！」で止まる");
  const x0=p.x; U.step(g,0.05);
  ok(p.x===x0&&U.applyTap(g,"L",99999)==="stopped","説教中は進まず、タップも効かない");
  for(let i=0;i<130;i++) U.step(g,1/60);
  ok(p.stop===0&&p.x>x0,"2秒たつと走り出す");
}
{
  const g=U.newRace(1); const p=g.player; const d=U.OBSTACLES.find(o=>o.type==="desk");
  p.x=d.x-20; p.v=400; for(let i=0;i<6;i++) U.step(g,1/60);
  ok(p.v<400*0.5&&p.hits===1&&p.stop===0,"机にぶつかると速度が半分以下になる（止まらない）");
}
{
  const g=U.newRace(1); const p=g.player; const gp=gaps[0];
  p.x=gp.x-5; p.v=300; for(let i=0;i<10;i++) U.step(g,1/60);
  ok(p.falls===1&&p.stopWhy==="fall"&&p.x>gp.x+gp.w,"跳ばずに穴へ行くと落ちて、向こう岸に這い上がる");
}
{
  const g=U.newRace(1); const p=g.player; const gp=gaps[0];
  p.x=gp.x-40; p.v=300; U.applyJump(g); for(let i=0;i<60;i++) U.step(g,1/60);
  ok(p.falls===0&&p.x>gp.x+gp.w,"速度 300 で手前 40px から跳べば穴を越える");
}
{
  const g=U.newRace(1); const p=g.player; const d=U.OBSTACLES.find(o=>o.type==="wagon");
  p.x=d.x-60; p.v=350; U.applyJump(g); for(let i=0;i<60;i++) U.step(g,1/60);
  ok(p.hits===0,"ワゴンの手前 60px・速度 350 で跳べば越える");
  const g2=U.newRace(1); const p2=g2.player;
  p2.x=d.x-20; p2.v=350; U.applyJump(g2); for(let i=0;i<60;i++) U.step(g2,1/60);
  ok(p2.hits===0,"ワゴンの手前 20px でも越える（上昇中はぶつからない）");
  const g3=U.newRace(1); const p3=g3.player;
  p3.x=d.x-20; p3.v=U.V_MIN; U.applyJump(g3); for(let i=0;i<80;i++) U.step(g3,1/60);
  ok(p3.hits===1,"速度が遅すぎると、ワゴンの上に落ちて当たる");
}
{
  const g=run(4,true,1);
  ok(g.player.hits===0&&g.player.falls===0,"手前 30〜80px で毎回跳べば無傷で完走");
}

console.log("【D】レース全体のバランス（文化祭で遊べる難しさか）");
const times=(hz,jump,dmin,dmax)=>[1,2,3].map(s=>run(hz,jump,s,dmin,dmax));
{
  const rs=times(3,true);
  ok(rs.every(g=>g.result.rank===1&&g.result.time<52),"3Hz交互＋完璧ジャンプ → 1位（52秒以内）: "+rs.map(g=>U.fmtTime(g.result.time)).join(" "));
  const rs2=times(3,false);
  ok(rs2.every(g=>g.result.rank>=3),"3Hz交互でジャンプしない → 3位以下（跳ぶことに意味がある）: "+rs2.map(g=>g.result.rank+"位 "+U.fmtTime(g.result.time)).join(" "));
  const rs3=times(4,false);
  ok(rs3.every(g=>g.result.rank>=2),"4Hz交互でジャンプしない → 1位は取れない: "+rs3.map(g=>g.result.rank+"位").join(" "));
  const rs4=times(2,true);
  ok(rs4.every(g=>g.result.time!=null&&g.result.time>55&&g.result.rank>=3),"2Hzのゆっくりタップでも完走できる。ただし55秒より遅く3位以下: "+rs4.map(g=>U.fmtTime(g.result.time)).join(" "));
}
{
  const g=run(4,true,1);
  const cpu=g.horses.filter(h=>h.cpu);
  ok(cpu.every(h=>h.finish!=null&&h.finish>40&&h.finish<62),"CPU は全頭 40〜62 秒でゴール: "+cpu.map(h=>h.short+" "+U.fmtTime(h.finish)).join(", "));
  const fs_=cpu.map(h=>h.finish).sort((a,b)=>a-b);
  ok(fs_[2]-fs_[0]>3,"CPU どうしの差が 3 秒以上ある（ゴール付近で順位が動く）");
  const g2=run(4,true,2); const g3=run(4,true,3);
  ok(cpu.map(h=>h.finish).join()!==g2.horses.filter(h=>h.cpu).map(h=>h.finish).join(),"種が違えば CPU の展開も変わる");
  ok(g2.result.time===g.result.time,"自分の走りは種に左右されない（タップと障害物だけで決まる）");
  void g3;
}
{
  const g=run(4,true,1); const r=g.result;
  ok(r.order.length===4&&r.order[0]===g.player&&r.rank===1,"着順表は4頭、1着が自分");
  ok(r.order.every((h,i)=>i===0||(h.finish==null?Infinity:h.finish)>=(r.order[i-1].finish==null?Infinity:r.order[i-1].finish)),"着順表はタイム順");
  ok(["翔陽の韋駄天","校舎の風"].includes(r.title),"1位の称号");
  ok(U.titleFor(2,55,0)==="惜しい！ハナ差"&&U.titleFor(3,60,2)==="廊下の名手"&&U.titleFor(4,null,0)==="マイペースな馬","2位・3位・未完走の称号");
}
ok(U.fmtTime(65.5)==="1:05.50"&&U.fmtTime(null)==="--:--.--"&&U.fmtTime(3.2)==="0:03.20","タイムの表示");

console.log("【E】時間の扱い");
{
  const g=U.newRace(1); U.step(g,2.0);
  ok(Math.abs(g.t-0.05)<1e-9,"タブ切替などで dt が大きくても 0.05 秒に抑える（ワープしない）");
  const g2=U.newRace(1); g2.over=true; const x=g2.player.x; U.step(g2,1/60);
  ok(g2.player.x===x&&U.applyTap(g2,"L",0)==="over"&&U.applyJump(g2)===false,"終了後は進まず、入力も効かない");
}
{
  const g=U.newRace(1); g.player.x=U.COURSE_LEN-1; g.player.v=300; U.step(g,1/60);
  ok(g.over&&g.result&&g.result.time!=null&&g.horses.filter(h=>h.cpu).every(h=>h.finish!=null||g.t>=U.TIME_CAP),
     "自分がゴールすると、残りの CPU の着順を先回りで確定する");
}

console.log("【F】配布物としての性質");
ok(!/<script[^>]+src=|<link[^>]+href=|<img[^>]+src=/.test(src),"外部ファイルを読み込んでいない（単一HTML・通信なし）");
ok(/color-scheme:\s*light/.test(src),"ダークモードの端末でも色が変わらない");
ok(/touch-action:\s*none/.test(src)&&/overscroll-behavior:\s*none/.test(src),"スワイプがブラウザの「引っ張って更新」にならない");
ok(/user-scalable=no/.test(src),"連打でズームしない");
ok(/VER\s*=\s*"\d{4}-\d{2}-\d{2}[a-z]?"/.test(src),"版の表示がある");
ok(/翔陽/.test(src)&&/文化祭/.test(src),"校名と文化祭の表記がある");
ok(/keydown/.test(src)&&/"f"/.test(src)&&/"j"/.test(src),"パソコン用のキー操作（F/J）がある");
ok(/vibrate/.test(src),"振動（対応端末のみ）");
ok(/try\s*\{\s*localStorage/.test(src.replace(/\s+/g," "))||/try \{ const v = localStorage/.test(src),"自己ベストの保存は失敗しても落ちない（try）");

console.log("\n"+(fail===0?"すべて合格":"★ "+fail+" 件 失敗"));
console.log("実行時エラー: "+(errs.length?[...new Set(errs)].join("\n"):"なし"));
process.exit(fail?1:0);
