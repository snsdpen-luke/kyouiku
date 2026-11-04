/* お化け屋敷サンプラー（お化け屋敷サンプラー.html）リグレッションテスト
   使い方: npm install jsdom && node regression-obake.js お化け屋敷サンプラー.html
   jsdom には音（Web Audio）が無い。音の合成（window.OBAKE）と画面の骨組みだけを叩く。
   聞こえ方（こわいかどうか）は実機で確かめること。 */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const TARGET=process.argv[2]||"お化け屋敷サンプラー.html";
console.log("対象: "+TARGET+"\n");
const src=fs.readFileSync(TARGET,"utf8");
const dom=new JSDOM(src,{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"https://example.org/"});
const w=dom.window, d=w.document;
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const S=w.OBAKE;
ok(!!S,"window.OBAKE（検証用の窓口）がある");
ok(!/createConvolver|createDelay/.test(src)&&!d.getElementById("mRev"),"エコー・残響をかけていない（剛さんの指定）");
ok(!/\bconfirm\(|\balert\(/.test(src),"confirm / alert を使っていない（Classroom のサンドボックスで動かない）");

console.log("【A】パッド・BGM・キー");
ok(S.PADS.length===16&&new Set(S.PADS.map(p=>p.id)).size===16,"効果音は16個・id の重複なし");
ok(S.PADS.every(p=>typeof S.SYNTH[p.id]==="function"),"どの効果音にも合成の関数がある");
ok(S.BGMS.length===5&&S.BGMS.filter(b=>!b.file).every(b=>typeof S.BGM_SYNTH[b.id]==="function"),"BGM は5つ・動画の BGM 以外には合成の関数がある");
{ const raw=Buffer.from(S.BED_WAV,"base64");
  ok(S.BGMS[0].id==="bed"&&S.BGMS[0].file&&raw.slice(0,4).toString()==="RIFF"&&raw.slice(8,12).toString()==="WAVE","1番目の BGM は廃校徘徊の動画の BGM（WAV）");
  const sr=raw.readUInt32LE(24), ch=raw.readUInt16LE(22), bits=raw.readUInt16LE(34), sec=(raw.length-44)/(sr*ch*bits/8);
  ok(sec>8&&sec<12,"動画の BGM は約"+sec.toFixed(1)+"秒（"+sr+"Hz）でくり返す");
  const a=raw.readInt16LE(44)/32768, z=raw.readInt16LE(raw.length-2)/32768;
  ok(Math.abs(a-z)<.1,"動画の BGM のつなぎ目に大きな段差がない（"+Math.abs(a-z).toFixed(3)+"）"); }
ok(S.MAX_VOICES>=4&&S.MAX_VOICES<=8,"同時に鳴らす効果音に上限がある（"+S.MAX_VOICES+"）");
ok(S.PADS.every(p=>p.kind==="a"||p.kind==="s")&&S.PADS.some(p=>p.kind==="s"&&p.auto)&&S.PADS.some(p=>p.kind==="a"&&p.auto),"効果音は「気配」と「不意打ち」に分かれ、どちらにも★の音がある");
ok(new Set([...S.KEYS,...S.BGM_KEYS]).size===21&&[...S.KEYS,...S.BGM_KEYS].every(k=>/^(Digit|Key)/.test(k)),"キーは21個・重複なし・e.code で指定");
ok(d.querySelectorAll(".pad").length===16,"画面にパッドが16個");
ok(d.querySelectorAll(".bgm").length===5,"画面に BGM が5つ");
ok(d.querySelector("h1").textContent==="廃校徘徊"&&d.title==="廃校徘徊 サンプラー","題は「廃校徘徊」");
ok([...d.querySelectorAll(".pad .ky")].map(e=>e.textContent).join("")==="1234QWERASDFZXCV","パッドのキーの文字が正しい");
ok(/版 \d{4}-\d{2}-\d{2}[a-z]?/.test(d.getElementById("ver").textContent),"版表示が出ている");

console.log("【B】効果音の合成（48kHz と 44.1kHz）");
const finite=x=>{ for(const v of x) if(!Number.isFinite(v)) return false; return true; };
for(const sr of [48000,44100]){
  for(const p of S.PADS){
    const bad=[];
    for(let v=0;v<S.NVAR;v++){
      const x=S.renderPad(p.id,sr,v), pk=S.peakOf(x), sec=x.length/sr;
      if(!finite(x)) bad.push("v"+v+" NaN/∞");
      if(!(pk>0.85&&pk<=0.9001)) bad.push("v"+v+" ピーク "+pk.toFixed(3));
      if(!(sec>=0.3&&sec<=8)) bad.push("v"+v+" 長さ "+sec.toFixed(2)+"秒");
      if(Math.abs(x[0])>1e-3||Math.abs(x[x.length-1])>1e-3) bad.push("v"+v+" 頭かお尻がゼロでない（プツッと鳴る）");
    }
    ok(bad.length===0,p.id+"@"+sr+"（"+S.NVAR+"通り）"+(bad.length?"  "+bad.join(" / "):""));
  }
}
{ const a=S.renderPad("bangHard",48000,1), b=S.renderPad("bangHard",48000,1), c=S.renderPad("bangHard",48000,2);
  ok(a.every((v,i)=>v===b[i]),"同じ番号の波形は毎回まったく同じ（乱数の種が固定）");
  ok(a.length!==c.length||a.some((v,i)=>v!==c[i]),"番号がちがえば波形もちがう（くり返しが単調にならない）"); }
/* 声の高さ（自己相関でいちばん似ている周期をさがす） */
function pitchOf(x,sr,from,to){
  const a=Math.round(from*sr), n=Math.round((to-from)*sr), lo=Math.round(sr/1500), hi=Math.round(sr/80);
  let best=0, bl=lo;
  for(let L=lo;L<=hi;L++){ let s=0,e1=0,e2=0; for(let i=a;i<a+n;i++){ s+=x[i]*x[i+L]; e1+=x[i]*x[i]; e2+=x[i+L]*x[i+L]; }
    const r=s/Math.sqrt(e1*e2+1e-12); if(r>best){ best=r; bl=L; } }
  return sr/bl; }
{ const sr=48000, m=S.renderPad("moanLow",sr,0), sc=S.renderPad("scream",sr,0);
  const fm=pitchOf(m,sr,1.4,1.6), fs=pitchOf(sc,sr,.6,.8);
  ok(fm>150&&fm<300,"うめき声（ひくい）は女の低い声の高さ（"+Math.round(fm)+" Hz）");
  ok(fs>800,"悲鳴は高い（"+Math.round(fs)+" Hz）"); }
{ const zc=x=>{let n=0;for(let i=1;i<x.length;i++) if((x[i-1]<0)!==(x[i]<0)) n++; return n/(x.length/48000);};
  const k=S.renderPad("knock3",48000,0), g=S.renderPad("glass",48000,0);
  ok(zc(k)<1500,"ドン・ドン・ドンは低い音（ゼロ交差 "+Math.round(zc(k))+"回/秒）");
  ok(zc(g)>3000,"ガラスは高い音（ゼロ交差 "+Math.round(zc(g))+"回/秒）"); }
{ /* ドアをたたく音は、たたいた数だけ山がある */
  const sr=48000, x=S.renderPad("bangHard",sr,0), win=Math.round(sr*.01), e=[];
  for(let i=0;i+win<x.length;i+=win){ let s=0; for(let k=i;k<i+win;k++) s=Math.max(s,Math.abs(x[k])); e.push(s); }
  let hits=0, up=false; for(const v of e){ if(!up&&v>.3){ hits++; up=true; } else if(up&&v<.12) up=false; }
  ok(hits>=10,"ドアをはげしくたたく：10回以上たたいている（"+hits+"回）"); }

console.log("【C】BGM（くり返しのつなぎ目）");
for(const sr of [48000,44100]){
  for(const b of S.BGMS.filter(b=>!b.file)){
    const x=S.renderBgm(b.id,sr), sec=x.length/sr, pk=S.peakOf(x), bad=[];
    if(!finite(x)) bad.push("NaN/∞");
    if(!(sec>=8&&sec<=30)) bad.push("長さ "+sec.toFixed(1)+"秒");
    if(!(pk>0.65&&pk<=0.7001)) bad.push("ピーク "+pk.toFixed(3));
    const ds=[]; for(let i=1;i<x.length;i++) ds.push(Math.abs(x[i]-x[i-1])); ds.sort((a,b)=>a-b);
    const seam=Math.abs(x[0]-x[x.length-1]), p999=ds[Math.floor(ds.length*.999)];
    if(seam>p999) bad.push("つなぎ目の段差 "+seam.toFixed(4)+"（ふだんの最大 "+p999.toFixed(4)+"）");
    /* 音が途中で消えない（1秒ごとの音量がどこもピークの 3% 以上） */
    let minR=1; for(let i=0;i+sr<=x.length;i+=sr){ let s=0; for(let k=i;k<i+sr;k++) s+=x[k]*x[k]; minR=Math.min(minR,Math.sqrt(s/sr)); }
    if(minR<.03*pk) bad.push("音が消える区間がある");
    ok(bad.length===0,b.id+"@"+sr+"（"+sec.toFixed(1)+"秒でくり返す）"+(bad.length?"  "+bad.join(" / "):""));
  }
}

console.log("【D】操作（音の出ない jsdom で落ちないこと）");
const pads=d.querySelectorAll(".pad");
pads[6].dispatchEvent(new w.Event("pointerdown",{bubbles:true,cancelable:true}));
ok(S.sel===6&&pads[6].classList.contains("sel")&&!pads[0].classList.contains("sel"),"パッドを押すとそのパッドだけ選ばれる");
ok(/きしむ/.test(d.getElementById("pName").textContent),"右の欄に選んだ音の名前が出る");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyV",bubbles:true}));
ok(S.sel===15,"キー V で 16番目");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Digit6",bubbles:true}));
ok(S.bgms[1].on&&d.querySelectorAll(".bgm")[1].classList.contains("on"),"キー 6 で 2番目の BGM が ON");
d.querySelectorAll(".bgmb")[3].dispatchEvent(new w.Event("pointerdown",{bubbles:true,cancelable:true}));
ok(S.bgms[3].on&&S.bgms.filter(b=>b.on).length===2,"BGM は重ねて ON にできる");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Space",bubbles:true}));
ok(S.bgms.filter(b=>b.on).length===2,"スペース（効果音だけ止める）では BGM は止まらない");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Escape",bubbles:true}));
ok(S.bgms.every(b=>!b.on)&&d.querySelectorAll(".bgm.on").length===0,"Esc で BGM も全部止まる");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyB",bubbles:true}));
ok(S.bgms[0].on,"キー B で動画の BGM が ON（前の廃校徘徊サンプラーと同じ）");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Digit9",bubbles:true}));
ok(S.bgms[4].on,"キー 9 で 5番目の BGM が ON");
d.getElementById("stopAllTop").click();
ok(S.bgms.every(b=>!b.on),"上の「■ 全部止める」でも止まる");
const vol=d.getElementById("pVol"); vol.value="40"; vol.dispatchEvent(new w.Event("input"));
ok(S.pads[15].vol===40&&d.getElementById("vVol").textContent==="40%","音量のつまみが選んだパッドに効く");
const was=S.pads[15].auto; d.getElementById("pAuto").click();
ok(S.pads[15].auto===!was&&pads[15].classList.contains("auto")===!was,"★ で自動おどかしに出し入れできる");
d.getElementById("autoBtn").click();
ok(S.autoOn&&/気配 あと \d+ 秒/.test(d.getElementById("autoSt").textContent)&&/不意打ち あと \d+ 秒/.test(d.getElementById("autoSt").textContent),"自動おどかし ON で、気配と不意打ちの次までの秒数が出る");
{ const fb=d.querySelectorAll("#freq button"); fb[2].click();
  ok(S.freqMul===0.6&&fb[2].classList.contains("sel")&&!fb[1].classList.contains("sel"),"「多め」を押すと間隔が短くなる"); }
d.getElementById("autoBtn").click();
ok(!S.autoOn,"もう一度押すと OFF");
{ const s=JSON.parse(w.localStorage.getItem("kyouiku-obake-v2")||"null");
  ok(s&&s.pads[15].vol===40&&s.freqMul===0.6,"設定はブラウザに保存される"); }

setTimeout(()=>{
  ok(errs.length===0,"スクリプトのエラーなし"+(errs.length?"：\n      "+errs.join("\n      "):""));
  console.log("\n"+(fail?"✗ "+fail+" 項目 失敗":"すべて合格"));
  process.exit(fail?1:0);
},300);
