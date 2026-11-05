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
ok(S.PADS.map(p=>p.id).join()==="moanLow,moanHigh,kaere,wasuremono,mitsukete,bangHard,climax1,climax2,climax3,climax4,climax5,climax6,climax7","効果音は13個（うめき声2・帰れ・ささやき「わすれもの」「みつけて」・ドアをはげしくたたく・クライマックスのセリフ7つ）");
ok(S.PADS.every(p=>typeof S.SYNTH[p.id]==="function"||S.SAMPLE_WAV[p.id]),"どの効果音にも、合成の関数か録音がある");
ok(S.SAMPLE_WAV.kaere&&S.SAMPLE_WAV.kaere.length===3&&!S.SYNTH.kaere,"「帰れ！」は動画から切り出した録音3つ（合成ではない）");
ok(S.BGMS.map(b=>b.id).join()==="drone"&&typeof S.BGM_SYNTH.drone==="function","BGM は「不気味な低音」1つだけ");
ok(S.MAX_VOICES>=4&&S.MAX_VOICES<=8,"同時に鳴らす効果音に上限がある（"+S.MAX_VOICES+"）");
ok(!d.getElementById("autoBtn")&&!d.getElementById("freq")&&!d.querySelector(".star")&&!("setAuto" in S)&&S.PADS.every(p=>!("auto" in p)),"自動おどかしは無い（ボタン・★・しくみごと消した）");
ok(new Set([...S.KEYS,...S.BGM_KEYS]).size===14&&[...S.KEYS,...S.BGM_KEYS].every(k=>/^(Digit|Key)/.test(k)),"キーは14個・重複なし・e.code で指定");
ok(d.querySelectorAll(".pad").length===13,"画面にパッドが13個");
ok(d.querySelectorAll(".cell").length===13&&[...d.querySelectorAll(".cell")].every(c=>c.querySelector(".vol")&&c.querySelector(".pit")&&c.querySelectorAll(".st").length===4&&c.querySelectorAll(".rs").length===2),"どのパッドの下にも、音量と高さのつまみ・－＋ボタン・元にもどすボタンがある");
ok(/止まっている/.test(d.getElementById("bgmState").textContent)&&!d.getElementById("bgmbar").classList.contains("on"),"BGM は最初は止まっていて、そう表示される");
ok(d.querySelector("h1").textContent==="廃校徘徊"&&d.title==="廃校徘徊 サンプラー","題は「廃校徘徊」");
ok(S.PADS.every(p=>!p.name.includes("\n")),"パッドの名前は1行（改行を入れない。長いものは字を小さくして収める）");
ok([...d.querySelectorAll(".pad .ky")].map(e=>e.textContent).join("")==="QWEASD1234567","パッドのキーの文字が正しい");
ok(/版 \d{4}-\d{2}-\d{2}[a-z]?/.test(d.getElementById("ver").textContent),"版表示が出ている");

console.log("【B】効果音の合成（48kHz と 44.1kHz）");
const finite=x=>{ for(const v of x) if(!Number.isFinite(v)) return false; return true; };
for(const sr of [48000,44100]){
  for(const p of S.PADS){
    const bad=[];
    for(let v=0;v<S.NVAR;v++){
      const x=S.renderPad(p.id,sr,v), pk=S.peakOf(x), sec=x.length/sr;
      if(!finite(x)) bad.push("v"+v+" NaN/∞");
      if(!(p.big?pk<=0.9001:pk>0.85&&pk<=0.9001)) bad.push("v"+v+" ピーク "+pk.toFixed(3));
      if(!(sec>=0.3&&sec<=8)) bad.push("v"+v+" 長さ "+sec.toFixed(2)+"秒");
      if(Math.abs(x[0])>1e-3||Math.abs(x[x.length-1])>1e-3) bad.push("v"+v+" 頭かお尻がゼロでない（プツッと鳴る）");
    }
    ok(bad.length===0,p.id+"@"+sr+"（"+S.NVAR+"通り）"+(bad.length?"  "+bad.join(" / "):""));
  }
}
{ const x=S.renderPad("kaere",48000,0), y=S.renderPad("kaere",44100,0);
  ok(Math.abs(x.length/48000-y.length/44100)<.001&&x.length/48000>1.4&&x.length/48000<2.2,"「帰れ！」の録音は約"+(x.length/48000).toFixed(2)+"秒・どの速さに直しても長さが同じ"); }
{ const ids=[1,2,3,4,5,6,7].map(k=>"climax"+k), xs=ids.map(id=>S.renderPad(id,48000,0)), secs=xs.map(x=>x.length/48000);
  ok(ids.every(id=>S.SAMPLE_WAV[id]&&S.SAMPLE_WAV[id].length===1&&!S.SYNTH[id]),"クライマックス①〜⑦は剛さんの録音（合成ではない）");
  const want=[2.77,0.77,1.57,3.53,4.13,3.02,0.85];
  ok(secs.every((v,i)=>Math.abs(v-want[i])<.02)&&ids.every((id,i)=>Math.abs(S.renderPad(id,44100,0).length/44100-secs[i])<.001),
     "クライマックスはセリフごとに7つ（"+secs.map(v=>v.toFixed(1)).join("・")+"秒）・どの速さに直しても長さが同じ");
  const pks=xs.map(S.peakOf);
  ok(Math.max(...pks)>.88&&Math.max(...pks)<=.9001&&Math.abs(pks[1]/pks[3]-2532/8882)<.01,"7つの大きさのつり合いは録音のまま（②は④の "+Math.round(pks[1]/pks[3]*100)+"%）");
  /* 元の録音では、止めたときの「カチッ」が中身の約2倍の大きさだった。入っていれば、⑦のピークだけ 0.9 をこえる */
  ok(pks[6]<.9,"⑦「わたし！」の最後に、録音を止めた「カチッ」が入っていない（⑦のピーク "+pks[6].toFixed(2)+"）");
  const cs=[...d.querySelectorAll(".cell")].slice(6);
  ok(S.pads.slice(6).every(p=>p.big)&&cs.every(c=>c.classList.contains("big")),"クライマックスは大きいパッドとして並ぶ"); }
{ const a=S.renderPad("moanLow",48000,0).length/48000, b=S.renderPad("moanHigh",48000,0).length/48000;
  ok(Math.abs(a-1)<.05&&Math.abs(b-1)<.05,"うめき声は短く（「あー」 "+a.toFixed(2)+"秒・「うー」 "+b.toFixed(2)+"秒）"); }
{ const a=S.renderPad("bangHard",48000,1), b=S.renderPad("bangHard",48000,1), c=S.renderPad("bangHard",48000,2);
  ok(a.every((v,i)=>v===b[i]),"同じ番号の波形は毎回まったく同じ（乱数の種が固定）");
  ok(a.length!==c.length||a.some((v,i)=>v!==c[i]),"番号がちがえば波形もちがう（くり返しが単調にならない）"); }
/* 声の高さ（自己相関でいちばん似ている周期をさがす） */
function pitchOf(x,sr,from,to){
  const a=Math.round(from*sr), n=Math.round((to-from)*sr), lo=Math.round(sr/1500), hi=Math.round(sr/80);
  let best=0, bl=lo;
  for(let L=lo;L<=hi;L++){ let s=0,e1=0,e2=0; for(let i=a;i<a+n;i++){ s+=x[i]*x[i+L]; e1+=x[i]*x[i]; e2+=x[i+L]*x[i+L]; }
    const r=s/Math.sqrt(e1*e2+1e-12); if(r>best){ best=r; bl=L; } }
  /* オクターブまちがいよけ：ざらついた声（rough）は1つおきの波の強さがちがい、2倍の周期のほうが少し似て見える。
     半分の周期でもほぼ同じくらい似ていれば（85%以上）、そちらが本当の高さ */
  const rAt=L=>{ let s=0,e1=0,e2=0; for(let i=a;i<a+n;i++){ s+=x[i]*x[i+L]; e1+=x[i]*x[i]; e2+=x[i+L]*x[i+L]; } return s/Math.sqrt(e1*e2+1e-12); };
  for(let h=Math.round(bl/2);h>=lo&&rAt(h)>=.85*best;h=Math.round(h/2)) bl=h;
  return sr/bl; }
/* 「あ」は 850Hz あたりの響き（第1フォルマント）が強く、そのまま測るとそれを声の高さとまちがえる。
   500Hz より上を弱めてから測る（声の高さそのものは 150〜300Hz なので消えない） */
const lowpass=(x,sr,fc)=>{ const k=1-Math.exp(-2*Math.PI*fc/sr), y=new Float32Array(x.length); let a=0,b=0;
  for(let i=0;i<x.length;i++){ a+=k*(x[i]-a); b+=k*(a-b); y[i]=b; } return y; };
{ const sr=48000, m=lowpass(S.renderPad("moanLow",sr,0),sr,500), fm=pitchOf(m,sr,.45,.55);
  ok(fm>150&&fm<300,"うめき声「あー」は女の低い声の高さ（"+Math.round(fm)+" Hz）"); }
{ const zc=x=>{let n=0;for(let i=1;i<x.length;i++) if((x[i-1]<0)!==(x[i]<0)) n++; return n/(x.length/48000);};
  const k=S.renderPad("bangHard",48000,0), g=S.renderPad("mitsukete",48000,0);
  ok(zc(k)<1500,"ドアをたたく音は低い音（ゼロ交差 "+Math.round(zc(k))+"回/秒）");
  ok(zc(g)>2500,"ささやきは息の音（ゼロ交差 "+Math.round(zc(g))+"回/秒）"); }
{ /* ドアをたたく音は、たたいた数だけ山がある */
  const sr=48000, x=S.renderPad("bangHard",sr,0), win=Math.round(sr*.01), e=[];
  for(let i=0;i+win<x.length;i+=win){ let s=0; for(let k=i;k<i+win;k++) s=Math.max(s,Math.abs(x[k])); e.push(s); }
  const on=[]; let up=false; e.forEach((v,i)=>{ if(!up&&v>.3){ on.push(i*.01); up=true; } else if(up&&v<.12) up=false; });
  ok(on.length===14,"ドアをはげしくたたく：14回たたいている（"+on.length+"回）");
  const gap=on.slice(1).map((t,i)=>t-on[i]), mn=Math.min(...gap), mx=Math.max(...gap);
  ok(mx-mn<=.03,"ドアをたたく間隔がそろっている（"+mn.toFixed(2)+"〜"+mx.toFixed(2)+"秒）"); }
{ const zc=x=>{let n=0;for(let i=1;i<x.length;i++) if((x[i-1]<0)!==(x[i]<0)) n++; return n/(x.length/48000);};
  for(const [id,w] of [["wasuremono","わすれもの"],["mitsukete","みつけて"]]){ const x=S.renderPad(id,48000,0), z=zc(x), sec=x.length/48000;
    ok(z>2500&&sec>1.3&&sec<2.6,"ささやき「"+w+"」は息の音（ゼロ交差 "+Math.round(z)+"回/秒・"+sec.toFixed(2)+"秒）"); } }

console.log("【C】BGM（くり返しのつなぎ目）");
for(const sr of [48000,44100]){
  for(const b of S.BGMS){
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
const cells=d.querySelectorAll(".cell"), pads=d.querySelectorAll(".pad");
pads[4].dispatchEvent(new w.Event("pointerdown",{bubbles:true,cancelable:true}));
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyS",bubbles:true}));
ok(errs.length===0,"パッドを押しても、キー S を押しても落ちない");
{ const v=cells[4].querySelector(".vol"); v.value="40"; v.dispatchEvent(new w.Event("input"));
  ok(S.pads[4].vol===40&&cells[4].querySelector(".vv").textContent==="40%"&&S.pads[3].vol===100,"音量のつまみは、そのパッドだけに効く");
  const q=cells[4].querySelector(".pit"); q.value="5"; q.dispatchEvent(new w.Event("input"));
  ok(S.pads[4].pitch===5&&cells[4].querySelector(".pv").textContent==="+5"&&S.pads[3].pitch===0,"高さのつまみは、そのパッドだけに効く（+5）");
  q.value="-3"; q.dispatchEvent(new w.Event("input")); q.dispatchEvent(new w.Event("change"));
  ok(S.pads[4].pitch===-3&&cells[4].querySelector(".pv").textContent==="-3","高さは下げることもできる（-3）"); }
{ const c=cells[4], q=c.querySelector.bind(c);
  q(".vp").click(); ok(S.pads[4].vol===45&&q(".vol").value==="45"&&q(".vv").textContent==="45%","音量の ＋ で 5% 上がる（40→45）");
  q(".vm").click(); q(".vm").click(); ok(S.pads[4].vol===35,"音量の － で 5% ずつ下がる");
  q(".pp").click(); ok(S.pads[4].pitch===-2&&q(".pv").textContent==="-2","高さの ＋ で 1 上がる（-3→-2）");
  q(".pm").click(); ok(S.pads[4].pitch===-3&&q(".pit").value==="-3","高さの － で 1 下がる");
  ok(parseFloat(q(".pit").style.getPropertyValue("--f")).toFixed(1)==="37.5","つまみの溝は、今の値まで赤くぬる（高さ -3 で 37.5%）");
  for(let k=0;k<40;k++) q(".vp").click(); ok(S.pads[4].vol===150,"音量は 150% より上がらない");
  for(let k=0;k<40;k++) q(".pm").click(); ok(S.pads[4].pitch===-12,"高さは -12 より下がらない");
  q(".vr").click(); q(".pr").click(); ok(S.pads[4].vol===100&&S.pads[4].pitch===0&&q(".vv").textContent==="100%"&&q(".pv").textContent==="0","数字を押すと 100% と 0 にもどる");
  ok(S.pads[3].vol===100&&S.pads[3].pitch===0,"ほかのパッドは変わらない");
  q(".vol").value="40"; q(".vol").dispatchEvent(new w.Event("input")); q(".pit").value="-3"; q(".pit").dispatchEvent(new w.Event("input")); }
d.getElementById("bgmBtn").dispatchEvent(new w.Event("pointerdown",{bubbles:true,cancelable:true}));
ok(S.bgms[0].on&&d.getElementById("bgmbar").classList.contains("on")&&/鳴っている/.test(d.getElementById("bgmState").textContent),"BGM を押すと ON になり、「鳴っている」と出る");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Space",bubbles:true}));
ok(S.bgms[0].on,"スペース（効果音だけ止める）では BGM は止まらない");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyB",bubbles:true}));
ok(!S.bgms[0].on&&/止まっている/.test(d.getElementById("bgmState").textContent),"キー B で BGM が OFF になり、「止まっている」と出る");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyB",bubbles:true}));
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Escape",bubbles:true}));
ok(!S.bgms[0].on,"Esc で BGM も止まる");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyB",bubbles:true}));
d.getElementById("stopAllTop").click();
ok(!S.bgms[0].on,"上の「■ 全部止める」でも止まる");
{ const r=d.getElementById("bgmVol"); r.value="45"; r.dispatchEvent(new w.Event("input"));
  ok(S.bgms[0].vol===45&&d.getElementById("vBgm").textContent==="45%","BGM の音量のつまみが効く"); }
{ const s=JSON.parse(w.localStorage.getItem("kyouiku-obake-v7")||"null");
  ok(s&&s.pads[4].vol===40&&s.pads[4].pitch===-3&&s.bgms[0].vol===45,"設定はブラウザに保存される"); }

setTimeout(()=>{
  ok(errs.length===0,"スクリプトのエラーなし"+(errs.length?"：\n      "+errs.join("\n      "):""));
  console.log("\n"+(fail?"✗ "+fail+" 項目 失敗":"すべて合格"));
  process.exit(fail?1:0);
},300);
