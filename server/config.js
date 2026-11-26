import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const rootDir = path.dirname(path.dirname(fileURLToPath(import.meta.url)));

// Node 20.6+ ships process.loadEnvFile(); load .env if the user created one.
const envFile = path.join(rootDir, '.env');
if (fs.existsSync(envFile)) {
  try {
    process.loadEnvFile(envFile);
  } catch {
    // A malformed .env should not stop the server from booting.
  }
}

function int(value, fallback) {
  const n = Number.parseInt(value ?? '', 10);
  return Number.isFinite(n) ? n : fallback;
}

/**
 * Danh sách page Pancake bot được phép trả lời.
 * - Một page: PANCAKE_PAGE_ID + PANCAKE_PAGE_ACCESS_TOKEN
 * - Nhiều page: PANCAKE_PAGES=page_id_1:token_1,page_id_2:token_2
 */
function parsePancakePages() {
  const pages = new Map();
  for (const pair of (process.env.PANCAKE_PAGES || '').split(',')) {
    const sep = pair.indexOf(':');
    if (sep === -1) continue;
    const id = pair.slice(0, sep).trim();
    const token = pair.slice(sep + 1).trim();
    if (id && token) pages.set(id, { id, token });
  }
  const singleId = (process.env.PANCAKE_PAGE_ID || '').trim();
  const singleToken = (process.env.PANCAKE_PAGE_ACCESS_TOKEN || '').trim();
  if (singleId && singleToken) pages.set(singleId, { id: singleId, token: singleToken });
  return [...pages.values()];
}

function list(value) {
  return String(value || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);
}

export const config = {
  rootDir,
  publicDir: path.join(rootDir, 'public'),
  port: int(process.env.PORT, 3000),
  host: process.env.HOST || '0.0.0.0',

  // "claude" = chất lượng cao nhất (cần ANTHROPIC_API_KEY)
  // "google" = miễn phí, không cần key, chất lượng thấp hơn
  provider: (process.env.TRANSLATE_PROVIDER || 'claude').toLowerCase(),
  fallbackProvider: (process.env.TRANSLATE_FALLBACK || 'google').toLowerCase(),

  anthropic: {
    apiKey: process.env.ANTHROPIC_API_KEY || '',
    model: process.env.ANTHROPIC_MODEL || 'claude-opus-5',
    effort: process.env.ANTHROPIC_EFFORT || 'low',
    maxTokens: int(process.env.ANTHROPIC_MAX_TOKENS, 2000),
  },

  // Đặt APP_PASSCODE khi mở app ra Internet, để người lạ không xài chùa API key.
  // Để trống thì app không hỏi mật khẩu (hợp khi chỉ chạy ở máy nhà).
  passcode: process.env.APP_PASSCODE || '',

  // Số cặp tin nhắn gần nhất gửi kèm làm ngữ cảnh cho bản dịch
  contextTurns: int(process.env.CONTEXT_TURNS, 6),
  cacheSize: int(process.env.CACHE_SIZE, 500),
  maxInputChars: int(process.env.MAX_INPUT_CHARS, 4000),

  /* ---------- Chatbot trả lời khách trên Pancake ---------- */
  bot: {
    pages: parsePancakePages(),
    apiBase: process.env.PANCAKE_API_BASE || 'https://pages.fm/api/public_api/v1',
    // Chuỗi bí mật nằm trong URL webhook, vì Pancake không ký webhook.
    webhookSecret: process.env.PANCAKE_WEBHOOK_SECRET || '',

    // off    = không làm gì
    // shadow = đọc tin, soạn câu trả lời, chỉ ghi vào nhật ký (KHÔNG gửi) — để thử trên khách thật
    // auto   = tự gửi câu trả lời cho khách
    mode: (process.env.BOT_MODE || 'shadow').toLowerCase(),

    model: process.env.BOT_MODEL || 'claude-opus-5-5',
    effort: process.env.BOT_EFFORT || 'low',
    maxTokens: int(process.env.BOT_MAX_TOKENS, 16000),
    // "default" = nếu model chính từ chối, Claude tự chuyển sang model dự phòng. "off" để tắt.
    fallbacks: (process.env.BOT_FALLBACKS || 'default').toLowerCase(),
    readImages: process.env.BOT_READ_IMAGES !== 'false',

    // Chờ khách gõ xong (khách hay nhắn 3-4 tin liền) rồi mới trả lời một lượt.
    replyDelayMs: int(process.env.BOT_REPLY_DELAY_SEC, 6) * 1000,
    // Nhân viên vừa nhắn tay vào hội thoại thì bot im trong khoảng này.
    humanPauseMs: int(process.env.BOT_HUMAN_PAUSE_MIN, 120) * 60_000,
    // Thẻ (tag) Pancake: bot gắn khi cần người thật; hội thoại có thẻ này thì bot không trả lời.
    pauseTag: (process.env.BOT_PAUSE_TAG ?? 'Cần nhân viên').trim(),
    // ID nhân viên Pancake được giao hội thoại khi bot chuyển cho người (tuỳ chọn).
    handoffAssignees: list(process.env.BOT_HANDOFF_ASSIGN),
    // Ghi tóm tắt (đơn hàng, lý do chuyển) vào ghi chú khách hàng trong Pancake.
    writeNotes: process.env.BOT_WRITE_NOTES !== 'false',
    maxRepliesPerHour: int(process.env.BOT_MAX_REPLIES_PER_HOUR, 15),
    historyMessages: int(process.env.BOT_HISTORY_MESSAGES, 30),
    timezone: process.env.BOT_TIMEZONE || 'Asia/Ho_Chi_Minh',

    knowledgeFile: path.resolve(rootDir, process.env.BOT_KNOWLEDGE_FILE || 'bot/knowledge.md'),
    dataDir: path.resolve(rootDir, process.env.DATA_DIR || 'data'),
  },
};

export function hasClaude() {
  return Boolean(config.anthropic.apiKey);
}
