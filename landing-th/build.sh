#!/usr/bin/env bash
# Ghép các khối trong ladipage-blocks/ thành index.html (bản standalone để xem thử / tự host).
# Chạy: bash build.sh
set -euo pipefail
cd "$(dirname "$0")"

OUT=index.html
BLOCKS=(01-topbar 02-hero 03-pain 04-benefits 04b-usecase 05-how 06-spec 07-compare \
        08-reviews 09-order 10-guarantee 11-faq 12-final-cta 13-footer 14-sticky)

{
cat <<'HEAD'
<!DOCTYPE html>
<html lang="th">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1,viewport-fit=cover">
<title>เราเตอร์พกพาใส่ซิม PLERY M305-CT — WiFi 6 ส่งฟรี เก็บเงินปลายทาง</title>
<meta name="description" content="ใส่ซิม กดเปิด มี WiFi ใช้ทันที ทั้งในรถ ในบ้าน และหอพัก เราเตอร์พกพา WiFi 6 แบตในตัว 3,000mAh ใส่ซิมได้ทุกค่าย ส่งฟรีทั่วไทย เก็บเงินปลายทาง">
<meta name="theme-color" content="#FF5A1F">
<meta property="og:type" content="product">
<meta property="og:locale" content="th_TH">
<meta property="og:title" content="เราเตอร์พกพาใส่ซิม PLERY M305-CT — เหลือ ฿890 ส่งฟรี">
<meta property="og:description" content="WiFi 6 · แบตในตัว 3,000mAh · ใส่ซิมได้ทุกค่าย · ไม่ต้องรอช่าง · เก็บเงินปลายทาง · รับประกัน 1 ปี">
<meta property="og:image" content="assets/product-01-main.svg">
<link rel="icon" href="data:,">
<style>html,body{margin:0;padding:0}</style>
HEAD

echo "<!-- PIXEL -->"
# Bỏ comment dòng dưới nếu tự host (không dùng LadiPage) và đã điền Pixel ID
# cat ladipage-blocks/15-pixel.html

cat ladipage-blocks/00-global-css.html
echo "</head>"
echo '<body class="lp">'

for b in "${BLOCKS[@]}"; do
  echo ""
  cat "ladipage-blocks/$b.html"
done

echo ""
cat ladipage-blocks/99-scripts.html
echo "</body>"
echo "</html>"
} > "$OUT"

echo "✔ Đã tạo $OUT ($(wc -c < "$OUT") bytes)"
