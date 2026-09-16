# Đưa landing này lên LadiPage

## Trước hết: LadiPage nhận file gì?

| Định dạng | LadiPage nhận? | Ghi chú |
|---|---|---|
| `.ladipage` | ✅ Có | Định dạng riêng của LadiPage, import từ máy tính hoặc kho template |
| `.html` thô | ❌ Không | LadiPage **export** ra HTML, nhưng **không import** HTML thành các phần tử kéo thả |
| HTML dán vào **phần tử HTML** | ✅ Có | Đây là đường dùng được ngay, giữ nguyên 100% giao diện |

Nên có 3 cách, chọn theo nhu cầu:

---

## Cách A — Dán khối HTML (10 phút, giao diện y hệt bản mẫu)

Hợp khi muốn chạy ads ngay, sửa chữ thì sửa trong code của khối.

1. LadiPage → **Tạo Landing Page mới** → chọn **Trang trắng**.
2. Vào **Cài đặt trang**:
   - Khổ Mobile: **420px** · Desktop: **1200px**
   - Ngôn ngữ: Tiếng Thái · Bỏ tick "Tự động thêm font" nếu có
3. Kéo phần tử **HTML** vào đầu trang → dán toàn bộ `00-global-css.html`.
   Đặt chiều cao phần tử này = 0 (nó chỉ chứa CSS, không hiện gì).
4. Với mỗi khối `01` → `14` (nhớ cả `04b-usecase`): kéo thêm một phần tử **HTML**, dán nội dung khối vào,
   kéo giãn chiều cao cho vừa. Giữ đúng thứ tự số.
5. Kéo phần tử **HTML** cuối cùng → dán `99-scripts.html`.
6. **Không dán** `15-pixel.html` — Pixel gắn ở Cài đặt trang (bước dưới).
7. Ảnh: upload ảnh thật lên LadiPage → copy link ảnh → thay vào `src="assets/..."`
   trong khối `02-hero.html` và `08-reviews.html`.

> Mẹo: mỗi phần tử HTML trong LadiPage nên đặt **width 100%**, canh giữa.
> Nếu khối bị cắt cụt, tăng chiều cao phần tử hoặc bật "Tự động co giãn".

---

## Cách B — Dựng lại bằng phần tử gốc LadiPage (kéo thả đúng nghĩa)

Hợp khi muốn team sale/marketing tự sửa sau này mà không đụng code.

Mở `NOI-DUNG-THAI.md` — đó là toàn bộ chữ tiếng Thái đã chia sẵn theo từng section,
copy-paste thẳng vào các phần tử LadiPage.

Bản đồ section → phần tử LadiPage:

| Section | Phần tử LadiPage | Ghi chú thiết kế |
|---|---|---|
| 01 Thanh chạy | Shape + Text (hoặc HTML) | nền `#111827`, chữ trắng 13.5px |
| 02 Hero | Image + Headline + Paragraph + Button + **Countdown** | H1 30px mobile / 44px desktop, đậm 800 |
| 03 Nỗi đau | 4 × (Box + Text) | nền section `#F5F7FB`, box trắng bo 16px |
| 04 Lợi ích | 6 × (Box + Icon + Text) | grid 2 cột mobile, 3 cột desktop |
| 04b Nhà mạng + tình huống dùng | Box + 6 × (Icon + Text) | tên nhà mạng để dạng chữ, **đừng dùng logo AIS/True/dtac** |
| 05 Cách dùng | 3 × (Shape tròn số + Text) + Button | vòng tròn `#FF5A1F`, số trắng |
| 06 Thông số | **Table** hoặc HTML | cột trái `#F5F7FB` |
| 07 So sánh | **Table** | cột "ของเรา" nền `#FFF1EA` |
| 08 Review | 3 × (Avatar + Text + sao) | **chỉ dùng review thật** |
| 09 Đặt hàng | **Form** của LadiPage | xem cấu hình form bên dưới |
| 10 Cam kết | Box viền xanh `#12A150` | |
| 11 FAQ | **Accordion** | |
| 12 Chốt đơn | Section nền `#111827` + Button | |
| 13 Footer | Text | thông tin shop thật |
| 14 Thanh dính | **Popup dạng thanh dưới** hoặc Section "Cố định đáy" | chỉ bật ở Mobile |

### Cấu hình Form LadiPage (section 09)

| Nhãn (tiếng Thái) | Loại | Bắt buộc | Kiểm tra |
|---|---|---|---|
| `ชื่อ–นามสกุลผู้รับ` | Text | ✔ | ≥ 2 ký tự |
| `เบอร์โทรศัพท์` | Phone | ✔ | bắt đầu `0`, 9–10 số |
| `ที่อยู่จัดส่ง` | Textarea | ✔ | ≥ 10 ký tự |
| `จังหวัด` | Dropdown | ✔ | 77 tỉnh — copy list trong `NOI-DUNG-THAI.md` |
| `รหัสไปรษณีย์` | Text | ✔ | đúng 5 số |
| `เลือกแพ็ก` | Radio | ✔ | 1 / 2 / 3 เครื่อง |
| `หมายเหตุ` | Text | ✖ | |

- Nút submit: `✅ ยืนยันสั่งซื้อ — เก็บเงินปลายทาง`
- Sau khi gửi: hiện **thông báo cảm ơn tại chỗ** (đừng chuyển trang — mất tỉ lệ chuyển đổi
  và khó đo Pixel hơn).
- Kết nối dữ liệu: Form LadiPage → **Google Sheet** (có sẵn), hoặc Webhook tới
  Apps Script trong `google-apps-script.js`.

---

## Cách C — Không dùng LadiPage

`index.html` là trang độc lập, kéo cả thư mục `landing-th/` thả lên Netlify /
Vercel / hosting bất kỳ là chạy. Nhớ bỏ comment dòng `15-pixel.html` trong `build.sh`
và điền Pixel ID.

---

## Publish & đo chuyển đổi

1. **Tên miền**: gắn domain `.com` / `.co.th` riêng. Tránh dùng subdomain miễn phí
   `*.ladipage.me` cho ads Thái — bị soi kỹ hơn và khách ít tin.
2. **Pixel**: Cài đặt trang → Mã theo dõi → dán Pixel ID.
   Sự kiện file `99-scripts.html` bắn sẵn:
   - `ViewContent` khi tải trang
   - `AddToCart` khi bấm nút CTA
   - `InitiateCheckout` khi bắt đầu điền form
   - `Lead` + `Purchase` khi gửi đơn thành công
   → Tối ưu chiến dịch theo **Purchase** nếu đủ 50 đơn/tuần, chưa đủ thì chạy `Lead`.
3. **Conversions API**: bật trong Events Manager, ghép qua LadiPage hoặc server-side.
   Thái Lan tỉ lệ dùng iOS cao, thiếu CAPI là mất 20–35% dữ liệu.
4. **Tốc độ**: nén ảnh xuống < 200KB/ảnh, dùng WebP. Landing COD Thái nên load
   < 2.5s trên 4G, quá 3s là rớt 30–40% khách.
5. **Kiểm tra bắt buộc trước khi bơm tiền**:
   - [ ] Gửi thử 1 đơn → đơn về Google Sheet đúng đủ cột
   - [ ] Mở trên iPhone + Android thật, không lỗi tràn ngang
   - [ ] Pixel Helper thấy đủ 4 sự kiện
   - [ ] Đồng hồ đếm ngược chạy, nút CTA nào cũng nhảy xuống form
   - [ ] Số điện thoại trong footer gọi được thật

---

## Riêng sản phẩm này (PLERY M305-CT) — 2 việc phải làm trước khi bơm tiền

1. **Băng tần LTE.** Hỏi nhà cung cấp máy chạy băng tần nào. Muốn dùng ngon với
   AIS / TrueMove H / dtac / NT thì cần **B1 (2100) · B3 (1800) · B8 (900) · B28 (700) · B41 (2500)**.
   Nếu máy chỉ có băng tần thị trường Trung Quốc, khách Thái bắt sóng yếu hoặc không bắt được
   → bùng hàng COD hàng loạt, tiền ads mất trắng và phải chịu cả phí ship hai chiều.
   Điền kết quả vào `bands` trong `product.conf`.
2. **Số thiết bị kết nối cùng lúc.** Khách Thái hỏi câu này nhiều nhất. Điền vào `max-devices`.

Hai dòng này đang để chữ `[ยืนยันกับผู้จำหน่าย]` ngay trên trang — cố ý, để không ai
vô tình chạy ads khi chưa có số thật.

Ngoài ra: **đừng gắn logo AIS / TrueMove / dtac / NT** lên landing hay ảnh quảng cáo.
Dùng chữ thường như bản mẫu là đủ, gắn logo dễ bị report nhãn hiệu và khoá tài khoản ads.

## Ghi chú

Tài liệu chính thức của LadiPage bị chặn ở môi trường dựng bộ này, nên bảng
"LadiPage nhận file gì" ở trên dựa trên thông tin công khai về tính năng
*Export .html*, *phần tử HTML* và *import file `.ladipage`*. Nếu bản LadiPage
mày đang dùng có thêm đường import khác, cách A vẫn chạy đúng không phụ thuộc.
