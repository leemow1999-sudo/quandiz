# Dịch Chat 1688

Trợ lý dịch hai chiều **Việt ⇄ Trung** cho việc chat với shop trên **1688 / Taobao / Alibaba**.

Bạn gõ tiếng Việt → app trả về tiếng Trung và **tự chép sẵn vào clipboard** để dán vào khung chat của shop.
Shop trả lời tiếng Trung → bạn dán vào app → ra tiếng Việt ngay.

Toàn bộ hội thoại hiện dưới dạng khung chat quen thuộc, kèm bản gốc để đối chiếu.

![icon](public/icons/icon-192.png)

---

## Điều cần biết trước

App 1688 chính thức **không cho phần mềm ngoài chèn nội dung vào khung chat của nó** — Alibaba không mở API cho việc này, và mọi cách "tiêm" chữ vào app người khác đều dễ bị khoá tài khoản. Vì vậy quy trình ở đây là **chép — dán**, nhanh gọn chỉ 2 chạm:

1. Gõ tiếng Việt trong app này → bấm gửi. Bản tiếng Trung tự vào clipboard.
2. Mở 1688, dán vào chat của shop.
3. Shop trả lời → giữ để copy tin tiếng Trung → quay lại app này, bấm **📋 Dán** → đọc tiếng Việt.

Trên Android còn nhanh hơn: bôi đen tin tiếng Trung trong app 1688 → **Chia sẻ** → chọn **Dịch 1688** → app tự mở và dịch luôn (dùng tính năng *share target* của PWA).

---

## Chạy thử trong 2 phút

```bash
npm install
cp .env.example .env      # rồi mở .env dán ANTHROPIC_API_KEY vào
npm start
```

Mở http://localhost:3000

Lấy API key tại https://console.anthropic.com/settings/keys

**Không có API key?** Vẫn chạy được — đổi trong `.env`:

```
TRANSLATE_PROVIDER=google
```

App sẽ dùng Google Dịch miễn phí. Dịch được, nhưng hay dịch sai tiếng lóng ngành hàng
(`起订量`, `一件代发`, `混批`, `档口`…), nên chỉ hợp để xem tạm.

---

## Dùng trên điện thoại

Máy tính và điện thoại phải chung một mạng Wi‑Fi.

1. Trên máy tính, xem IP LAN: `ipconfig` (Windows) hoặc `ifconfig | grep inet` (macOS/Linux).
2. Trên điện thoại mở `http://<IP-máy-tính>:3000`, ví dụ `http://192.168.1.12:3000`.
3. Chrome/Safari → menu → **Thêm vào màn hình chính**. App chạy toàn màn hình như app thật.

> **Lưu ý về clipboard:** trình duyệt chỉ cho phép tự động chép/đọc clipboard khi trang chạy
> qua **HTTPS** (hoặc `localhost`). Nếu vào bằng `http://192.168.x.x` thì nút **📋 Dán** sẽ bị chặn —
> bạn vẫn dán tay vào ô nhập được bình thường, và nút "Chép" vẫn hoạt động bằng cơ chế dự phòng.
>
> Muốn dùng đầy đủ, cho app chạy qua HTTPS bằng một lệnh:
> ```bash
> npx cloudflared tunnel --url http://localhost:3000
> ```
> Cloudflare trả về một địa chỉ `https://...trycloudflare.com` — mở địa chỉ đó trên điện thoại.
> Cách này cũng cho phép dùng app khi không chung Wi‑Fi.

---

## Có gì trong app

| | |
|---|---|
| **Tự nhận ngôn ngữ** | Gõ tiếng Việt → ra tiếng Trung. Dán tiếng Trung → ra tiếng Việt. Không phải chọn hướng dịch. |
| **Tự chép clipboard** | Dịch xong bản tiếng Trung vào clipboard luôn, mở 1688 dán là xong. |
| **Dịch theo ngữ cảnh** | Gửi kèm vài tin gần nhất nên đại từ, "cái đó", "mẫu này" được hiểu đúng. |
| **Từ điển 1688** | 53 thuật ngữ buôn hàng kèm phiên âm — tra ngay trong app. |
| **Mẫu câu sẵn** | 26 câu hay dùng (hỏi giá, MOQ, ship, đổi trả) đã dịch sẵn, chạm là chép, không tốn lượt gọi API. |
| **Lưu hội thoại** | Lưu trong máy (localStorage), mở lại vẫn còn. Không gửi đi đâu ngoài lượt dịch. |
| **Cài được như app** | PWA: thêm vào màn hình chính, chạy full màn hình, mở được offline (phần dịch vẫn cần mạng). |

---

## Vì sao nên dùng Claude thay vì Google Dịch

Chat mua bán 1688 đầy tiếng lóng mà dịch máy thường dịch sai nghĩa:

| Tiếng Trung | Google Dịch hay ra | Nghĩa thật trong nghề |
|---|---|---|
| 亲 | "thân yêu" | "bạn ơi" — cách shop TQ gọi khách |
| 一件代发 | "gửi một cái thay thế" | dropship, mua 1 cái cũng gửi |
| 起订量 | "số lượng bắt đầu đặt hàng" | MOQ — số lượng đặt tối thiểu |
| 档口 | "cửa hàng" | sạp trong chợ sỉ (không phải xưởng) |
| 断码 | "mã bị hỏng" | thiếu size |
| 集运仓 | "kho vận chuyển tập trung" | kho gom hàng để chuyển về VN |

App nhồi sẵn bảng thuật ngữ này vào prompt, nên Claude dịch đúng nghĩa nghề và giữ đúng giọng
(shop giục thì bản dịch cũng giục, không bị "bẻ" thành văn viết).

---

## Cấu hình (`.env`)

| Biến | Mặc định | Ý nghĩa |
|---|---|---|
| `TRANSLATE_PROVIDER` | `claude` | Công cụ dịch chính: `claude` hoặc `google` |
| `TRANSLATE_FALLBACK` | `google` | Dùng khi công cụ chính lỗi |
| `ANTHROPIC_API_KEY` | — | Bắt buộc nếu dùng `claude` |
| `ANTHROPIC_MODEL` | `claude-opus-5` | Model dịch |
| `ANTHROPIC_EFFORT` | `low` | `low` / `medium` / `high` — thấp thì nhanh và rẻ hơn |
| `PORT` | `3000` | Cổng máy chủ |
| `CONTEXT_TURNS` | `6` | Số tin gần nhất gửi kèm làm ngữ cảnh |
| `MAX_INPUT_CHARS` | `4000` | Giới hạn độ dài một tin |
| `CACHE_SIZE` | `500` | Số bản dịch nhớ lại để khỏi gọi API hai lần |

Câu giống hệt nhau được lấy từ bộ nhớ đệm, và system prompt bật *prompt caching*, nên chi phí
thực tế thấp hơn nhiều so với tính theo tổng số token.

---

## Cấu trúc mã nguồn

```
server/
  index.js          máy chủ Express + các route /api
  translate.js      điều phối: nhận diện hướng dịch, cache, chuyển dự phòng
  lang.js           nhận diện tiếng Việt / tiếng Trung
  glossary.js       từ điển thuật ngữ 1688 + mẫu câu
  cache.js          LRU
  providers/
    claude.js       gọi Claude API (prompt dịch + bảng thuật ngữ)
    google.js       Google Dịch miễn phí (dự phòng)
public/             giao diện PWA (HTML/CSS/JS thuần, không framework)
scripts/gen-icons.js  sinh icon PNG cho PWA
```

### API

| Route | Mô tả |
|---|---|
| `POST /api/translate` | `{ text, direction?: "auto"\|"vi2zh"\|"zh2vi", context?: [] }` → `{ translated, source, target, provider }` |
| `GET /api/health` | Trạng thái công cụ dịch |
| `GET /api/phrases` | Danh sách mẫu câu |
| `GET /api/glossary` | Từ điển thuật ngữ |

---

## Hướng phát triển tiếp

- **Tiện ích trình duyệt** cho bản web `1688.com` trên máy tính — chỗ đó chèn thẳng bản dịch vào
  khung chat được, không cần copy/paste nữa.
- **Dịch ảnh**: chụp màn hình chat hoặc trang sản phẩm rồi dịch (Claude đọc được ảnh).
- **Ghi nhớ theo shop**: mỗi shop một hội thoại riêng, kèm ghi chú giá đã chốt.
