/**
 * Đọc file kiến thức của shop (bot/knowledge.md). Bot chỉ được nói những gì có trong file này.
 * Sửa file là bot dùng ngay, không cần khởi động lại.
 */
import fs from 'node:fs';
import { config } from '../config.js';

// Dòng này nằm ở đầu file mẫu. Còn dòng này = chưa điền thông tin thật → không cho gửi tự động.
export const TEMPLATE_MARKER = 'FILE MẪU';

let cache = { mtimeMs: -1, text: '' };

export function loadKnowledge() {
  const file = config.bot.knowledgeFile;
  try {
    const { mtimeMs } = fs.statSync(file);
    if (mtimeMs !== cache.mtimeMs) {
      cache = { mtimeMs, text: fs.readFileSync(file, 'utf8').trim() };
    }
  } catch (err) {
    cache = { mtimeMs: -1, text: '' };
    if (err.code !== 'ENOENT') console.warn('[bot] Không đọc được file kiến thức:', err.message);
  }
  return cache.text;
}

export function knowledgeStatus() {
  const text = loadKnowledge();
  return {
    file: config.bot.knowledgeFile,
    chars: text.length,
    missing: !text,
    isTemplate: text.includes(TEMPLATE_MARKER),
  };
}
