# -*- coding: utf-8 -*-
"""教材を直したあとの確かめ。CLAUDE.md の「直したら必ずやる」を機械で確かめる。

  python3 kakunin.py                 変わった本体だけ（git で HEAD と比べる）
  python3 kakunin.py 制御クイズ100.html ...   名前を挙げた本体だけ
  python3 kakunin.py --all           build.py の表 PAGES の全部
  python3 kakunin.py --base origin/main   push の前に、公開中の版と比べる（コミット済みで未 push の直しも見る）
  python3 kakunin.py --quick         確認スクリプトを走らせない（一瞬で終わる。regression-parking3.js は約5分かかる）
  python3 kakunin.py --guard         Claude Code のフック用（下）
  python3 kakunin.py --stop          Claude Code のフック用（下）

本体ごとに見ること：
  NG   配る場所（build.py の生成物）が本体と同じ中身でない → python3 build.py を忘れている
  NG   本体が HEAD から変わったのに VER が同じ           → 版の表示を上げていない
  NG   regression-<フォルダ>.js が不合格                  → 確認スクリプトを直すか、本体を直す
  NG   confirm / alert / prompt・外のフォントや CDN が、HEAD より増えた
  注意 Apps Script やスプレッドシートの URL が、HEAD より増えた（鍵になりうる。剛さんが決めたものだけ）
  注意 ライトモード固定（color-scheme）がない
  聞く 保存の名前（'〇〇-v3' など）が変わった・消えた → 生徒の途中の記録が消える。push の前に剛さんに聞く
  聞く build.py の配る場所が消えた → 配った URL が切れる。push の前に剛さんに聞く
増えたかどうかで見るので、前からある古い教材の違反では止まらない。

--guard：Claude Code の PreToolUse フック。標準入力の JSON を読み、
生成物（<フォルダ>/index.html など）と、引き継ぎ前の授業用 ラダー工房.html への書き込みを止める。

--stop：Claude Code の Stop フック。--quick で見て、NG があれば終わらせずに直させる（終わりのコード 2）。
main の枝で、コミット済みなのに公開していない本体があり、「聞く」もなければ、push させる（push は自動 2026-11-14）。
一度止めたあと（stop_hook_active）は止めない（同じ所で回り続けないため）。

終わりのコード：NG があれば 1、「聞く」だけなら 3、なければ 0。
"""
import io, json, os, re, subprocess, sys

ROOT = os.path.dirname(os.path.abspath(__file__))
os.chdir(ROOT)


def pages():
    """build.py の PAGES を、build.py を走らせずに読む（走らせるとファイルを写してしまう）。"""
    src = io.open("build.py", encoding="utf-8").read()
    block = src[src.index("PAGES = [") : src.index("]\n", src.index("PAGES = ["))]
    return re.findall(r'\(\s*"([^"]+)"\s*,\s*"([^"]+)"', block)


BASE = "HEAD"


def head_text(path):
    r = subprocess.run(["git", "show", BASE + ":" + path], capture_output=True)
    return r.stdout.decode("utf-8", "replace") if r.returncode == 0 else None


def changed_files():
    out = subprocess.run(["git", "status", "--porcelain", "-uall"], capture_output=True, text=True).stdout
    files = subprocess.run(["git", "diff", "--name-only", BASE], capture_output=True, text=True).stdout.split()
    for line in out.splitlines():
        p = line[3:].strip().strip('"')
        if " -> " in p:
            p = p.split(" -> ")[1]
        files.append(p)
    return files


def ver_of(text):
    m = re.search(r"""\bVER\s*=\s*['"]([^'"]+)['"]""", text or "")
    return m.group(1) if m else None


def count(pat, text):
    return len(re.findall(pat, text or ""))


RULES = [  # (名前, 正規表現, NG か 注意か)
    ("confirm / alert / prompt", r"(?<![\w.])(?:window\.)?(?:confirm|alert|prompt)\s*\(", "NG"),
    ("外のフォント・CDN", r"fonts\.googleapis|fonts\.gstatic|<script[^>]+src=[\"']https?://|<link[^>]+href=[\"']https?://", "NG"),
    ("Apps Script・スプレッドシートの URL", r"script\.google\.com/macros|docs\.google\.com/spreadsheets", "注意"),
]


def regression_for(src, dst):
    """配る場所が <フォルダ>/index.html なら regression-<フォルダ>.js、トップなら regression.js。"""
    if os.path.basename(dst) != "index.html":
        return None
    folder = os.path.dirname(dst)
    name = "regression-%s.js" % folder if folder else "regression.js"
    return name if os.path.exists(name) else None


def check(src, dst, results, quick=False):
    def put(kind, msg):
        results.append((kind, src, msg))

    if not os.path.exists(src):
        put("NG", "本体がない")
        return
    now = io.open(src, encoding="utf-8").read()
    old = head_text(src)

    # 1. build.py
    if not os.path.exists(dst) or io.open(dst, "rb").read() != io.open(src, "rb").read():
        put("NG", "配る場所 %s が本体と違う → python3 build.py" % dst)

    # 2. VER
    if old is not None and old != now:
        v_old, v_now = ver_of(old), ver_of(now)
        if v_now is None:
            put("注意", "VER がない（画面右上の版表示）")
        elif v_old == v_now:
            put("NG", "本体を直したのに VER が %s のまま" % v_now)

    # 3. 禁止事項（HEAD より増えたものだけ）
    for name, pat, kind in RULES:
        a, b = count(pat, old), count(pat, now)
        if b > a:
            put(kind, "%s が増えた（%d → %d）" % (name, a, b))
    keys = lambda t: set(re.findall(r"['\"]([\w.-]+-v\d+)['\"]", t or ""))
    gone = keys(old) - keys(now)
    if old is not None and gone:
        put("聞く", "保存の名前が変わった・消えた（%s → %s）。生徒の途中の記録が消える" % ("・".join(sorted(gone)), "・".join(sorted(keys(now) - keys(old))) or "なし"))
    if "color-scheme" not in now:
        put("注意", "ライトモード固定（color-scheme）がない")

    # 4. 確認スクリプト
    reg = None if quick else regression_for(src, dst)
    if reg:
        r = subprocess.run(["node", reg, src], capture_output=True, text=True, timeout=600)
        out = (r.stdout or "") + (r.stderr or "")
        m = re.search(r"合格\s*(\d+)\s*/\s*不合格\s*(\d+)", out)
        ngs = [l.strip() for l in out.splitlines() if l.strip().startswith("NG")]
        if r.returncode != 0 or (m and m.group(2) != "0") or ngs:
            put("NG", "%s が不合格：%s" % (reg, " / ".join(ngs[:5]) or out.strip().splitlines()[-1:]))
        else:
            put("ok", "%s 合格%s" % (reg, "（%s）" % m.group(1) if m else ""))


def guard():
    """PreToolUse フック。生成物への直接の書き込みを止める。"""
    try:
        data = json.load(sys.stdin)
    except Exception:
        return 0
    path = (data.get("tool_input") or {}).get("file_path") or ""
    if not path:
        return 0
    rel = os.path.relpath(os.path.abspath(path), ROOT)
    gen = {dst: src for src, dst in pages()}
    if rel in gen:
        print("%s は build.py の生成物です。本体の %s を直して python3 build.py を走らせてください。" % (rel, gen[rel]), file=sys.stderr)
        return 2
    if rel == "ラダー工房.html":
        print("ラダー工房.html は引き継ぎ前の授業用で、無傷で残す約束です。直すのは ラダー工房v2.html です。", file=sys.stderr)
        return 2
    return 0


def main(argv):
    global BASE
    if "--guard" in argv:
        return guard()
    if "--stop" in argv:
        try:
            if json.load(sys.stdin).get("stop_hook_active"):
                return 0
        except Exception:
            pass
        import contextlib
        buf = io.StringIO()
        with contextlib.redirect_stdout(buf):
            rc = main(["--quick"])
        if rc == 1:
            print("教材の直しが終わっていません。直してから終えてください（naoshi スキルの3章）。\n" + buf.getvalue(), file=sys.stderr)
            return 2
        # push は自動（2026-11-14）。main にコミットしたのに公開していない本体があれば、koukai の手順で出させる。
        # Trinity の worktree の枝（main 以外）では見ない（Trinity が取り込んで公開する）
        branch = subprocess.run(["git", "branch", "--show-current"], capture_output=True, text=True).stdout.strip()
        if branch == "main":
            ahead = subprocess.run(["git", "diff", "--name-only", "origin/main", "HEAD"], capture_output=True, text=True).stdout.split()
            srcs = sorted({s for s, d in pages() if s in ahead or d in ahead})
            if srcs:
                buf = io.StringIO()
                with contextlib.redirect_stdout(buf):
                    rc = main(["--quick", "--base", "origin/main"])
                if rc == 0:
                    print("コミット済みで公開していない教材があります（%s）。push は自動の約束です。koukai スキルの手順で push して、公開ページの版を確かめてください。" % "・".join(srcs), file=sys.stderr)
                    return 2
        return 0
    quick = "--quick" in argv
    if "--base" in argv:
        BASE = argv[argv.index("--base") + 1]
        argv = [a for i, a in enumerate(argv) if not (a == "--base" or (i and argv[i - 1] == "--base"))]
    table = pages()
    by_src = {}
    for src, dst in table:
        by_src.setdefault(src, []).append(dst)

    results = []
    old_build = head_text("build.py")
    if old_build and "PAGES = [" in old_build:
        blk = old_build[old_build.index("PAGES = ["):]
        old_dst = set(re.findall(r'\(\s*"[^"]+"\s*,\s*"([^"]+)"', blk[: blk.index("]\n")]))
        for d in sorted(old_dst - {d for _, d in table}):
            results.append(("聞く", "build.py", "配る場所 %s が表から消えた。配った URL が切れる" % d))

    if "--all" in argv:
        targets = list(by_src)
    elif [a for a in argv if not a.startswith("-")]:
        targets = [a for a in argv if not a.startswith("-")]
    else:
        ch = set(changed_files())
        targets = [s for s in by_src if s in ch or any(d in ch for d in by_src[s])]
        if not targets and not results:
            print("変わった本体はありません（build.py の表 PAGES にある本体だけを見ます）")
            return 0

    for src in targets:
        if src not in by_src:
            results.append(("注意", src, "build.py の表 PAGES にない（新しい教材なら1行足す。README の表にも）"))
            continue
        for dst in by_src[src]:
            check(src, dst, results, quick)

    order = {"NG": 0, "聞く": 1, "注意": 2, "ok": 3}
    for kind, src, msg in sorted(results, key=lambda r: order[r[0]]):
        print("%-4s %s：%s" % (kind, src, msg))
    ng = sum(1 for r in results if r[0] == "NG")
    ask = sum(1 for r in results if r[0] == "聞く")
    print("\nNG %d・聞く %d・注意 %d（本体 %d）" % (ng, ask, sum(1 for r in results if r[0] == "注意"), len(targets)))
    if ask:
        print("「聞く」がある。push の前に剛さんに聞く（自動 push の例外）")
    return 1 if ng else 3 if ask else 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
