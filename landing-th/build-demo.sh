#!/usr/bin/env bash
# Dựng bản XEM THỬ (demo-artifact.html) để publish lên nơi host sẵn skeleton HTML
# (Claude Artifact, CodePen…): không có thẻ <html>/<head>/<body>, có banner báo đây là bản nháp.
# Bản chạy thật là index.html — dựng bằng build.sh.
set -euo pipefail
cd "$(dirname "$0")"

OUT=demo-artifact.html
BLOCKS=(01-topbar 02-hero 03-pain 04-benefits 04b-usecase 05-how 06-spec 07-compare \
        08-reviews 09-order 10-guarantee 11-faq 12-final-cta 13-footer 14-sticky)

{
cat <<'HEAD'
<title>PLERY M305-CT Landing</title>
<style>
  body{margin:0;background:#fff;color:#15181D}
  .demo-note{background:#78350F;color:#FEF3C7;font-family:'Noto Sans Thai',system-ui,sans-serif;
    font-size:13.5px;line-height:1.6;padding:12px 16px;text-align:center}
  .demo-note b{color:#FDE68A}
</style>
HEAD

cat ladipage-blocks/00-global-css.html

cat <<'NOTE'
<div class="demo-note">
  <b>BẢN XEM THỬ</b> — ảnh sản phẩm, review và điểm đánh giá đang là chỗ trống mẫu.
  Form đặt hàng chạy thử tại chỗ, không gửi đơn đi đâu cả.
</div>
NOTE

for b in "${BLOCKS[@]}"; do echo ""; cat "ladipage-blocks/$b.html"; done
echo ""
cat ladipage-blocks/99-scripts.html
} > "$OUT"

echo "✔ Đã tạo $OUT ($(wc -c < "$OUT") bytes)"
