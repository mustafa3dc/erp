#!/usr/bin/env python3
import os
import zlib
import struct
import math

def create_png(width, height, get_pixel, filename):
    raw = bytearray()
    for y in range(height):
        raw.append(0)
        for x in range(width):
            r, g, b, a = get_pixel(x, y)
            raw.extend([int(r), int(g), int(b), int(a)])
    compressed = zlib.compress(bytes(raw), level=9)
    def chunk(tag, data):
        crc = zlib.crc32(tag + data) & 0xffffffff
        return struct.pack(">I", len(data)) + tag + data + struct.pack(">I", crc)
    ihdr = struct.pack(">IIBBBBB", width, height, 8, 6, 0, 0, 0)
    png = b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", ihdr) + chunk(b"IDAT", compressed) + chunk(b"IEND", b"")
    with open(filename, "wb") as f:
        f.write(png)

def sd_rounded_box(px, py, bx, by, r):
    qx = abs(px) - bx + r
    qy = abs(py) - by + r
    ax = max(qx, 0.0)
    ay = max(qy, 0.0)
    return min(max(qx, qy), 0.0) + math.sqrt(ax*ax + ay*ay) - r

def make_icon_renderer(size):
    padding = size * 0.04
    sq_size = (size - 2 * padding) / 2.0
    sq_center_x = size / 2.0
    sq_center_y = size / 2.0
    sq_radius = sq_size * 0.44

    b_w = size * 0.28   # half width of briefcase body
    b_h = size * 0.18   # half height of briefcase body
    b_cy = size * 0.53  # vertical center
    b_r = size * 0.045  # corner radius
    thick = size * 0.042 # line thickness

    h_w = size * 0.11   # half width of handle
    h_h = size * 0.065  # half height of handle
    h_cy = b_cy - b_h - h_h * 0.35
    h_r = size * 0.025

    # Brand color: Indigo #4f46e5
    brand_r, brand_g, brand_b = 79, 70, 229

    def get_pixel(x, y):
        # 4x super-sampling for pristine Retina smoothness
        total_r = total_g = total_b = total_a = 0.0
        samples = [(-0.3, -0.3), (0.3, -0.3), (-0.3, 0.3), (0.3, 0.3)]
        
        for sx, sy in samples:
            px = x + 0.5 + sx
            py = y + 0.5 + sy

            sq_d = sd_rounded_box(px - sq_center_x, py - sq_center_y, sq_size, sq_size, sq_radius)
            if sq_d > 1.0:
                continue

            # Pure clean crisp white background
            grad_t = py / float(size)
            bg_r = 255.0 - grad_t * 6.0
            bg_g = 255.0 - grad_t * 4.0
            bg_b = 255.0 - grad_t * 2.0

            # Delicate Apple border
            if sq_d > -1.5:
                border_factor = (sq_d + 1.5) / 1.5
                bg_r = bg_r * (1.0 - border_factor) + 218.0 * border_factor
                bg_g = bg_g * (1.0 - border_factor) + 225.0 * border_factor
                bg_b = bg_b * (1.0 - border_factor) + 235.0 * border_factor

            edge_alpha = max(0.0, min(1.0, 0.5 - sq_d))

            # Briefcase body
            d_body_out = sd_rounded_box(px - sq_center_x, py - b_cy, b_w, b_h, b_r)
            d_body_in = sd_rounded_box(px - sq_center_x, py - b_cy, b_w - thick, b_h - thick, max(0.5, b_r - thick*0.7))
            d_body = max(d_body_out, -d_body_in)

            # Briefcase handle
            d_h_out = sd_rounded_box(px - sq_center_x, py - h_cy, h_w, h_h, h_r)
            d_h_in = sd_rounded_box(px - sq_center_x, py - (h_cy + thick*0.2), h_w - thick, h_h - thick*0.8, max(0.5, h_r - thick*0.6))
            d_h = max(d_h_out, -d_h_in)
            d_h = max(d_h, py - (b_cy - b_h + thick*0.5))

            d_briefcase = min(d_body, d_h)

            if d_briefcase <= 0.5:
                c_alpha = max(0.0, min(1.0, 0.5 - d_briefcase))
                pix_r = brand_r * c_alpha + bg_r * (1.0 - c_alpha)
                pix_g = brand_g * c_alpha + bg_g * (1.0 - c_alpha)
                pix_b = brand_b * c_alpha + bg_b * (1.0 - c_alpha)
                pix_a = 255.0 * edge_alpha
            else:
                pix_r = bg_r
                pix_g = bg_g
                pix_b = bg_b
                pix_a = 255.0 * edge_alpha

            total_r += pix_r * (pix_a / 255.0)
            total_g += pix_g * (pix_a / 255.0)
            total_b += pix_b * (pix_a / 255.0)
            total_a += pix_a

        n = float(len(samples))
        final_a = total_a / n
        if final_a > 0.0:
            return (total_r / (total_a / 255.0), total_g / (total_a / 255.0), total_b / (total_a / 255.0), final_a)
        return (0, 0, 0, 0)

    return get_pixel

def make_ico(png_files, out_file):
    imgs = []
    for w, h, path in png_files:
        with open(path, "rb") as f:
            imgs.append((w, h, f.read()))
    header = struct.pack("<HHH", 0, 1, len(imgs))
    entries = []
    offset = 6 + len(imgs) * 16
    for w, h, data in imgs:
        wb = w if w < 256 else 0
        hb = h if h < 256 else 0
        entries.append(struct.pack("<BBBBHHII", wb, hb, 0, 0, 1, 32, len(data), offset))
        offset += len(data)
    with open(out_file, "wb") as f:
        f.write(header + b"".join(entries) + b"".join(d[2] for d in imgs))

def main():
    public_dir = "web-dashboard/public"
    os.makedirs(public_dir, exist_ok=True)

    # 1. Generate SVG Favicon
    svg_content = """<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512" fill="none">
  <rect x="20" y="20" width="472" height="472" rx="108" fill="#ffffff" stroke="#e2e8f0" stroke-width="4"/>
  <g fill="#4f46e5">
    <path d="M192 144c0-17.673 14.327-32 32-32h64c17.673 0 32 14.327 32 32v24h-24v-24c0-4.418-3.582-8-8-8h-64c-4.418 0-8 3.582-8 8v24h-24v-24z"/>
    <path fill-rule="evenodd" clip-rule="evenodd" d="M112 168c-17.673 0-32 14.327-32 32v176c0 17.673 14.327 32 32 32h288c17.673 0 32-14.327 32-32V200c0-17.673-14.327-32-32-32H112zm-8 32c0-4.418 3.582-8 8-8h288c4.418 0 8 3.582 8 8v176c0 4.418-3.582 8-8 8H112c-4.418 0-8-3.582-8-8V200z"/>
  </g>
</svg>"""
    with open(os.path.join(public_dir, "favicon.svg"), "w") as f:
        f.write(svg_content)
    print("Created favicon.svg")

    # 2. Generate PNGs
    sizes = [
        (512, "icon-512.png"),
        (192, "icon-192.png"),
        (180, "apple-touch-icon.png"),
        (180, "apple-touch-icon-precomposed.png"),
        (32, "favicon-32x32.png"),
        (16, "favicon-16x16.png")
    ]

    for sz, fname in sizes:
        dest = os.path.join(public_dir, fname)
        print(f"Rendering {fname} ({sz}x{sz})...")
        create_png(sz, sz, make_icon_renderer(sz), dest)

    # 3. Generate multi-resolution favicon.ico
    ico_dest = os.path.join(public_dir, "favicon.ico")
    ico_sources = [
        (16, 16, os.path.join(public_dir, "favicon-16x16.png")),
        (32, 32, os.path.join(public_dir, "favicon-32x32.png")),
        (180, 180, os.path.join(public_dir, "apple-touch-icon.png"))
    ]
    make_ico(ico_sources, ico_dest)
    print("Created multi-resolution favicon.ico")

if __name__ == "__main__":
    main()
