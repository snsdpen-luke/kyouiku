"""技能筆記練習.html の図を、令和8年度 第二種 技能試験の公表問題・解答の PDF から作る。
   使い方: python3 tools/mkfig-ginou.py <PDF のフォルダ> <出力>
   出力が .html なら、その中の1行「const FIGS = …;」を書きかえる（技能筆記練習.html）。.json なら JSON だけ書く
   PDF は電気技術者試験センターの公表のもの（20260719_co_second_q01.pdf … a13.pdf）。repo には入れない。
   - tan<n>  : 問題 PDF の 2 ページ目の単線図
   - fk<n>w  : 解答 PDF の 2 ページ目の複線図に、誤りを1か所入れ、候補の箇所に番号を付けたもの（生徒に見せる）
   - fk<n>ok : 誤りを入れない複線図に、同じ番号と、正解の箇所の黄色い印を付けたもの（答え合わせ）
   ヒントの注記（「受金ねじ部の端子に白」など）は消す。色と端子番号の文字は、書きかえた1字が目立たないよう全部同じ字体で描き直す。
   座標は 200dpi で描いた複線図（クリップの左上が原点）の画素。"""
import fitz, json, sys, base64, os
FONT = "/System/Library/Fonts/ヒラギノ明朝 ProN.ttc"
K = 72 / 200
HINT = ["端子に白", "受金ねじ部", "の端子に白", "わたり線", "は黒", "は白", "に緑", "W側端子", "表示側に白", "Nの表示側"]
RELAB = set("白黒赤緑0123")
SPEC = {
  1: {"arrows": [[235, 80, 372, 195], [690, 75, 790, 175], [255, 675, 338, 805]],
      "edit": [("text", (771, 125), "黒")],
      "cand": [(347, 125), (445, 125), (771, 125), (850, 125), (85, 355), (320, 580), (768, 645), (862, 645)], "ans": (771, 125)},
  2: {"arrows": [[195, 75, 310, 95], [525, 52, 592, 68], [715, 545, 780, 590], [385, 585, 402, 655]],
      "edit": [("dot", (660, 308), (660, 277))],
      "cand": [(321, 277), (352, 308), (321, 355), (608, 355), (660, 277), (705, 277)], "ans": (660, 277), "dotc": True},
  3: {"arrows": [[680, 200, 735, 262], [735, 350, 765, 410], [362, 735, 388, 805], [525, 600, 580, 712]],
      "edit": [("text", (493, 262), "黒")],
      "cand": [(40, 150), (178, 150), (385, 262), (493, 262), (640, 128), (640, 180), (682, 400), (440, 650)], "ans": (493, 262)},
  4: {"arrows": [[148, 30, 215, 92], [105, 385, 205, 405], [600, 280, 690, 380], [650, 445, 725, 555], [825, 500, 845, 580]],
      "edit": [("text", (200, 293), "黒")],
      "cand": [(205, 75), (205, 130), (205, 185), (205, 240), (200, 293), (213, 365), (575, 245), (853, 318)], "ans": (200, 293)},
  6: {"arrows": [[405, 112, 475, 160], [850, 105, 905, 160]],
      "edit": [("swap", (828, 685), (783, 712))],
      "cand": [(320, 160), (420, 160), (255, 425), (783, 232), (868, 232), (1020, 428), (825, 578), (805, 698)], "ans": (805, 698), "free": [(805, 698)]},
  9: {"arrows": [[150, 85, 195, 115], [635, 245, 715, 305], [535, 592, 615, 625]],
      "edit": [("text", (793, 485), "白")],
      "cand": [(62, 225), (160, 225), (407, 107), (500, 107), (560, 327), (730, 155), (793, 485), (500, 562)], "ans": (793, 485)},
  10: {"arrows": [[385, 80, 465, 145], [755, 205, 795, 278], [365, 602, 420, 618], [585, 620, 625, 638], [595, 685, 665, 745]],
       "edit": [("swap", (245, 262), (245, 352))],
       "cand": [(245, 262), (440, 163), (585, 163), (710, 262), (710, 350), (418, 463), (485, 463), (585, 463)], "ans": (245, 262)},
  11: {"arrows": [[585, 35, 645, 95], [155, 345, 228, 370], [320, 572, 352, 588], [505, 622, 605, 640]],
       "edit": [("text", (530, 510), "黒")],
       "cand": [(190, 78), (190, 155), (572, 78), (215, 262), (298, 262), (363, 292), (448, 432), (530, 510)], "ans": (530, 510)},
  12: {"arrows": [[165, 75, 210, 100], [80, 565, 210, 642], [1032, 245, 1048, 278], [990, 410, 1015, 500]],
       "edit": [("text", (570, 632), "白")],
       "cand": [(193, 240), (278, 240), (570, 85), (690, 85), (820, 368), (193, 598), (570, 632), (688, 632)], "ans": (570, 632)},
  13: {"arrows": [[380, 90, 435, 140], [335, 725, 355, 780], [460, 575, 500, 610], [535, 615, 560, 695]],
       "edit": [("text", (718, 383), "黒")],
       "cand": [(40, 130), (175, 130), (415, 180), (510, 180), (718, 343), (718, 383), (315, 642), (570, 800)], "ans": (718, 383)},
}
def clipof(p):
    bl = p.get_text("blocks")
    ys = [b[1] for b in bl if ("正解の例" in b[4] or b[4].startswith("（注）"))]
    y1 = min(ys) - 4 if ys else p.rect.y1 - 30
    r = None
    for d in p.get_drawings():
        R = d["rect"]
        if R.y0 > 70 and R.y1 < y1 and R.width < 480: r = R if r is None else r | R
    for b in bl:
        R = fitz.Rect(b[:4])
        if R.y0 > 70 and R.y1 < y1 and R.width < 300: r = r | R
    return fitz.Rect(r.x0 - 5, r.y0 - 5, r.x1 + 5, r.y1 + 5)
def tanclip(p):
    bl = p.get_text("blocks")
    y_note = min([b[1] for b in bl if "注" in b[4][:3]] or [p.rect.y1 - 60])
    y_top = max([b[3] for b in bl if "作品は保護板" in b[4] or "省略する。" in b[4]] or [150])
    r = None
    for R in [d["rect"] for d in p.get_drawings()] + [fitz.Rect(b[:4]) for b in bl]:
        if R.y0 > y_top + 2 and R.y1 < y_note - 2 and R.width < 480 and R.x0 > 20 and R.x1 < 575: r = R if r is None else r | R
    return fitz.Rect(r.x0 - 6, r.y0 - 6, r.x1 + 6, r.y1 + 6)
def png(p, clip, dpi):
    pix = p.get_pixmap(dpi=dpi, clip=clip)
    return "data:image/png;base64," + base64.b64encode(pix.tobytes("png")).decode()
def build(pdfdir, n, wrong):
    S = SPEC[n]; doc = fitz.open(os.path.join(pdfdir, f"20260719_co_second_a{n:02d}.pdf")); p = doc[1]
    clip = clipof(p); P = lambda xy: fitz.Point(clip.x0 + xy[0] * K, clip.y0 + xy[1] * K)
    words = p.get_text("words")
    near = lambda xy: min((w for w in words if w[4] in RELAB), key=lambda w: (w[0] + w[2]) / 2 - P(xy).x if False else ((w[0] + w[2]) / 2 - P(xy).x) ** 2 + ((w[1] + w[3]) / 2 - P(xy).y) ** 2)
    # 1) ヒントの文字を消し、色・端子番号の文字も一度消す（あとで同じ字体で描き直す）
    relab = [w for w in words if w[4] in RELAB and clip.contains(fitz.Rect(w[:4]))]
    new = {i: w[4] for i, w in enumerate(relab)}
    if wrong:
        for e in S["edit"]:
            if e[0] == "text": new[relab.index(near(e[1]))] = e[2]
            if e[0] == "swap":
                a, b = relab.index(near(e[1])), relab.index(near(e[2])); new[a], new[b] = relab[b][4], relab[a][4]
    for w in words:
        if any(h in w[4] for h in HINT) or w in relab: p.add_redact_annot(fitz.Rect(w[:4]), fill=False)
    p.apply_redactions(images=0, graphics=0)
    # 2) ヒントの矢印（線だけ。囲みにすっぽり入るものだけ消える）
    for a in S["arrows"]: p.add_redact_annot(fitz.Rect(P(a[:2]), P(a[2:])), fill=False)
    if wrong:
        for e in S["edit"]:
            if e[0] == "dot": c = P(e[1]); p.add_redact_annot(fitz.Rect(c.x - 3.2, c.y - 3.2, c.x + 3.2, c.y + 3.2), fill=False)
    p.apply_redactions(images=0, graphics=1, text=1)   # graphics=1: 囲みにすっぽり入る線だけ消す / text=1: 文字は残す
    if wrong:
        for e in S["edit"]:
            if e[0] == "dot": p.draw_circle(P(e[2]), 2.3, color=None, fill=(0, 0, 0))
    for i, w in enumerate(relab):
        p.insert_text((w[0], w[3] - 1.3), new[i], fontname="hmin", fontfile=FONT, fontsize=(w[3] - w[1]))
    # 3) 番号。読む順（上から、左から）に振る
    cand = sorted(S["cand"], key=lambda c: (round(c[1] / 40), c[0]))
    ans = cand.index(S["ans"]) + 1
    for k, c in enumerate(cand):
        if S.get("dotc"): q = P((c[0] + 22, c[1] - 20))
        elif c in S.get("free", []): q = P((c[0] + 48, c[1] - 34))
        else: q = P((c[0] - 26, c[1] - 2))
        if not wrong and k + 1 == ans: p.draw_circle(q, 9.5, color=None, fill=(1, 0.86, 0.1))
        p.draw_circle(q, 5.6, color=(0.75, 0.05, 0.05), fill=(1, 1, 1), width=0.9)
        tw = fitz.get_text_length(str(k + 1), fontname="helv", fontsize=7.5)
        p.insert_text((q.x - tw / 2, q.y + 2.7), str(k + 1), fontname="hebo", fontsize=7.5, color=(0.75, 0.05, 0.05))
    return png(p, clip, 150), len(cand), ans
if __name__ == "__main__":
    pdfdir, out = sys.argv[1], sys.argv[2]; R = {}
    for n in range(1, 14):
        p = fitz.open(os.path.join(pdfdir, f"20260719_co_second_q{n:02d}.pdf"))[1]
        R[f"tan{n}"] = png(p, tanclip(p), 110)
    for n in SPEC:
        R[f"fk{n}w"], cnt, ans = build(pdfdir, n, True)
        R[f"fk{n}ok"], cnt2, ans2 = build(pdfdir, n, False)
        assert cnt == cnt2 and ans == ans2
        R[f"fk{n}meta"] = {"n": cnt, "ans": ans}
    if out.endswith(".html"):
        h = open(out, encoding="utf-8").read().split("\n")
        i = [k for k, l in enumerate(h) if l.startswith("const FIGS = ")]
        assert len(i) == 1, "const FIGS = の行が1つではない"
        h[i[0]] = "const FIGS = " + json.dumps(R, ensure_ascii=False, separators=(",", ":")) + ";   // tools/mkfig-ginou.py が作る。手で直さない"
        open(out, "w", encoding="utf-8").write("\n".join(h))
    else: json.dump(R, open(out, "w"))
    print({k: (len(v) if isinstance(v, str) else v) for k, v in R.items()}, sum(len(v) for v in R.values() if isinstance(v, str)))
