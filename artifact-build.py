# -*- coding: utf-8 -*-
"""ラダー工房v2.html を Artifact 用の断片に変換する。
   Artifact は <!DOCTYPE>/<html>/<head>/<body> を自前で付けるので、それらを剥がす。
   使い方: python3 artifact-build.py <出力先>"""
import io, re, sys

SRC = "ラダー工房v2.html"
OUT = sys.argv[1] if len(sys.argv) > 1 else "artifact.html"

s = io.open(SRC, encoding="utf-8").read()

style = s[s.index("<style>") : s.index("</style>") + len("</style>")]
body  = s[s.index("<body>") + len("<body>") : s.rindex("</body>")]

# 入力欄などをライトのまま描かせる（この教材はベージュ固定の配色）
style = style.replace(":root{\n", ":root{\n  color-scheme:light;\n", 1)
assert "color-scheme:light" in style, "color-scheme の差し込みに失敗"

out = "<title>ラダー工房</title>\n" + style + "\n" + body.strip() + "\n"

for tag in ("<!DOCTYPE", "<html", "</html>", "<head>", "</head>", "<body>", "</body>"):
    assert tag not in out, "剥がし残し: " + tag

io.open(OUT, "w", encoding="utf-8").write(out)
print("生成: %s  (%d KB)" % (OUT, len(out.encode("utf-8")) // 1024))
