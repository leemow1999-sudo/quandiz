#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
Đọc product.conf và thay nội dung vào mọi phần tử có data-lp="<key>"
trong ladipage-blocks/*.html. Idempotent — chạy lại bao nhiêu lần cũng ra kết quả đúng.

Dùng:  python3 apply-product.py && bash build.sh
"""
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
CONF = ROOT / "product.conf"
BLOCKS = sorted((ROOT / "ladipage-blocks").glob("*.html"))


def read_conf(path):
    data = {}
    for raw in path.read_text(encoding="utf-8").splitlines():
        line = raw.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, val = line.partition("=")
        data[key.strip()] = val.strip()
    return data


def apply(html, key, value):
    """Thay text bên trong <tag ... data-lp="key">TEXT</tag>."""
    pattern = re.compile(
        r'(<(?P<tag>[a-zA-Z]+)[^>]*\bdata-lp="' + re.escape(key) + r'"[^>]*>)'
        r'(?P<inner>(?:(?!</(?P=tag)>).)*?)'
        r'(</(?P=tag)>)',
        re.S,
    )
    return pattern.subn(lambda m: m.group(1) + value + m.group(4), html)


def main():
    if not CONF.exists():
        sys.exit("✗ Không tìm thấy product.conf")
    conf = read_conf(CONF)
    if not conf:
        sys.exit("✗ product.conf rỗng")

    total = {k: 0 for k in conf}
    for block in BLOCKS:
        html = block.read_text(encoding="utf-8")
        original = html
        for key, value in conf.items():
            html, n = apply(html, key, value)
            total[key] += n
        if html != original:
            block.write_text(html, encoding="utf-8")
            print(f"  ✎ {block.name}")

    print("\nĐã thay:")
    for key, n in total.items():
        mark = "✔" if n else "–"
        print(f"  {mark} {key:<14} {n} chỗ")
    unused = [k for k, n in total.items() if n == 0]
    if unused:
        print("\n⚠ Không tìm thấy data-lp cho: " + ", ".join(unused))
    print("\n→ Chạy tiếp:  bash build.sh")


if __name__ == "__main__":
    main()
