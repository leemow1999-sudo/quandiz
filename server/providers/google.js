import { VI, ZH } from '../lang.js';

// Endpoint dịch công khai của Google (không cần API key).
// Miễn phí nhưng không có cam kết: có thể bị chặn theo IP, và không hiểu
// tiếng lóng ngành hàng. Ở đây dùng làm phương án dự phòng khi không có
// ANTHROPIC_API_KEY hoặc khi gọi Claude lỗi.
const ENDPOINT = 'https://translate.googleapis.com/translate_a/single';

const CODE = { [VI]: 'vi', [ZH]: 'zh-CN' };

export const name = 'google';

export function isConfigured() {
  return true;
}

export async function translate({ text, source, target }) {
  const url =
    `${ENDPOINT}?client=gtx&sl=${CODE[source]}&tl=${CODE[target]}&dt=t&q=${encodeURIComponent(text)}`;

  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0', Accept: 'application/json' },
    signal: AbortSignal.timeout(15_000),
  });

  if (!res.ok) {
    throw new Error(`Google Translate trả về HTTP ${res.status}`);
  }

  const body = await res.text();
  let data;
  try {
    data = JSON.parse(body);
  } catch {
    throw new Error('Google Translate chặn yêu cầu (không trả về JSON).');
  }

  const segments = Array.isArray(data?.[0]) ? data[0] : [];
  const translated = segments
    .map((seg) => (Array.isArray(seg) ? seg[0] : ''))
    .filter(Boolean)
    .join('')
    .trim();

  if (!translated) {
    throw new Error('Google Translate trả về nội dung rỗng.');
  }

  return { translated, provider: name, model: 'gtx' };
}
