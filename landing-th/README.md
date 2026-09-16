# Landing COD Thái Lan — PLERY M305-CT (bộ phát WiFi 4G di động)

Landing tiếng Thái hoàn chỉnh để chạy Facebook Ads tại Thái Lan, chốt đơn bằng
**form COD ngay trên trang** (khách không phải chuyển khoản trước).

Sản phẩm: **เราเตอร์พกพาใส่ซิม PLERY M305-CT** — 4G LTE Cat.4 (tối đa 150Mbps),
WiFi 6 (tối đa 300Mbps), pin 3.000mAh, khe nano SIM, sạc Type-C, dùng trong xe và trong nhà.

```
landing-th/
├── index.html                ← trang hoàn chỉnh (mở bằng trình duyệt để xem thử / tự host)
├── build.sh                  ← ghép các khối → index.html
├── product.conf              ← TÊN + GIÁ + THÔNG TIN SHOP (sửa ở đây)
├── apply-product.py          ← đổ product.conf vào tất cả các khối
├── ladipage-blocks/          ← 17 khối HTML để dán vào LadiPage
│   ├── 00-global-css.html    ← DÁN ĐẦU TIÊN (font + toàn bộ CSS)
│   ├── 01-topbar.html … 14-sticky.html   (có cả 04b-usecase.html)
│   ├── 15-pixel.html         ← chỉ dùng khi tự host
│   └── 99-scripts.html       ← DÁN CUỐI CÙNG (đếm ngược, form, pixel event)
├── assets/                   ← ảnh placeholder đúng tỉ lệ, thay bằng ảnh thật
└── docs/
    ├── HUONG-DAN-LADIPAGE.md ← cách đưa lên LadiPage (3 cách) + publish + pixel
    ├── NOI-DUNG-THAI.md      ← toàn bộ chữ tiếng Thái để copy-paste khi dựng kéo thả
    ├── FACEBOOK-ADS-TH.md    ← mẫu quảng cáo Thái + brief ảnh/video + target
    └── google-apps-script.js ← nhận đơn COD về Google Sheet
```

## Chạy thử trong 30 giây

```bash
cd landing-th
python3 -m http.server 8080     # rồi mở http://localhost:8080
```

## Đổi sang sản phẩm khác

```bash
nano product.conf               # sửa tên, giá, thông tin shop
python3 apply-product.py        # đổ vào tất cả khối
bash build.sh                   # dựng lại index.html
```

Giá các gói (1/2/3 chiếc) nằm trong `ladipage-blocks/09-order.html` — sửa cả phần
hiển thị lẫn `data-price` của thẻ `<input>`.

## Việc bắt buộc phải làm trước khi chạy ads

0. **Xác minh 2 thông số với nhà cung cấp** rồi điền vào `product.conf`:
   - `bands` — băng tần LTE. Cần **B1 / B3 / B8 / B28 / B41** mới dùng tốt với
     AIS / TrueMove H / dtac / NT. Sai băng tần = khách Thái không bắt được sóng
     = bùng hàng COD hàng loạt.
   - `max-devices` — số thiết bị kết nối cùng lúc (khách Thái hỏi nhiều nhất).

   Hai dòng này đang hiện chữ `[ยืนยันกับผู้จำหน่าย]` ngay trên trang — cố ý, để
   không ai lỡ chạy ads khi chưa có số thật.
1. **Thay ảnh thật** vào `assets/` (xem brief ảnh trong `docs/FACEBOOK-ADS-TH.md`).
2. **Thay review thật** ở khối `08-reviews.html` — đừng bịa review ảo.
3. **Điền thông tin shop thật** ở `product.conf` (Facebook Thái yêu cầu trang bán
   hàng phải có địa chỉ + số điện thoại liên hệ thật).
4. **Nối form vào nơi nhận đơn**: `CONFIG.WEBHOOK_URL` trong `99-scripts.html`
   (hướng dẫn ở `docs/google-apps-script.js`), hoặc dùng Form gốc của LadiPage.
5. **Gắn Facebook Pixel** + bật Conversions API.
6. **Kiểm giá bán.** ฿890 / ฿1,590 / ฿2,190 là mức đề xuất, chưa tính giá nhập thật
   của mày. Tính lại theo giá vốn + phí ship COD + ~35% ngân sách ads, và nhớ tính
   theo tỷ lệ nhận hàng ~70% chứ không phải 100%.

Chi tiết cách chạy ads, mẫu copy tiếng Thái và brief chụp ảnh: `docs/FACEBOOK-ADS-TH.md`.
