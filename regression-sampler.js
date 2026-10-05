/* こえサンプラー（サンプラー.html）リグレッションテスト
   使い方: npm install jsdom && node regression-sampler.js サンプラー.html
   jsdom には音（Web Audio）もマイクも無い。音の合成と波形の加工（window.SAMPLER）、
   それと画面の骨組みだけを叩く。音の聞こえ方は実機で確かめること。 */
const {JSDOM,VirtualConsole}=require("jsdom");
const fs=require("fs");
const vc=new VirtualConsole(); vc.on("jsdomError",()=>{});
const TARGET=process.argv[2]||"サンプラー.html";
console.log("対象: "+TARGET+"\n");
const src=fs.readFileSync(TARGET,"utf8");
const dom=new JSDOM(src,{runScripts:"dangerously",pretendToBeVisual:true,virtualConsole:vc,url:"https://example.org/"});
const w=dom.window, d=w.document;
const errs=[]; w.onerror=(m,s,l,c,e)=>{errs.push((e&&e.stack||m).split("\n")[0]);return true;};
let fail=0;
const ok=(cond,msg)=>{ if(!cond){fail++;console.log("  ✗ "+msg);} else console.log("  ✓ "+msg); };
const S=w.SAMPLER;
ok(!!S,"window.SAMPLER（検証用の窓口）がある");

console.log("【A】パッドとキー");
ok(S.PRESETS.length===16,"プリセットは16個");
ok(new Set(S.PRESETS.map(p=>p.id)).size===16,"プリセットの id は重複しない");
ok(S.PRESETS.every(p=>typeof S.SYNTH[p.id]==="function"),"どのプリセットにも合成の関数がある");
ok(S.KEYS.length===16&&new Set(S.KEYS).size===16,"キーは16個・重複なし");
ok(S.KEYS.every(k=>/^(Digit|Key)/.test(k)),"キーは e.code で指定（日本語キーボードでも同じ位置）");
ok(d.querySelectorAll(".pad").length===16,"画面にパッドが16個並ぶ");
ok([...d.querySelectorAll(".pad .ky")].map(e=>e.textContent).join("")==="1234QWERASDFZXCV","パッドに書いたキーの文字が正しい");
ok(/版 \d{4}-\d{2}-\d{2}[a-z]?/.test(d.getElementById("ver").textContent),"版表示が出ている");

console.log("【B】音の合成（48kHz と 44.1kHz の両方）");
for(const sr of [48000,44100]){
  for(const p of S.PRESETS){
    const x=S.renderPreset(p.id,sr), tag=p.id+"@"+sr;
    let finite=true; for(const v of x) if(!Number.isFinite(v)){finite=false;break;}
    const pk=S.peakOf(x), sec=x.length/sr;
    const bad=[];
    if(!finite) bad.push("NaN/∞");
    if(!(pk>0.85&&pk<=0.9001)) bad.push("ピーク "+pk.toFixed(3));
    if(!(sec>=0.05&&sec<=2)) bad.push("長さ "+sec.toFixed(2)+"秒");
    if(Math.abs(x[0])>1e-3) bad.push("頭がゼロでない");
    if(Math.abs(x[x.length-1])>1e-3) bad.push("お尻がゼロでない（プツッと鳴る）");
    ok(bad.length===0,tag+(bad.length?"  "+bad.join(" / "):""));
  }
}
{ const a=S.renderPreset("snare",48000), b=S.renderPreset("snare",48000);
  ok(a.length===b.length&&a.every((v,i)=>v===b[i]),"同じ音は毎回まったく同じ波形（乱数の種が固定）"); }
{ const k=S.renderPreset("kick",48000), h=S.renderPreset("hatC",48000);
  const zc=x=>{let n=0;for(let i=1;i<x.length;i++) if((x[i-1]<0)!==(x[i]<0)) n++; return n/(x.length/48000);};
  ok(zc(k)<300,"キックは低い音（ゼロ交差 "+Math.round(zc(k))+"回/秒）");
  ok(zc(h)>5000,"ハイハットは高い音（ゼロ交差 "+Math.round(zc(h))+"回/秒）"); }

console.log("【C】録音した声の加工");
{ const sr=48000, x=new Float32Array(sr*3);           // 1秒無音 → 0.5秒の声（440Hz）→ 1.5秒無音
  for(let i=sr;i<sr*1.5;i++) x[i]=0.3*Math.sin(2*Math.PI*440*i/sr);
  for(let i=0;i<x.length;i++) x[i]+=(i%7-3)*1e-4;         // かすかな雑音
  const y=S.trimSilence(x,sr), sec=y.length/sr;
  ok(sec>0.55&&sec<0.65,"前後の無音を切る（3秒 → "+sec.toFixed(3)+"秒）");
  ok(Math.abs(y[0])<1e-3&&Math.abs(y[y.length-1])<1e-3,"切り口はフェードしてある（プツッと鳴らない）");
  const z=S.normalize(y.slice(),0.9); ok(Math.abs(S.peakOf(z)-0.9)<1e-6,"音量をそろえる（ピーク 0.9）"); }
ok(S.trimSilence(new Float32Array(1000),48000).length===0,"完全な無音は空になる（落ちない）");
{ const x=new Float32Array(100); S.normalize(x); ok(x.every(v=>v===0),"無音の normalize は何もしない（0 で割らない）"); }
{ const x=Float32Array.from([1,2,3,4]); const r=S.reversed(x);
  ok(r.join()==="4,3,2,1"&&S.reversed(r).join()==="1,2,3,4"&&x.join()==="1,2,3,4","逆再生は元の波形を壊さない"); }
ok(Math.abs(S.semitoneToRate(12)-2)<1e-9&&Math.abs(S.semitoneToRate(-12)-0.5)<1e-9&&S.semitoneToRate(0)===1,"ピッチ ±12 で 2倍 / 半分の速さ");

console.log("【D】操作（音の出ない jsdom で落ちないこと）");
const pads=d.querySelectorAll(".pad");
pads[5].dispatchEvent(new w.Event("pointerdown",{bubbles:true,cancelable:true}));
ok(S.sel===5,"パッドを押すとそのパッドが選ばれる");
ok(pads[5].classList.contains("sel")&&!pads[0].classList.contains("sel"),"選ばれたパッドだけ枠が付く");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"KeyV",bubbles:true}));
ok(S.sel===15,"キー V で 16番目のパッド");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Enter",bubbles:true}));
ok(S.mode==="rec"&&d.body.classList.contains("recmode"),"Enter で ろくおん モード");
d.dispatchEvent(new w.KeyboardEvent("keydown",{code:"Enter",bubbles:true}));
ok(S.mode==="play","もう一度 Enter で えんそう モードに戻る");
const pitch=d.getElementById("pPitch"); pitch.value="7"; pitch.dispatchEvent(new w.Event("input"));
ok(S.pads[15].pitch===7&&d.getElementById("vPitch").textContent==="+7","ピッチのつまみが選んだパッドに効く");
ok(!d.getElementById("pReset").disabled,"変えたら「元の音に戻す」が押せる");
d.getElementById("pReset").click();
ok(S.pads[15].pitch===0&&d.getElementById("pReset").disabled,"「元の音に戻す」で戻る");
const nm=d.getElementById("pName"); nm.value="ワン"; nm.dispatchEvent(new w.Event("input"));
ok(pads[15].querySelector(".nm").textContent==="ワン","名前を変えるとパッドの文字も変わる");

setTimeout(()=>{
  ok(errs.length===0,"スクリプトのエラーなし"+(errs.length?"：\n      "+errs.join("\n      "):""));
  console.log("\n"+(fail?"✗ "+fail+" 項目 失敗":"すべて合格"));
  process.exit(fail?1:0);
},300);
