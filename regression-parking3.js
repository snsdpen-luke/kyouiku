/* 自動運転への階段（自動運転への階段.html → parking3/）リグレッションテスト
   使い方: node regression-parking3.js 自動運転への階段.html
   画面（Canvas・まわりの車）は使わず、車の計算部分（<script> の前半）だけを読み込んで走らせる。
   まわりの車・歩行者がいない駐車場で、毎回ちがう条件（枠の幅・柱・となりの寄り・夜）を 40 通り試す。 */
const fs=require("fs");
const TARGET=process.argv[2]||"自動運転への階段.html";
console.log("対象: "+TARGET+"\n");
const src=fs.readFileSync(TARGET,"utf8");
const js=src.slice(src.indexOf("<script>")+8,src.indexOf("(()=>{"));
const location={search:""};
eval(js+";globalThis.__S={physStep,makeWorldC,randomCond,judge,demoDriveC,landX,AP_BASE,WMAX,lvOf};");
const S=globalThis.__S;
let fail=0;const ok=(c,msg)=>{if(!c){fail++;console.log("  ✗ "+msg);}else console.log("  ✓ "+msg);};
const N=40;
function conds(){let seed=12345;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};const a=[];for(let k=0;k<N;k++)a.push(S.randomCond(rnd));return a;}
// LV：レベル、p：車のコンピュータの数字、bot：レベル3でハンドルを回す「生徒のかわり」
function drive(cd,LV,p0,bot){const W=S.makeWorldC(cd);W.dyn=[];
 const p=Object.assign({vf:4/3.6,vt:2/3.6,kp:1,stop:0.45,corner:0.3,mA:0,ks:1},p0||{});
 const m={s:{x:0,y:cd.y0,th:0,d:0},c:{v:0,F:0,meas:0,mt:0},gear:"P",wheel:0,brake:false,acc:false,mode:"lv"+LV,p,hold:false};
 let t=0;const shifts=[];
 while(t<90){const r=S.physStep(m,W,0.05);t+=0.05;if(r.shift)shifts.push(r.shift.g);if(bot)bot(m);
  if(r.crash)return {res:"crash",t,shifts};
  if(m.gear==="P"&&m.c.v===0&&m.ap&&m.ap.ph==="park"){const j=S.judge(W,m.s);return {res:j.ok?"ok":j.t,t,shifts};}}
 return {res:"timeout",t,shifts};}
const count=(rs)=>rs.filter(r=>r.res==="ok").length;

console.log("【A】レベル1・2（前からある部分）が動く");
ok(S.lvOf("lv1")===1&&S.lvOf("lv2")===2&&S.lvOf("manual")===0,"レベルの読み取り（lv1→1, lv2→2, manual→0）");
{let seed=7;const rnd=()=>{seed=(seed*16807)%2147483647;return (seed-1)/2147483646;};let okN=0;
 for(let k=0;k<10;k++){const cd=S.randomCond(rnd);cd.cars=0;cd.peds=0;if(S.demoDriveC(cd,rnd))okN++;}
 ok(okN>=7,`見本の手動運転（②の見本データ）が駐車できる：10 回中 ${okN} 回`);}
{const cd=conds()[0];const W=S.makeWorldC(cd);W.dyn=[];const m={s:{x:0,y:cd.y0,th:0,d:0},c:{v:0,F:0,meas:0,mt:0},gear:"P",wheel:0,brake:false,acc:false,mode:"lv2",p:{vf:4/3.6,vt:2/3.6,kp:1,stop:0.45,corner:0.3},hold:false};
 for(let i=0;i<100;i++)S.physStep(m,W,0.05);ok(m.gear==="P"&&!m.ap,"レベル2では、車はシフトを変えない（P のまま）");
 m.gear="D";for(let i=0;i<100;i++)S.physStep(m,W,0.05);ok(m.c.v>0.1&&m.wheel===0,"レベル2：D に入れるとアクセルは車が踏み、ハンドルは動かさない");}

console.log("\n【B】レベル4：アクセル・ブレーキ・シフト・ハンドルを全部車が操作して駐車できる");
{const rs=conds().map(cd=>drive(cd,4));const n=count(rs);
 ok(n===N,`仮の数字のまま：${N} 通り中 ${n} 回成功`);
 ok(rs.filter(r=>r.res==="ok").every(r=>r.shifts.join("")==="DRP"),"成功した回のシフトは D → R → P の順");}
{const rs=conds().map(cd=>drive(cd,4,{mA:-0.6}));ok(count(rs)>=N*0.9,`切り返す位置が手前すぎても（−0.6m）、車が気づいて前に出直す：${count(rs)}/${N}`);}
{const rs=conds().map(cd=>drive(cd,4,{mA:1.0}));ok(count(rs)>=N*0.9,`切り返す位置が先すぎても（+1.0m）、まっすぐ下がってから曲がる：${count(rs)}/${N}`);}
{const rs=conds().map(cd=>drive(cd,4,{kp:4,vt:2/3.6}));ok(count(rs)>=N*0.9,`アクセルの直す強さ 4（速く走る）：${count(rs)}/${N}`);}
{const rs=conds().map(cd=>drive(cd,4,{ks:0.2}));ok(count(rs)<N,`ハンドルの直す強さを 0.2 に弱めると、失敗する回が出る（調整の意味がある）：成功 ${count(rs)}/${N}`);}

console.log("\n【C】レベル3：シフトは車、ハンドルは人");
{const rs=conds().map(cd=>drive(cd,3));ok(count(rs)===0,"ハンドルを回さないと駐車できない（車はハンドルを回さない）");}
{// 上手な人のかわり：レベル4 と同じ考え方で人がハンドルを回す
 const bot=m=>{const a=m.ap;if(!a||!a.cam||a.ph==="start")return;let tw;
  if(a.ph==="fwd")tw=Math.max(-1,Math.min(1,-(a.cam.y-S.AP_BASE.lane)*1.4-a.cam.th*4))*S.WMAX;
  else{if(a.ph==="stop1"&&m.c.v>0)m.bsub="";const landing=S.landX(a.cam);if(m.bsub!=="straight"&&a.cam.th<Math.PI/2-0.03)tw=landing>0.15?0:-S.WMAX;else{m.bsub="straight";const thd=Math.PI/2-Math.max(-0.35,Math.min(0.35,2.5*a.cam.offR));tw=Math.max(-1,Math.min(1,2*(a.cam.th-thd)))*S.WMAX;}}
  m.wheel+=Math.max(-36,Math.min(36,tw-m.wheel));};
 const rs=conds().map(cd=>drive(cd,3,{},bot));ok(count(rs)>=N*0.9,`人が上手にハンドルを回せば、車がシフトを変えて駐車できる：${count(rs)}/${N}`);
 ok(rs.filter(r=>r.res==="ok").every(r=>r.shifts[0]==="D"&&r.shifts.includes("R")&&r.shifts[r.shifts.length-1]==="P"),"シフトは車が D → R → P と入れる");}

console.log("\n"+(fail?`✗ ${fail} 項目が不合格`:"全項目合格"));
process.exit(fail?1:0);
