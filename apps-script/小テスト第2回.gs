/**
 * 電子計測制御 小テスト第2回（制御クイズ100 /seigyo100/ のメニュー）の答案の受け口。
 * スプレッドシートに付けた Apps Script に、このファイルの中身をそのまま貼る。手順は同じフォルダの README-小テスト第2回.md。
 *
 * - 1人1行。受け取るのは「出席番号・提出ID（端末で作るでたらめな文字）・13問の答え・図と計算の点・ヒントを見た問題」
 * - 同じ提出IDは1行にしかならない（通信が切れて送り直しても、二重に入らない）
 * - 記述8問の点の列は空で作る。先生が採点して入れると「合計」が出る
 * - 受け口の URL は公開ページに載るので、だれでも送れてしまう。形のおかしいものは捨てる
 * - Q の並びは、アプリ（制御クイズ100.html の T2）と同じ。番号を変えない
 */
const Q = [
  ['第1問 図（衝突被害軽減ブレーキ）', 'fig', 4],
  ['第2問 フィードバック制御とシーケンス制御', 'text', 5],
  ['第3問 超音波の距離（計算）', 'num', 3],
  ['第4問 気温と音速', 'text', 4],
  ['第5問 高速道路で超音波が使えない理由', 'text', 4],
  ['第6問 車輪速から時速（計算）', 'num', 3],
  ['第7問 パッシブ型とアクティブ型', 'text', 4],
  ['第8問 ABS の流れ', 'text', 3],
  ['第9問 車間時間と車間（計算）', 'num', 3],
  ['第10問 TTC（計算）', 'num', 3],
  ['第11問 レーダーとカメラ', 'text', 3],
  ['第12問 ACC のしくみ', 'text', 6],
  ['第13問 上り坂のクルーズコントロール', 'text', 5],
];
const SHEET = '答案';
const TEXT_MAX = 400; // アプリの記述の欄も 400 字まで
const AUTO_MAX = Q.filter(q => q[1] !== 'text').reduce((a, q) => a + q[2], 0); // 16
const TEXTS = Q.map((q, i) => i).filter(i => Q[i][1] === 'text');
// 列：A 受付日時・B 出席番号・C 提出ID・D デモ・E 図と計算の点・F〜R 13問の答え・S ヒントを見た問題・T〜 記述の点（8列）・最後 合計
const FIRST_ANS_COL = 6;

/** 最初に1回だけ実行する。「答案」のシートを作る（行があるときは何もしない） */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const sh = ss.getSheetByName(SHEET) || ss.insertSheet(SHEET);
  if (sh.getLastRow() > 1) throw new Error('「答案」にもう答案が入っています。消してよければ、シートごと消してから実行してください。');
  sh.clear();
  const head = ['受付日時', '出席番号', '提出ID', 'デモ', `図と計算の点（${AUTO_MAX}点）`]
    .concat(Q.map(q => q[0]), ['ヒントを見た問題'], TEXTS.map(i => `記述の点 第${i + 1}問（${Q[i][2]}点）`), ['合計（50点）']);
  sh.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold').setWrap(true);
  sh.setFrozenRows(1);
  sh.setFrozenColumns(2);
  sh.getRange(2, FIRST_ANS_COL, 1000, Q.length).setWrap(true).setVerticalAlignment('top');
  sh.setColumnWidths(FIRST_ANS_COL, Q.length, 260);
}

/** アプリから送られてくる答案を1行足す */
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const row = makeRow(d);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000); // 40人が同時に送っても順に書く
    try {
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(SHEET);
      if (!sh) return out({ ok: false, error: '準備（setup）がまだです' });
      const last = sh.getLastRow();
      const dup = last > 1 && sh.getRange(2, 3, last - 1, 1).createTextFinder(d.sid).matchEntireCell(true).findNext();
      if (!dup) {
        sh.appendRow(row);
        const r = sh.getLastRow(), c0 = FIRST_ANS_COL + Q.length + 1; // 記述の点の最初の列
        sh.getRange(r, c0 + TEXTS.length).setFormula(`=IF(COUNTBLANK(${colName(c0)}${r}:${colName(c0 + TEXTS.length - 1)}${r})>0,"",E${r}+SUM(${colName(c0)}${r}:${colName(c0 + TEXTS.length - 1)}${r}))`);
      }
      return out({ ok: true, dup: !!dup });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err).slice(0, 80) });
  }
}

/** ブラウザで URL を開いたときの返事（受け口が動いているかの確認用） */
function doGet() { return out({ ok: true, msg: '電子計測制御 小テスト第2回の受け口です' }); }

/** 送られてきた形を確かめて、シートの1行にする。おかしければ例外 */
function makeRow(d) {
  if (!d || typeof d !== 'object' || d.v !== 1) throw new Error('形がちがいます');
  if (typeof d.sid !== 'string' || !/^[0-9a-z]{12,32}$/.test(d.sid)) throw new Error('提出IDがちがいます');
  if (typeof d.no !== 'string' || !/^\d{4}$/.test(d.no)) throw new Error('出席番号がちがいます');
  if (!Array.isArray(d.ans) || d.ans.length !== Q.length) throw new Error('答えの数がちがいます');
  if (!Number.isInteger(d.auto) || d.auto < 0 || d.auto > AUTO_MAX) throw new Error('点がちがいます');
  const hints = Array.isArray(d.hints) ? [...new Set(d.hints)].filter(n => Number.isInteger(n) && n >= 1 && n <= Q.length).sort((a, b) => a - b) : [];
  const ans = d.ans.map(a => safeText(Array.isArray(a) ? a.map(x => x || '未回答').join(' ／ ') : typeof a === 'string' ? a : ''));
  return [new Date(), "'" + d.no, d.sid, d.demo ? 'デモ' : '', d.auto].concat(ans, [hints.join(',')], TEXTS.map(() => ''));
}

/** 答えを安全な文字列にする：長さを切る・式として読まれないようにする（改行は残す） */
function safeText(t) {
  t = String(t).replace(/\r/g, '').trim().slice(0, TEXT_MAX);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function colName(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
