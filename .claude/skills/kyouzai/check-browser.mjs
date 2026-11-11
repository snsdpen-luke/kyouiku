// kyouzai の実ブラウザ確認。Mac の Google Chrome（なければ Playwright の Chromium）で教材を開き、
// いくつかの画面の大きさで全ページをたどって、画面写真と問題点を集める。
//
//   node .claude/skills/kyouzai/check-browser.mjs <本体>.html [--out 出力先] [--hash '#sensei'] [--walk auto|next|none] [--only chromebook,phone]
//
//   --walk auto ：ひな形の教材。問題に答え、小テストも受けて最後まで進む（タッチの画面ではタップで操作）
//   --walk next ：ひな形でない教材。#next（--next で変えられる）を押せるだけ押す
//   --walk none ：最初の画面だけ
// 結果：出力先/report.md（問題点の一覧と画面写真の場所）。画面写真は必ず自分の目で見ること。
// 終了コード：NG があれば 1。
import { chromium } from 'playwright';
import fs from 'fs';
import path from 'path';

const args = process.argv.slice(2);
const file = args.find(a => !a.startsWith('--') && !args[args.indexOf(a) - 1]?.startsWith('--'));
const opt = n => { const i = args.indexOf('--' + n); return i >= 0 ? args[i + 1] : null; };
if (!file) { console.log('使い方: node check-browser.mjs <本体>.html [--out 出力先] [--hash #sensei] [--walk auto|next|none]'); process.exit(2); }
const OUT = opt('out') || path.join('/tmp', 'kyouzai-check', path.basename(file, '.html'));
const WALK = opt('walk') || 'auto';
const NEXT = opt('next') || '#next';
const HASH = opt('hash') || '';

// 画面の大きさ。Chromebook は 16:9 が多い（1366×768、高解像度は表示倍率で 1536×864 前後）。4:3 端末・縦のタブレット・スマートフォンも見る
const VIEWS = [
  { name: 'chromebook', w: 1366, h: 768, touch: false },
  { name: 'chromebook-hd', w: 1536, h: 864, touch: false },
  { name: '4x3', w: 1024, h: 768, touch: true },
  { name: 'tablet-tate', w: 768, h: 1024, touch: true },
  { name: 'phone', w: 390, h: 844, touch: true, mobile: true, dsf: 3 },
].filter(v => !opt('only') || opt('only').split(',').includes(v.name));

const url = 'file://' + path.resolve(file) + HASH;
fs.rmSync(OUT, { recursive: true, force: true }); fs.mkdirSync(OUT, { recursive: true });

let browser;
try { browser = await chromium.launch({ channel: 'chrome' }); }
catch (e) { browser = await chromium.launch(); }
console.log('ブラウザ: ' + browser.version());

// 1画面の点検（ページの中で動く）
function inspect() {
  const vw = innerWidth, vh = innerHeight, out = { overflowX: false, outside: [], tiny: [], small: [], taps: [], canvas: [] };
  const vis = e => { const s = getComputedStyle(e); if (s.visibility === 'hidden' || s.display === 'none' || +s.opacity === 0) return false; const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0; };
  const name = e => (e.id ? '#' + e.id : e.tagName.toLowerCase() + (e.className && typeof e.className === 'string' ? '.' + e.className.trim().split(/\s+/).join('.') : '')) + ' 「' + (e.textContent || e.value || '').trim().slice(0, 16) + '」';
  const inScroller = e => { for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (/(auto|scroll)/.test(s.overflowY + s.overflowX) && (p.scrollHeight > p.clientHeight + 1 || p.scrollWidth > p.clientWidth + 1)) return true; } return false; };
  const fixedIn = e => { for (let p = e; p; p = p.parentElement) if (getComputedStyle(p).position === 'fixed') return true; return false; };
  out.overflowX = document.documentElement.scrollWidth > vw + 1;
  // 重なって隠れた文字・部品：真ん中の点で、いちばん上にある物が自分（か自分の中・外側）でなければ隠れている
  out.hidden = [];
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || e.closest('svg') || e.tagName === 'SCRIPT') continue;
    const isCtl = e.matches('button,input,select,textarea,a[href],[role=button]');
    if (!isCtl && ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    // 調べる点：ブロックは真ん中と上下左右に寄った4点、文の中の要素（inline）は各行の真ん中
    const pts = [];
    if (getComputedStyle(e).display === 'inline') for (const q of e.getClientRects()) pts.push([q.left + q.width / 2, q.top + q.height / 2]);
    else { const r = e.getBoundingClientRect(); for (const [fx, fy] of [[.5, .5], [.15, .5], [.85, .5], [.5, .2], [.5, .8]]) pts.push([r.left + r.width * fx, r.top + r.height * fy]); }
    for (const [cx, cy] of pts) {
      if (cx < 0 || cy < 0 || cx > vw || cy > vh) continue;
      let clip = false; for (let p = e.parentElement; p; p = p.parentElement) { const s = getComputedStyle(p); if (s.overflow !== 'visible') { const q = p.getBoundingClientRect(); if (cx < q.left || cx > q.right || cy < q.top || cy > q.bottom) { clip = true; break; } } }
      if (clip) continue;
      const top = document.elementFromPoint(cx, cy);
      if (top && top !== e && !e.contains(top) && !top.contains(e)) { out.hidden.push(name(e) + ' ← ' + name(top)); break; }
    }
  }
  for (const e of document.querySelectorAll('button,input,select,textarea,a[href],[role=button],canvas')) {
    if (!vis(e)) continue; const r = e.getBoundingClientRect();
    const off = r.right > vw + 1 || r.left < -1 || r.bottom > vh + 1 || r.top < -1;
    if (off && !inScroller(e) && !fixedIn(e)) out.outside.push(name(e));
    if (e.tagName !== 'CANVAS' && !e.disabled && (r.width < 44 || r.height < 44) && !(e.tagName === 'INPUT' && /checkbox|radio/.test(e.type))) out.taps.push(name(e) + ` ${Math.round(r.width)}×${Math.round(r.height)}`);
  }
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || ['SCRIPT', 'STYLE', 'svg'].includes(e.tagName) || e.closest('svg')) continue;
    if (![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    const fs = parseFloat(getComputedStyle(e).fontSize);
    if (fs < 12) out.tiny.push(name(e) + ` ${fs}px`); else if (fs < 14) out.small.push(name(e) + ` ${fs}px`);
  }
  // 文字と背景の色の差（コントラスト比）。3 未満は読めない（白地に白い文字など）
  out.contrast = [];
  const rgba = c => { const m = c.match(/[\d.]+/g); return m ? m.map(Number).concat(m.length === 3 ? [1] : []) : [0, 0, 0, 0]; };
  const lum = ([r, g, b]) => { const f = v => { v /= 255; return v <= 0.03928 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4; }; return 0.2126 * f(r) + 0.7152 * f(g) + 0.0722 * f(b); };
  const bgOf = e => { for (let p = e; p; p = p.parentElement) { const c = rgba(getComputedStyle(p).backgroundColor); if (c[3] > 0.5) return c; } return [255, 255, 255, 1]; };
  for (const e of document.querySelectorAll('body *')) {
    if (!vis(e) || e.closest('svg') || ['SCRIPT', 'STYLE', 'OPTION'].includes(e.tagName)) continue;
    const isField = e.matches('select,input:not([type=checkbox]):not([type=radio]),textarea');
    if (!isField && ![...e.childNodes].some(n => n.nodeType === 3 && n.textContent.trim())) continue;
    if (isField && !(e.value || e.placeholder)) continue;
    const st = getComputedStyle(e); const fg = rgba(st.color); if (fg[3] < 0.3) continue;
    const L1 = lum(fg), L2 = lum(bgOf(e)); const ratio = (Math.max(L1, L2) + 0.05) / (Math.min(L1, L2) + 0.05);
    if (ratio < 3) out.contrast.push(name(e) + ` 比 ${ratio.toFixed(1)}`);
  }
  for (const c of document.querySelectorAll('canvas')) {
    if (!vis(c)) continue; const r = c.getBoundingClientRect();
    const a1 = c.width / c.height, a2 = r.width / r.height;
    if (Math.abs(a1 / a2 - 1) > 0.02) out.canvas.push(`canvas ${c.width}×${c.height} を ${Math.round(r.width)}×${Math.round(r.height)} で表示（ゆがみ ${Math.round((a1 / a2 - 1) * 100)}%）`);
  }
  return out;
}

const report = [], NG = [];
for (const V of VIEWS) {
  const ctx = await browser.newContext({ viewport: { width: V.w, height: V.h }, hasTouch: V.touch, isMobile: !!V.mobile, deviceScaleFactor: V.dsf || 1, colorScheme: 'dark', locale: 'ja-JP' });
  const p = await ctx.newPage();
  const errs = [], net = [];
  p.on('pageerror', e => errs.push(e.message));
  p.on('console', m => { if (m.type() === 'error') errs.push(m.text()); });
  await p.route('**/*', r => { const u = r.request().url(); if (/^(file|data|blob|about):/.test(u)) r.continue(); else { net.push(u); r.abort(); } });
  await p.goto(url); await p.waitForTimeout(300);
  const dark = await p.evaluate(() => { const b = getComputedStyle(document.body).backgroundColor.match(/\d+/g).map(Number); return (b[0] + b[1] + b[2]) / 3 < 100; });
  const press = async sel => { const h = await p.$(sel); if (!h) return false; if (V.touch) await h.tap(); else await h.click(); await p.waitForTimeout(80); return true; };
  const shots = []; const issues = { contrast: new Set(), hidden: new Set(), outside: new Set(), tiny: new Set(), small: new Set(), taps: new Set(), canvas: new Set(), overflowX: 0 };
  const snap = async label => {
    await p.waitForTimeout(150);
    const k = String(shots.length + 1).padStart(2, '0'); const f = path.join(OUT, V.name, `${k}-${label}.png`.replace(/[\\/:*?"<>|\s]/g, '_'));
    fs.mkdirSync(path.dirname(f), { recursive: true }); await p.screenshot({ path: f });
    const r = await p.evaluate(inspect); shots.push(f);
    if (r.overflowX) issues.overflowX++;
    for (const key of ['outside', 'hidden', 'contrast', 'tiny', 'small', 'taps', 'canvas']) r[key].forEach(x => issues[key].add(`${k}: ${x}`));
  };
  const label = async () => p.evaluate(() => { try { const P = FLOW[st.p]; return (st.p + 1) + '-' + P.sec + (P.sub ? '-' + P.sub.replace(/\s/g, '') : ''); } catch (e) { return 'page'; } });
  await snap(await label());
  if (WALK === 'auto') {
    for (let guard = 0; guard < 400; guard++) {
      const kind = await p.evaluate(() => { try { return FLOW[st.p].kind; } catch (e) { return null; } });
      if (kind == null) break;
      if (kind === 'test' && await p.$('#no')) {
        await p.fill('#no', '0101'); await press('#tgo'); await snap(await label() + '-test1');
        for (let k = 0; k < 60 && await p.$('#tnext'); k++) {
          if (await p.$('#card .opt')) await press('#card .opt'); else if (await p.$('#numIn')) await p.fill('#numIn', '1');
          await press('#tnext');
        }
        await snap(await label() + '-confirm'); await press('#send'); if (await p.$('.warn')) await press('#send');
        await p.waitForTimeout(1800); await snap(await label() + '-result');
      } else if (await p.$('#qbox') && await p.$eval(NEXT, b => b.disabled)) {
        if (await p.$('#wIn')) { await p.fill('#wIn', 'ためしに十文字以上を書いてみる。'); await press('#qbox #go'); const b = await p.$('#qbox .btn >> text=できた'); if (b) { V.touch ? await b.tap() : await b.click(); } }
        else if (await p.$('#numIn')) { await p.fill('#numIn', '1'); await press('#qbox #go'); }
        else { await press('#qbox .opt'); if (await p.$('#qbox #go')) await press('#qbox #go'); }
        await snap(await label() + '-answered');
      }
      if (kind === 'end') break;
      const n = await p.$(NEXT); if (!n || await n.isDisabled()) { NG.push(`${V.name}: ${await label()} で「次へ」が押せないまま止まった`); break; }
      await press(NEXT); await snap(await label());
    }
  } else if (WALK === 'next') {
    for (let guard = 0; guard < 200; guard++) { const n = await p.$(NEXT); if (!n || await n.isDisabled() || !await n.isVisible()) break; await press(NEXT); await snap('p' + (guard + 2)); }
  }
  const row = { view: `${V.name} ${V.w}×${V.h}${V.touch ? '・タッチ' : ''}`, shots: shots.length, errs, net, dark, issues };
  report.push(row);
  if (errs.length) NG.push(`${V.name}: エラー ${errs.length}件`);
  if (net.length) NG.push(`${V.name}: 外への通信 ${net.length}件（${net[0]}）`);
  if (dark) NG.push(`${V.name}: ダークモードの端末で背景が暗くなった`);
  if (issues.overflowX) NG.push(`${V.name}: 横にはみ出してスクロールが出る画面 ${issues.overflowX}`);
  if (issues.outside.size) NG.push(`${V.name}: 画面の外に出て押せない部品 ${issues.outside.size}`);
  if (issues.hidden.size) NG.push(`${V.name}: ほかの物に重なって隠れた文字・部品 ${issues.hidden.size}`);
  if (issues.contrast.size) NG.push(`${V.name}: 背景との色の差が小さく読めない文字 ${issues.contrast.size}`);
  if (issues.tiny.size) NG.push(`${V.name}: 12px 未満の文字 ${issues.tiny.size}`);
  if (issues.canvas.size) NG.push(`${V.name}: 図のゆがみ ${issues.canvas.size}`);
  await ctx.close();
}
await browser.close();

const L = [`# 実ブラウザ確認：${path.basename(file)}`, '', `- 開いた URL：\`${url}\``, `- たどり方：${WALK}`, `- 結果：${NG.length ? '**NG ' + NG.length + '件**' : '**NG なし**'}`, ''];
if (NG.length) L.push('## NG', ...NG.map(x => '- ' + x), '');
for (const r of report) {
  L.push(`## ${r.view}（画面 ${r.shots}枚）`);
  // 同じ指摘は1行にまとめ、出た画面の番号を並べる
  const sec = (t, a) => { if (!a.length) return; const g = new Map(); for (const x of a) { const m = x.match(/^(\d+): (.*)$/); const k = m ? m[2] : x; if (!g.has(k)) g.set(k, []); if (m) g.get(k).push(m[1]); }
    const rows = [...g].map(([k, ns]) => '  - ' + k + (ns.length ? `（画面 ${ns.length > 6 ? ns.slice(0, 6).join(',') + '…ほか' + (ns.length - 6) : ns.join(',')}）` : ''));
    L.push(`- ${t}（${g.size}種類）`, ...rows.slice(0, 15), ...(rows.length > 15 ? ['  - …'] : [])); };
  sec('エラー', r.errs); sec('外への通信（止めた）', r.net);
  sec('画面の外に出て押せない', [...r.issues.outside]); sec('重なって隠れた文字・部品', [...r.issues.hidden]); sec('背景との色の差が小さい（比 3 未満）', [...r.issues.contrast]); sec('12px 未満の文字', [...r.issues.tiny]); sec('図のゆがみ', [...r.issues.canvas]);
  sec('注意：14px 未満の文字', [...r.issues.small]); sec('注意：44px 未満のボタン', [...r.issues.taps]);
  L.push(`- 画面写真：\`${path.join(OUT, r.view.split(' ')[0])}/\``, '');
}
fs.writeFileSync(path.join(OUT, 'report.md'), L.join('\n'));
console.log(L.join('\n'));
process.exit(NG.length ? 1 : 0);
