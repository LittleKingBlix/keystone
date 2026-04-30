"""
Generate iPhone home-screen icons for Keystone, Direction F (Riso/magazine).
Run from project root:
  /tmp/keystone-venv/bin/python scripts/make_icons.py

Design: cream paper background, big Archivo Black "K·" centered (with the
mid-dot in red), red color-check bar across the bottom. Echoes the magazine
masthead and color-check bar that anchor the in-app design.
"""

from PIL import Image, ImageDraw, ImageFont
import os
import random

PAPER = (244, 238, 224)
INK = (10, 10, 10)
RED = (230, 58, 38)
BLUE = (42, 78, 196)

FONT_PATH = '/tmp/ArchivoBlack-Regular.ttf'

SIZES = [180, 192, 512, 1024]
OUT_DIR = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..')


def add_paper_grain(img, intensity=10, density_div=40):
    random.seed(7)
    w, h = img.size
    px = img.load()
    for _ in range(w * h // density_div):
        x = random.randint(0, w - 1)
        y = random.randint(0, h - 1)
        shade = random.randint(0, intensity)
        c = px[x, y]
        px[x, y] = tuple(max(0, v - shade) for v in c[:3])


def make_icon(size):
    img = Image.new('RGB', (size, size), PAPER)
    draw = ImageDraw.Draw(img)

    # Layout
    bar_h = max(6, size // 16)         # bottom red color-check bar
    pad = max(8, size // 40)           # outer padding
    rule_y = pad + max(2, size // 200) * 4  # thin top rule like a masthead

    # Top rule (ink hairline)
    draw.rectangle([pad, rule_y, size - pad, rule_y + max(2, size // 200)], fill=INK)

    # Big "K" in Archivo Black, centered above the bar
    target_h = size - bar_h - pad - rule_y - pad
    font_size = int(target_h * 0.95)
    font = ImageFont.truetype(FONT_PATH, font_size)

    # Compose "K·" — K in ink, dot in red, side by side
    k_text = "K"
    dot_text = "·"

    k_bbox = draw.textbbox((0, 0), k_text, font=font)
    d_bbox = draw.textbbox((0, 0), dot_text, font=font)
    k_w = k_bbox[2] - k_bbox[0]
    k_h = k_bbox[3] - k_bbox[1]
    d_w = d_bbox[2] - d_bbox[0]
    d_h = d_bbox[3] - d_bbox[1]

    gap = max(2, size // 60)
    total_w = k_w + gap + d_w
    start_x = (size - total_w) // 2 - k_bbox[0]
    base_y = rule_y + (target_h - k_h) // 2 - k_bbox[1] + pad // 2

    draw.text((start_x, base_y), k_text, font=font, fill=INK)
    # Dot positioned at K's baseline, slightly raised (like a typographic mid-dot)
    dot_y = base_y + int(k_h * 0.35)
    draw.text((start_x + k_w + gap, dot_y), dot_text, font=font, fill=RED)

    # Color-check bar: 8 segments along the bottom
    seg_w = (size - pad * 2) / 8
    bar_y0 = size - pad - bar_h
    bar_y1 = size - pad
    # Black underline divider above the bar
    draw.rectangle([pad, bar_y0 - max(2, size // 250), size - pad, bar_y0], fill=INK)
    for i in range(8):
        x0 = int(pad + seg_w * i)
        x1 = int(pad + seg_w * (i + 1))
        # Alternate filled/not for a printer's color-check feel
        # but bias toward filled so the icon reads as "on a streak"
        fill = RED if i < 6 else PAPER
        draw.rectangle([x0, bar_y0, x1, bar_y1], fill=fill, outline=INK, width=max(1, size // 400))

    # Tiny blue registration dot in top-right (riso accent)
    dot_r = max(3, size // 60)
    draw.ellipse(
        [size - pad - dot_r * 2, pad, size - pad, pad + dot_r * 2],
        fill=BLUE
    )

    add_paper_grain(img)
    return img


def main():
    if not os.path.exists(FONT_PATH):
        raise SystemExit(f'Missing font: {FONT_PATH}. Run: curl -sL -o {FONT_PATH} https://github.com/google/fonts/raw/main/ofl/archivoblack/ArchivoBlack-Regular.ttf')
    for sz in SIZES:
        img = make_icon(sz)
        out = os.path.join(OUT_DIR, f'icon-{sz}.png')
        img.save(out, 'PNG', optimize=True)
        kb = os.path.getsize(out) // 1024
        print(f'Wrote {out} ({sz}x{sz}, {kb}KB)')


if __name__ == '__main__':
    main()
