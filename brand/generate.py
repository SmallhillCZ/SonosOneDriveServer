import argparse
import pathlib

import cairosvg
from fontTools.pens.svgPathPen import SVGPathPen
from fontTools.pens.transformPen import TransformPen
from fontTools.ttLib import TTFont

BACKGROUND = "#3346C2"
INK = "#1B2559"
WHITE = "#FFFFFF"
FONT = "/usr/share/fonts/opentype/inter/Inter-Bold.otf"

CLOUD = [
    ("M", (22, 74)),
    ("H", 78),
    ("A", (15, 15, 0, 0, 0, 80.5, 44.4)),
    ("A", (21, 21, 0, 0, 0, 41.5, 33.5)),
    ("A", (14, 14, 0, 0, 0, 22.5, 46.2)),
    ("A", (14, 14, 0, 0, 0, 22, 74)),
    ("Z", None),
]
NOTE = [
    ("M", (49, 40)),
    ("H", 54),
    ("C", (56, 45, 63.5, 46, 62.5, 55)),
    ("C", (60.5, 50.5, 57.5, 49.5, 54, 49.5)),
    ("V", 64),
    ("A", (6.5, 6.5, 0, 1, 1, 49, 57.6)),
    ("Z", None),
]


def path_data(commands, scale, dx, dy):
    out = []
    for command, value in commands:
        if command in ("M", "L"):
            out.append(f"{command}{fmt(value[0] * scale + dx)} {fmt(value[1] * scale + dy)}")
        elif command == "H":
            out.append(f"H{fmt(value * scale + dx)}")
        elif command == "V":
            out.append(f"V{fmt(value * scale + dy)}")
        elif command == "C":
            pts = [fmt(v * scale + (dx if i % 2 == 0 else dy)) for i, v in enumerate(value)]
            out.append("C" + " ".join(pts))
        elif command == "A":
            rx, ry, rot, large, sweep, x, y = value
            out.append(
                f"A{fmt(rx * scale)} {fmt(ry * scale)} {rot} {large} {sweep} {fmt(x * scale + dx)} {fmt(y * scale + dy)}"
            )
        else:
            out.append("Z")
    return "".join(out)


def fmt(value):
    return f"{value:.2f}".rstrip("0").rstrip(".")


CLOUD_BOX = (9.9, 23.3, 92.2, 74)


def glyph_mark(width, cx, cy):
    scale = width / (CLOUD_BOX[2] - CLOUD_BOX[0])
    dx = cx - (CLOUD_BOX[0] + CLOUD_BOX[2]) / 2 * scale
    dy = cy - (CLOUD_BOX[1] + CLOUD_BOX[3]) / 2 * scale
    return path_data(CLOUD, scale, dx, dy) + path_data(NOTE, scale, dx, dy)


def wordmark(text, cap_height, dx, baseline):
    font = TTFont(FONT)
    glyph_set = font.getGlyphSet()
    cmap = font.getBestCmap()
    scale = cap_height / font["OS/2"].sCapHeight
    pen = SVGPathPen(glyph_set)
    x = 0
    for char in text:
        name = cmap[ord(char)]
        glyph_set[name].draw(TransformPen(pen, (scale, 0, 0, -scale, dx + x * scale, baseline)))
        x += glyph_set[name].width
    return pen.getCommands(), x * scale


def svg(width, height, body):
    return (
        '<?xml version="1.0" encoding="UTF-8"?>\n'
        f'<svg xmlns="http://www.w3.org/2000/svg" version="1.1" baseProfile="basic" '
        f'width="{fmt(width)}" height="{fmt(height)}" viewBox="0 0 {fmt(width)} {fmt(height)}">\n'
        f"{body}\n</svg>\n"
    )


def service_logo(size):
    return svg(
        size,
        size,
        f'<rect x="0" y="0" width="{size}" height="{size}" fill="{BACKGROUND}"/>\n'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{glyph_mark(size * 0.72, size / 2, size / 2)}"/>',
    )


def badge():
    return svg(40, 40, f'<path fill="{WHITE}" fill-rule="evenodd" d="{glyph_mark(38, 20, 20)}"/>')


def full_logo(text):
    height = 20
    icon = 30
    gap = 6
    words, words_width = wordmark(text, 13, icon + gap, 16.5)
    width = icon + gap + words_width
    if width > 180:
        raise SystemExit(f"Full logo is {width:.1f}px wide, Sonos allows at most 180px. Use a shorter wordmark.")
    body = (
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{glyph_mark(icon, icon / 2, height / 2)}"/>\n'
        f'<path fill="{WHITE}" d="{words}"/>'
    )
    return svg(width, height, body)


def banner(text):
    height = 200
    tile = 120
    margin = 40
    gap = 32
    words, words_width = wordmark(text, 56, margin + tile + gap, 128)
    width = min(800, margin + tile + gap + words_width + margin)
    if margin + tile + gap + words_width + margin > 800:
        raise SystemExit("Banner wordmark is wider than 800px. Use a shorter wordmark.")
    body = (
        f'<rect x="0" y="0" width="{fmt(width)}" height="{height}" fill="{WHITE}"/>\n'
        f'<rect x="{margin}" y="{(height - tile) // 2}" width="{tile}" height="{tile}" fill="{BACKGROUND}"/>\n'
        f'<path fill="{WHITE}" fill-rule="evenodd" d="{glyph_mark(tile * 0.72, margin + tile / 2, height / 2)}"/>\n'
        f'<path fill="{INK}" d="{words}"/>'
    )
    return svg(width, height, body)


def main():
    parser = argparse.ArgumentParser()
    parser.add_argument("--wordmark", default="Cloud Music")
    parser.add_argument("--out", default=str(pathlib.Path(__file__).parent / "assets"))
    args = parser.parse_args()

    out = pathlib.Path(args.out)
    (out / "service-logo").mkdir(parents=True, exist_ok=True)

    for size in (40, 400):
        (out / "service-logo" / f"service-logo-{size}.svg").write_text(service_logo(size))
    for size in (20, 40, 80, 112, 200, 400):
        cairosvg.svg2png(
            bytestring=service_logo(400).encode(),
            write_to=str(out / "service-logo" / f"service-logo-{size}.png"),
            output_width=size,
            output_height=size,
            dpi=72,
        )

    (out / "full-logo.svg").write_text(full_logo(args.wordmark))
    (out / "badge.svg").write_text(badge())
    (out / "support-banner.svg").write_text(banner(args.wordmark))
    cairosvg.svg2png(bytestring=banner(args.wordmark).encode(), write_to=str(out / "support-banner.png"), dpi=72)


if __name__ == "__main__":
    main()
