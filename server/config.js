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

  // Số cặp tin nhắn gần nhất gửi kèm làm ngữ cảnh cho bản dịch
  contextTurns: int(process.env.CONTEXT_TURNS, 6),
  cacheSize: int(process.env.CACHE_SIZE, 500),
  maxInputChars: int(process.env.MAX_INPUT_CHARS, 4000),
};

export function hasClaude() {
  return Boolean(config.anthropic.apiKey);
}
