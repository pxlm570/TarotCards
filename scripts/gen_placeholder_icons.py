"""生成 PWA manifest 占位图标（M5 精修前使用）。

纯标准库实现，无需 Pillow：深空蓝 #14162E 底 + 古铜金 #B8912F 菱形牌背 + 中心小圆点。
用法: python scripts/gen_placeholder_icons.py
输出: public/manifest-icons/icon-192.png, icon-512.png
"""
import os
import struct
import zlib

BG = (0x14, 0x16, 0x2E)      # 深空蓝
GOLD = (0xB8, 0x91, 0x2F)    # 古铜金

OUT_DIR = os.path.join(os.path.dirname(__file__), '..', 'public', 'manifest-icons')


def write_png(path, size, pixels):
    """pixels: 每行 size*3 字节 RGB 的列表。"""
    raw = b''.join(b'\x00' + row for row in pixels)

    def chunk(typ, data):
        return (struct.pack('>I', len(data)) + typ + data
                + struct.pack('>I', zlib.crc32(typ + data) & 0xFFFFFFFF))

    ihdr = struct.pack('>IIBBBBB', size, size, 8, 2, 0, 0, 0)  # 8bit RGB
    png = (b'\x89PNG\r\n\x1a\n' + chunk(b'IHDR', ihdr)
           + chunk(b'IDAT', zlib.compress(raw, 9)) + chunk(b'IEND', b''))
    with open(path, 'wb') as f:
        f.write(png)


def render(size):
    cx = cy = (size - 1) / 2.0
    diamond_hw = size * 0.26   # 菱形半宽
    diamond_hh = size * 0.36   # 菱形半高（竖长，近似牌形）
    dot_r = size * 0.055       # 中心小圆点半径

    rows = []
    for y in range(size):
        row = bytearray()
        for x in range(size):
            dx, dy = abs(x - cx), abs(y - cy)
            if dx * dx + dy * dy <= dot_r * dot_r:
                row += bytes(BG)                      # 中心小圆点（底色镂空）
            elif dx / diamond_hw + dy / diamond_hh <= 1.0:
                row += bytes(GOLD)                    # 金色菱形
            else:
                row += bytes(BG)
        rows.append(bytes(row))
    return rows


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    for size in (192, 512):
        path = os.path.join(OUT_DIR, f'icon-{size}.png')
        write_png(path, size, render(size))
        print(f'written {path} ({os.path.getsize(path)} bytes)')


if __name__ == '__main__':
    main()
