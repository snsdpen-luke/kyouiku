/**
 * Classroom へ教材のリンクを「資料」として載せる受け口。
 * 剛さんの学校の Google アカウントの Apps Script に、このファイルの中身をそのまま貼る。手順は同じフォルダの README-Classroom.md。
 *
 * - 呼ぶのは AI（crocky）の手元の classroom.mjs だけ。合言葉（KEY）が合わなければ何もしない
 * - 載せられるのは kyouiku の教材の URL（https://snsdpen-luke.github.io/kyouiku/…）だけ。合言葉が漏れても、ほかの物は載らない
 * - 既定は「下書き」。生徒に出すのは、剛さんが Classroom で「投稿」を押したとき（publish:true のときだけ、すぐ出す）
 * - 同じ URL の資料がもうそのクラスにあれば、二重に載せない
 * - 生徒の名前・成績には触れない（クラスの一覧と、資料を作る権限だけ使う）
 */
const ALLOWED = 'https://snsdpen-luke.github.io/kyouiku/';

/** 最初に1回だけ実行する。合言葉を作って、実行ログに出す（控えて classroom.mjs の setup に渡す）。 */
function setup() {
  const p = PropertiesService.getScriptProperties();
  let key = p.getProperty('KEY');
  if (!key) {
    key = Utilities.getUuid().replace(/-/g, '') + Utilities.getUuid().replace(/-/g, '');
    p.setProperty('KEY', key);
  }
  // Classroom を1回呼んで、権限の確認を出させる
  const n = (Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'] }).courses || []).length;
  Logger.log('合言葉（KEY）: ' + key);
  Logger.log('受け持っているクラス: ' + n);
}

/** 合言葉を作り直す（漏れたかもしれないとき）。作り直したら classroom.mjs の setup もやり直す。 */
function resetKey() {
  PropertiesService.getScriptProperties().deleteProperty('KEY');
  setup();
}

function doGet() {
  return out({ ok: true, msg: 'Classroom 投稿の受け口です（POST で使う）' });
}

function doPost(e) {
  let req;
  try { req = JSON.parse(e.postData.contents); } catch (err) { return out({ ok: false, err: 'JSON ではない' }); }
  const key = PropertiesService.getScriptProperties().getProperty('KEY');
  if (!key || typeof req.key !== 'string' || req.key !== key) return out({ ok: false, err: '合言葉がちがう' });
  try {
    if (req.action === 'courses') return out({ ok: true, courses: courses() });
    if (req.action === 'post') return out(post(req));
    return out({ ok: false, err: '知らない action: ' + req.action });
  } catch (err) {
    return out({ ok: false, err: String(err && err.message || err) });
  }
}

function courses() {
  const list = [];
  let token;
  do {
    const r = Classroom.Courses.list({ teacherId: 'me', courseStates: ['ACTIVE'], pageToken: token });
    (r.courses || []).forEach(c => list.push({ id: c.id, name: c.name, section: c.section || '' }));
    token = r.nextPageToken;
  } while (token);
  return list;
}

function post(req) {
  const courseId = String(req.courseId || '');
  const url = String(req.url || '');
  const title = String(req.title || '').slice(0, 200);
  if (!courseId || !title) return { ok: false, err: 'courseId と title が要る' };
  if (url.indexOf(ALLOWED) !== 0 || /[\s"<>]/.test(url)) return { ok: false, err: 'kyouiku の教材の URL だけ載せられる: ' + url };

  // 同じ URL がもう載っていれば、載せない（下書きも見る）
  let token;
  do {
    const r = Classroom.Courses.CourseWorkMaterials.list(courseId, { courseWorkMaterialStates: ['PUBLISHED', 'DRAFT'], pageToken: token });
    const hit = (r.courseWorkMaterial || []).find(m => (m.materials || []).some(x => x.link && x.link.url === url));
    if (hit) return { ok: true, dup: true, state: hit.state, link: hit.alternateLink, title: hit.title };
    token = r.nextPageToken;
  } while (token);

  const m = Classroom.Courses.CourseWorkMaterials.create({
    title: title,
    description: String(req.description || '').slice(0, 2000),
    materials: [{ link: { url: url } }],
    state: req.publish === true ? 'PUBLISHED' : 'DRAFT',
  }, courseId);
  return { ok: true, dup: false, state: m.state, link: m.alternateLink, title: m.title };
}

function out(o) {
  return ContentService.createTextOutput(JSON.stringify(o)).setMimeType(ContentService.MimeType.JSON);
}
