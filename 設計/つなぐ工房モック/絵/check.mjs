import { chromium } from 'playwright';
const jobs=[['_pv_Concept.html',1000,1780],['_pv_Edit.html',1366,768],['_pv_Main.html',1366,768],
  ['_pv_Lesson05.html',1366,768],['_pv_HalfAdder.html',1366,768],['_pv_HintJudge.html',1366,768]];
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
for(const [f,w,h] of jobs){
  const p=await b.newPage({viewport:{width:w,height:h},deviceScaleFactor:1});
  await p.goto('file://'+process.cwd()+'/'+f,{waitUntil:'load'}); await p.waitForTimeout(900);
  const r=await p.evaluate(()=>{const d=document.documentElement;
    let mb=0; document.querySelectorAll('main,aside,section,.card').forEach(e=>{mb=Math.max(mb,e.getBoundingClientRect().bottom)});
    return {sw:d.scrollWidth, sh:d.scrollHeight, mb:Math.round(mb)};});
  const ok = r.sw<=w && r.mb<=h-14;
  console.log((ok?'OK  ':'NG  ')+f.padEnd(22)+`枠 ${w}x${h}  中身 ${r.sw}x${r.sh}  最下端 ${r.mb}`);
  await p.close();
}
await b.close();
