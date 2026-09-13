# -*- coding: utf-8 -*-
"""配布物を作る。本体は ラダー工房v2.html ただ1つ。ここから機械的に生成する。

  python3 build.py                  index.html を作る（GitHub Pages で配るもの）
  python3 build.py <出力先.html>    Artifact 用の断片も作る

本体を直したら必ず走らせること。生成物を手で編集してはいけない。
"""
import io, sys, shutil

SRC = "ラダー工房v2.html"
s = io.open(SRC, encoding="utf-8").read()

# 1) GitHub Pages 用。中身は本体そのまま。URL を短くするためだけの複製
shutil.copyfile(SRC, "index.html")
print("生成: index.html")

# 2) Artifact 用。<!DOCTYPE>/<html>/<head>/<body> は claude.ai 側が付けるので剥がす
if len(sys.argv) > 1:
    out = sys.argv[1]
    style = s[s.index("<style>") : s.index("</style>") + len("</style>")]
    body  = s[s.index("<body>") + len("<body>") : s.rindex("</body>")]
    style = style.replace(":root{\n", ":root{\n  color-scheme:light;\n", 1)
    assert "color-scheme:light" in style, "color-scheme の差し込みに失敗"
    frag = "<title>ラダー工房</title>\n" + style + "\n" + body.strip() + "\n"
    for tag in ("<!DOCTYPE", "<html", "</html>", "<head>", "</head>", "<body>", "</body>"):
        assert tag not in frag, "剥がし残し: " + tag
    io.open(out, "w", encoding="utf-8").write(frag)
    print("生成: %s  (%d KB)" % (out, len(frag.encode("utf-8")) // 1024))
