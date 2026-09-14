import { chromium } from 'playwright';
const F='file:///home/user/kyouiku/つなぐ工房.html';
const b=await chromium.launch({executablePath:'/opt/pw-browsers/chromium-1194/chrome-linux/chrome'});
const p=await b.newPage({viewport:{width:1366,height:768},deviceScaleFactor:2});
const log=[]; p.on('pageerror',e=>log.push('PAGEERROR '+e.message));
await p.goto(F,{waitUntil:'load'}); await p.waitForTimeout(400);

// 課題02 をひらく
await p.click('[data-go="1"]'); await p.waitForTimeout(200);
const wires0 = await p.evaluate(()=>document.querySelectorAll('[data-wire]').length);

// 端子をタップして配線する（B の右 → ランプの左）
await p.click('[data-term="B.b"]'); await p.waitForTimeout(120);
const selRing = await p.evaluate(()=>document.querySelectorAll('circle[stroke="#6d28d9"]').length);
await p.click('[data-term="Y.a"]'); await p.waitForTimeout(200);
const wires1 = await p.evaluate(()=>document.querySelectorAll('[data-wire]').length);

// 運転にする
await p.click('#modeBtn'); await p.waitForTimeout(200);
const disabled0 = await p.isDisabled('#checkBtn');
await p.screenshot({path:'/home/user/kyouiku/設計/つなぐ工房モック/絵/実機_01_運転直後.png'});

// 4 とおりためす
const wait=()=>p.evaluate(()=>document.querySelectorAll('#truth .r.wait').length);
const combos=[await wait()];                       // 運転に入った時点で 00 は記録済み
for(const n of ['A','B','A']){ await p.click(`[data-sw="${n}"]`); await p.waitForTimeout(90);
  combos.push(await wait()); }                     // 00→10→11→01
await p.click('[data-sw="A"]'); await p.waitForTimeout(120);   // 11 にもどす
const disabled1 = await p.isDisabled('#checkBtn');
const lamp = await p.evaluate(()=>document.querySelector('.lamp').className);
await p.screenshot({path:'/home/user/kyouiku/設計/つなぐ工房モック/絵/実機_02_4とおりそろった.png'});

// たしかめる
await p.click('#checkBtn'); await p.waitForTimeout(300);
const verdict = await p.evaluate(()=>document.querySelector('#popbox h2')?.textContent||'なし');
const popShown = await p.evaluate(()=>document.querySelector('#pop').classList.contains('show'));
const retHot  = await p.evaluate(()=>[...document.querySelectorAll('path[stroke="#0d9488"]')].length);
await p.screenshot({path:'/home/user/kyouiku/設計/つなぐ工房モック/絵/実機_03_合格.png'});
await p.click('#closeBtn'); await p.waitForTimeout(200);

// 課題06 をひらいて、ヒント3→お手本半分 を試す
await p.click('[data-go="5"]'); await p.waitForTimeout(200);
for(let i=0;i<3;i++){ await p.click('#hintBtn'); await p.waitForTimeout(120);
  if(i<2) await p.click('#closeBtn'); await p.waitForTimeout(80); }
const hwExists = await p.evaluate(()=>!!document.querySelector('#hwBtn'));
await p.screenshot({path:'/home/user/kyouiku/設計/つなぐ工房モック/絵/実機_04_ヒント3段目.png'});
if(hwExists){ await p.click('#hwBtn'); await p.waitForTimeout(250); }
const wires06 = await p.evaluate(()=>document.querySelectorAll('[data-wire]').length);

console.log('課題02 開始の線     :', wires0, '(期待 3)');
console.log('端子タップで選択    :', selRing>0 ? 'OK 紫の輪が出た' : 'NG 選択が見えない');
console.log('配線後の線          :', wires1, '(期待 4)');
console.log('運転直後 たしかめる :', disabled0 ? 'OK 押せない' : 'NG 押せてしまう');
console.log('未実施の行の減り方  :', combos.join(' → '), '(期待 3→2→1→0)');
console.log('4とおり後 たしかめる:', disabled1 ? 'NG まだ押せない' : 'OK 押せる');
console.log('A=1,B=1 のランプ    :', lamp.includes('on') ? 'OK 点いた' : 'NG 点かない');
console.log('判定                :', verdict, popShown?'（画面中央に出た）':'（NG 出ていない）');
console.log('光っている線の本数  :', retHot, '(期待 4 = もどる道もふくめて全部)');
console.log('ヒント3の お手本     :', hwExists ? 'OK 出た' : 'NG 出ない');
console.log('お手本を入れた後の線:', wires06, '(期待 6)');
console.log('JSエラー            :', log.length? log.join(' / ') : 'なし');
await b.close();
