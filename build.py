# -*- coding: utf-8 -*-
"""配布物を作る。本体は次の3つ。ここから機械的に生成する。

  ラダー工房v2.html   → index.html         （GitHub Pages で配るもの）
  進路シミュレーション.html   → shinro/index.html  （同上。URL を /shinro/ で配るため）
  複線図練習.html     → fukusen/index.html （同上。URL を /fukusen/ で配る）

  python3 build.py                  上の3つを作る
  python3 build.py <出力先.html>    ラダー工房の Artifact 用断片も作る

本体を直したら必ず走らせること。生成物を手で編集してはいけない。
"""
import io, os, sys, shutil

SRC = "ラダー工房v2.html"
SRC2 = "進路シミュレーション.html"
s = io.open(SRC, encoding="utf-8").read()

# 1) GitHub Pages 用。中身は本体そのまま。URL を短くするためだけの複製
shutil.copyfile(SRC, "index.html")
print("生成: index.html")

# 1b) 進路シミュレーション。フォルダに index.html として置き、URL を短くする
os.makedirs("shinro", exist_ok=True)
shutil.copyfile(SRC2, "shinro/index.html")
print("生成: shinro/index.html")

# 1c) 複線図れんしゅう
os.makedirs("fukusen", exist_ok=True)
shutil.copyfile("複線図練習.html", "fukusen/index.html")
print("生成: fukusen/index.html")

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
