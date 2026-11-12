/**
 * わからないところアンケート（ふりかえり演習 /review1/）の受け口。
 * スプレッドシートに付けた Apps Script に、このファイルの中身をそのまま貼る。手順は同じフォルダの README.md。
 *
 * - 無記名。受け取るのは「回答ID（端末で作るでたらめな文字）・選んだ項目の番号・ひとこと」だけ
 * - 同じ回答IDは1行にしかならない（通信が切れて送り直しても、二重に数えない）
 * - 受け口の URL は公開ページに載るので、だれでも送れてしまう。形のおかしいものは捨てる
 * - ITEMS の並びは、アプリ（ふりかえり演習.html の ASK）と同じ。番号を変えない。足すときは最後に足す
 */
const ITEMS = [
  'パケットに分けて送る（パケットの数・バイトの計算）',
  'ヘッダ（宛先・送信元・番号）',
  'IPアドレスと DNS',
  'ルーターと TTL',
  'NAT（家の中の住所と外向きの住所）',
  'TCP と UDP・ACK と再送',
  'bps とバイトの計算（Mbps・MB・秒）',
  '回線を分け合う・ボトルネック',
  '画質（解像度・fps）と必要な速さ',
  'ギガ（データ量）の計算と節約',
  'ping・バッファ・キャッシュ',
  '減衰（距離や壁で電波が弱くなる）',
  '「半分」をくり返す計算（距離と強さ）',
  '2.4GHz帯と5GHz帯のちがい',
  '干渉',
  '中継器を置く場所',
  '組み合わせの数・総当たりの時間の計算',
  '辞書攻撃とロック',
  '本人確認の3種類・二要素認証',
  'フィッシング（偽サイト・偽メール）',
  'ハッシュとパスキー',
  '前払い・即時払い・後払い（お金が減るとき）',
  'ICカード型とサーバ型（残高はどこにある）',
  'コード決済の2つの方式',
  'クレジットカードの流れ（オーソリ・手数料・不正検知）',
  '集中処理と分散処理',
  'ブロックチェーン（指紋でつなぐ）',
  'マイニングとナンス',
  '二重払いと残高のチェック',
  '書きかえがばれるしくみ',
  '秘密鍵・ビットコインの弱点',
];
const ANSWERS = '回答';
const SUMMARY = '集計';
const MEMO_MAX = 200;
const FIRST_ITEM_COL = 4; // A 受付日時・B 回答ID・C 選んだ項目・D から項目ごとの列

/** 最初に1回だけ実行する。「回答」と「集計」のシートを作る（「回答」に行があるときは何もしない） */
function setup() {
  const ss = SpreadsheetApp.getActiveSpreadsheet();
  const ans = ss.getSheetByName(ANSWERS) || ss.insertSheet(ANSWERS);
  if (ans.getLastRow() > 1) throw new Error('「回答」にもう回答が入っています。消してよければ、シートごと消してから実行してください。');
  ans.clear();
  const head = ['受付日時', '回答ID', '選んだ項目'].concat(ITEMS.map((t, i) => (i + 1) + ' ' + t), ['ほかにわからないこと・質問']);
  ans.getRange(1, 1, 1, head.length).setValues([head]).setFontWeight('bold');
  ans.setFrozenRows(1);
  const sum = ss.getSheetByName(SUMMARY) || ss.insertSheet(SUMMARY);
  sum.clear();
  const rows = [['番号', '項目', '人数', '割合']].concat(ITEMS.map((t, i) => {
    const col = colName(FIRST_ITEM_COL + i), r = i + 2;
    return [i + 1, t, `=COUNTIF('${ANSWERS}'!${col}2:${col},1)`, `=IFERROR(C${r}/COUNTA('${ANSWERS}'!B2:B),0)`];
  }));
  sum.getRange(1, 1, rows.length, 4).setValues(rows);
  sum.getRange(1, 1, 1, 4).setFontWeight('bold');
  sum.getRange(2, 4, ITEMS.length, 1).setNumberFormat('0%');
  sum.getRange(1, 6, 1, 2).setValues([['回答数', `=COUNTA('${ANSWERS}'!B2:B)`]]);
  sum.setFrozenRows(1);
}

/** アプリから送られてくる回答を1行足す */
function doPost(e) {
  try {
    const d = JSON.parse((e && e.postData && e.postData.contents) || '{}');
    const row = makeRow(d);
    const lock = LockService.getScriptLock();
    lock.waitLock(20000); // 40人が同時に送っても順に書く
    try {
      const sh = SpreadsheetApp.getActiveSpreadsheet().getSheetByName(ANSWERS);
      if (!sh) return out({ ok: false, error: '集計の準備（setup）がまだです' });
      const last = sh.getLastRow();
      const dup = last > 1 && sh.getRange(2, 2, last - 1, 1).createTextFinder(d.rid).matchEntireCell(true).findNext();
      if (!dup) sh.appendRow(row);
      return out({ ok: true, dup: !!dup });
    } finally { lock.releaseLock(); }
  } catch (err) {
    return out({ ok: false, error: String(err && err.message || err).slice(0, 80) });
  }
}

/** ブラウザで URL を開いたときの返事（受け口が動いているかの確認用） */
function doGet() { return out({ ok: true, msg: 'わからないところアンケートの受け口です' }); }

/** 送られてきた形を確かめて、シートの1行にする。おかしければ例外 */
function makeRow(d) {
  if (!d || typeof d !== 'object') throw new Error('形がちがいます');
  if (typeof d.rid !== 'string' || !/^[0-9a-z]{12,32}$/.test(d.rid)) throw new Error('回答IDがちがいます');
  if (!Array.isArray(d.items) || d.items.length > ITEMS.length) throw new Error('項目がちがいます');
  const items = [...new Set(d.items)];
  if (items.some(n => !Number.isInteger(n) || n < 1 || n > ITEMS.length)) throw new Error('項目の番号がちがいます');
  items.sort((a, b) => a - b);
  const memo = safeText(typeof d.memo === 'string' ? d.memo : '');
  return [new Date(), d.rid, items.join(',') || 'なし'].concat(ITEMS.map((_, i) => items.includes(i + 1) ? 1 : ''), [memo]);
}

/** ひとことを安全な文字列にする：改行を空白に・長さを切る・式として読まれないようにする */
function safeText(t) {
  t = String(t).replace(/[\r\n\t]+/g, ' ').trim().slice(0, MEMO_MAX);
  return /^[=+\-@]/.test(t) ? "'" + t : t;
}

function colName(n) { let s = ''; while (n > 0) { const m = (n - 1) % 26; s = String.fromCharCode(65 + m) + s; n = Math.floor((n - 1) / 26); } return s; }
function out(o) { return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON); }
