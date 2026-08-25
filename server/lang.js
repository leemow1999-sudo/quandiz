// Nhận diện ngôn ngữ cho cặp Việt <-> Trung.
// Không cần thư viện: tiếng Trung dùng chữ Hán (CJK), tiếng Việt dùng chữ Latin.

const CJK = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/;
const CJK_GLOBAL = /[㐀-䶿一-鿿豈-﫿぀-ヿ]/g;
const LATIN_GLOBAL = /[A-Za-zÀ-ỹ]/g;
const VI_DIACRITIC = /[ăâđêôơưĂÂĐÊÔƠƯáàảãạắằẳẵặấầẩẫậéèẻẽẹếềểễệíìỉĩịóòỏõọốồổỗộớờởỡợúùủũụứừửữựýỳỷỹỵÁÀẢÃẠẮẰẲẴẶẤẦẨẪẬÉÈẺẼẸẾỀỂỄỆÍÌỈĨỊÓÒỎÕỌỐỒỔỖỘỚỜỞỠỢÚÙỦŨỤỨỪỬỮỰÝỲỶỸỴ]/;

export const VI = 'vi';
export const ZH = 'zh';

function count(text, re) {
  const m = text.match(re);
  return m ? m.length : 0;
}

/**
 * Trả về 'zh' nếu là tiếng Trung, 'vi' nếu là tiếng Việt / Latin.
 * Văn bản trộn lẫn: bên nào nhiều ký tự hơn thì thắng.
 */
export function detectLanguage(text = '') {
  const cjk = count(text, CJK_GLOBAL);
  const latin = count(text, LATIN_GLOBAL);

  if (cjk === 0) return VI;
  if (latin === 0) return ZH;
  // Một chữ Hán "cõng" nhiều ký tự Latin về mặt thông tin.
  return cjk * 3 >= latin ? ZH : VI;
}

export function hasChinese(text = '') {
  return CJK.test(text);
}

export function looksVietnamese(text = '') {
  return VI_DIACRITIC.test(text);
}

/**
 * Chuẩn hoá hướng dịch.
 * direction: 'auto' | 'vi2zh' | 'zh2vi'
 */
export function resolveDirection(text, direction = 'auto') {
  if (direction === 'vi2zh') return { source: VI, target: ZH };
  if (direction === 'zh2vi') return { source: ZH, target: VI };
  const source = detectLanguage(text);
  return { source, target: source === ZH ? VI : ZH };
}

/** Chuỗi chỉ có số, ký hiệu, link... thì không cần dịch. */
export function isUntranslatable(text = '') {
  const stripped = text.replace(/https?:\/\/\S+/g, '').replace(/[\s\d\p{P}\p{S}]/gu, '');
  return stripped.length === 0;
}

export const LANG_NAMES = {
  [VI]: { vi: 'Tiếng Việt', en: 'Vietnamese', code: 'vi' },
  [ZH]: { vi: 'Tiếng Trung', en: 'Simplified Chinese', code: 'zh-CN' },
};
